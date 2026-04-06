-- =============================================================================
-- PizzaManager — SQL UPGRADE CONSOLIDATO (unico script manuale)
--
-- Esegui in Supabase → SQL Editor quando vuoi applicare le modifiche (nessun
-- deploy automatico da questo repository per questo passaggio).
--
-- Prerequisiti tipici:
--   • Database già allineato a supabase/migrations/20260406100000_post_remote_schema_unified.sql
--     (o equivalente: core.ordini, public.utenti_ruoli, viste Ordine/RigaOrdine, ecc.)
--
-- Contenuto di questo file (idempotente dove possibile):
--   1) Fidelity + default parametri consegna/fidelity su core.tenants
--   2) core.punti_vendita (se mancante) — usato da PvContext
--   3) Estensioni core.ordini: coordinate consegna, pagamento misto (JSONB), stato consegna, PV
--   4) Vista public."Ordine" + trigger UPDATE
--   5) public.pm_point_in_ring + public.create_order_with_items (area poligono + nuovi argomenti)
--   6) public.contabilita_movimenti + RLS (persistenza incassi manuali)
--   7) public.magazzino_movimenti + RLS (base per magazzino su DB)
--
-- Nota: core.audit_logs è già previsto nello schema unificato — non duplicare qui.
--
-- ⚠️  Il frontend (createOrder) si aspetta la RPC create_order_with_items con
--     firma a 14 argomenti (inclusi p_pagamento_dettaglio, p_punto_vendita_id).
--     Dopo il primo deploy del codice aggiornato, esegui questo script su Supabase
--     (o la cassa/rest non potranno creare ordini). Poi: Settings → API → Reload schema.
-- =============================================================================


-- =============================================================================
-- 1) FIDELITY + DEFAULT PARAMETRI TENANT
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.fidelity_saldi (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
  anagrafica_cliente_id UUID NOT NULL REFERENCES public.anagrafica_clienti(id) ON DELETE CASCADE,
  punti INT NOT NULL DEFAULT 0,
  codice_carta TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fidelity_saldi_tenant_cliente_unique UNIQUE (tenant_id, anagrafica_cliente_id),
  CONSTRAINT fidelity_saldi_tenant_codice_unique UNIQUE (tenant_id, codice_carta),
  CONSTRAINT fidelity_saldi_punti_non_neg CHECK (punti >= 0)
);

CREATE INDEX IF NOT EXISTS idx_fidelity_saldi_tenant ON public.fidelity_saldi(tenant_id);
CREATE INDEX IF NOT EXISTS idx_fidelity_saldi_anagrafica ON public.fidelity_saldi(anagrafica_cliente_id);

CREATE TABLE IF NOT EXISTS public.fidelity_movimenti (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
  anagrafica_cliente_id UUID NOT NULL REFERENCES public.anagrafica_clienti(id) ON DELETE CASCADE,
  punti INT NOT NULL,
  tipo TEXT NOT NULL,
  ordine_id UUID,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fidelity_movimenti_tenant_cliente
  ON public.fidelity_movimenti(tenant_id, anagrafica_cliente_id, created_at DESC);

ALTER TABLE public.fidelity_saldi ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fidelity_movimenti ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fidelity_saldi_staff_all" ON public.fidelity_saldi;
CREATE POLICY "fidelity_saldi_staff_all" ON public.fidelity_saldi
  FOR ALL
  USING (
    tenant_id IN (SELECT tenant_id FROM public.utenti_ruoli WHERE user_id = auth.uid())
  )
  WITH CHECK (
    tenant_id IN (SELECT tenant_id FROM public.utenti_ruoli WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "fidelity_movimenti_staff_all" ON public.fidelity_movimenti;
DROP POLICY IF EXISTS "fidelity_movimenti_staff_select" ON public.fidelity_movimenti;
DROP POLICY IF EXISTS "fidelity_movimenti_staff_insert" ON public.fidelity_movimenti;
CREATE POLICY "fidelity_movimenti_staff_select" ON public.fidelity_movimenti
  FOR SELECT USING (
    tenant_id IN (SELECT tenant_id FROM public.utenti_ruoli WHERE user_id = auth.uid())
  );
CREATE POLICY "fidelity_movimenti_staff_insert" ON public.fidelity_movimenti
  FOR INSERT WITH CHECK (
    tenant_id IN (SELECT tenant_id FROM public.utenti_ruoli WHERE user_id = auth.uid())
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fidelity_saldi TO authenticated;
GRANT SELECT, INSERT ON public.fidelity_movimenti TO authenticated;

COMMENT ON TABLE public.fidelity_saldi IS 'Punti fidelity per cliente anagrafica (cassa); codice_carta univoco per tenant.';
COMMENT ON TABLE public.fidelity_movimenti IS 'Storico variazioni punti (manuale, ordine, ecc.).';

ALTER TABLE public.fidelity_saldi
  ADD COLUMN IF NOT EXISTS nome_negozio TEXT;

COMMENT ON COLUMN public.fidelity_saldi.nome_negozio IS
  'Nome come lo chiami in negozio (bancone); opzionale, affiancato al codice carta.';

UPDATE core.tenants t
SET parametri_operativi =
  COALESCE(t.parametri_operativi, '{}'::jsonb)
  || jsonb_build_object(
    'consegna_domicilio_attiva',
    CASE
      WHEN COALESCE(t.parametri_operativi, '{}'::jsonb) ? 'consegna_domicilio_attiva'
        THEN (COALESCE(t.parametri_operativi, '{}'::jsonb)->>'consegna_domicilio_attiva')::boolean
      ELSE true
    END,
    'fidelity_abilita_clienti_domicilio',
    CASE
      WHEN COALESCE(t.parametri_operativi, '{}'::jsonb) ? 'fidelity_abilita_clienti_domicilio'
        THEN (COALESCE(t.parametri_operativi, '{}'::jsonb)->>'fidelity_abilita_clienti_domicilio')::boolean
      ELSE true
    END
  );


-- =============================================================================
-- 2) core.punti_vendita (multi-sede) + vista public se assente
-- =============================================================================

CREATE TABLE IF NOT EXISTS core.punti_vendita (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  slug TEXT,
  attivo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_punti_vendita_tenant ON core.punti_vendita(tenant_id);

DROP VIEW IF EXISTS public.punti_vendita CASCADE;
CREATE VIEW public.punti_vendita AS
  SELECT
    pv.id,
    pv.tenant_id,
    pv.nome,
    pv.slug,
    pv.attivo,
    pv.created_at,
    pv.updated_at
  FROM core.punti_vendita pv
  WHERE pv.tenant_id IN (
    SELECT tenant_id FROM public.utenti_ruoli WHERE user_id = auth.uid()
    UNION
    SELECT tenant_id FROM public.clienti WHERE id = auth.uid()
  );

GRANT SELECT ON public.punti_vendita TO authenticated;
GRANT SELECT ON public.punti_vendita TO anon;


-- =============================================================================
-- 3) Estensioni core.ordini
-- =============================================================================

DO $$
BEGIN
  IF to_regclass('core.ordini') IS NULL THEN
    RAISE NOTICE 'core.ordini assente: salto estensioni ordine.';
    RETURN;
  END IF;

  ALTER TABLE core.ordini ADD COLUMN IF NOT EXISTS consegna_lng DOUBLE PRECISION;
  ALTER TABLE core.ordini ADD COLUMN IF NOT EXISTS consegna_lat DOUBLE PRECISION;
  ALTER TABLE core.ordini ADD COLUMN IF NOT EXISTS pagamento_dettaglio JSONB;
  ALTER TABLE core.ordini ADD COLUMN IF NOT EXISTS stato_consegna TEXT;
  ALTER TABLE core.ordini ADD COLUMN IF NOT EXISTS punto_vendita_id UUID;

  COMMENT ON COLUMN core.ordini.consegna_lng IS 'Longitudine indirizzo consegna (verifica area / tracciamento).';
  COMMENT ON COLUMN core.ordini.consegna_lat IS 'Latitudine indirizzo consegna.';
  COMMENT ON COLUMN core.ordini.pagamento_dettaglio IS 'Pagamento misto: es. [{"tipo":"Contanti","importo":10},{"tipo":"Carta","importo":5}].';
  COMMENT ON COLUMN core.ordini.stato_consegna IS 'Delivery: es. RICHIESTA, IN_PREPARAZIONE, IN_VIAGGIO, CONSEGNATO.';
  COMMENT ON COLUMN core.ordini.punto_vendita_id IS 'Punto vendita (core.punti_vendita) se multi-PV.';

  IF to_regclass('core.punti_vendita') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = 'ordini_punto_vendita_id_fkey'
    ) THEN
      ALTER TABLE core.ordini
        ADD CONSTRAINT ordini_punto_vendita_id_fkey
        FOREIGN KEY (punto_vendita_id) REFERENCES core.punti_vendita(id) ON DELETE SET NULL;
    END IF;
  END IF;
EXCEPTION
  WHEN duplicate_object THEN
    NULL;
END $$;


-- =============================================================================
-- 4) Vista public."Ordine" + INSTEAD OF UPDATE
-- =============================================================================

CREATE OR REPLACE FUNCTION public.ordine_instead_of_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, core
AS $tr$
BEGIN
  UPDATE core.ordini
  SET
    stato              = COALESCE(NEW.stato, OLD.stato),
    totale             = COALESCE(NEW.totale, OLD.totale),
    note               = COALESCE(NEW.note, OLD.note),
    tipo_pagamento     = COALESCE(NEW.tipo_pagamento, OLD.tipo_pagamento),
    tipo_ordine        = COALESCE(NEW.tipo_ordine, OLD.tipo_ordine),
    nome_cliente       = NEW.nome_cliente,
    orario_ritiro      = NEW.orario_ritiro,
    indirizzo_consegna = NEW.indirizzo_consegna,
    consegna_lng       = COALESCE(NEW.consegna_lng, OLD.consegna_lng),
    consegna_lat       = COALESCE(NEW.consegna_lat, OLD.consegna_lat),
    pagamento_dettaglio = COALESCE(NEW.pagamento_dettaglio, OLD.pagamento_dettaglio),
    stato_consegna     = COALESCE(NEW.stato_consegna, OLD.stato_consegna),
    punto_vendita_id   = COALESCE(NEW.punto_vendita_id, OLD.punto_vendita_id),
    updated_at         = now()
  WHERE id = OLD.id
    AND tenant_id IN (
      SELECT tenant_id FROM public.utenti_ruoli WHERE user_id = auth.uid()
      UNION
      SELECT tenant_id FROM public.clienti WHERE id = auth.uid()
    );
  RETURN NEW;
END;
$tr$;

DROP VIEW IF EXISTS public."Ordine" CASCADE;

CREATE VIEW public."Ordine" AS
  SELECT
    id,
    numero,
    stato,
    totale,
    note,
    tipo_pagamento,
    tipo_ordine,
    nome_cliente,
    orario_ritiro,
    indirizzo_consegna,
    consegna_lng,
    consegna_lat,
    pagamento_dettaglio,
    stato_consegna,
    punto_vendita_id,
    tenant_id AS "tenantId",
    created_at AS "createdAt",
    updated_at AS "updatedAt",
    deleted_at AS "deletedAt"
  FROM core.ordini
  WHERE tenant_id IN (
    SELECT tenant_id FROM public.utenti_ruoli WHERE user_id = auth.uid()
    UNION
    SELECT tenant_id FROM public.clienti WHERE id = auth.uid()
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public."Ordine" TO authenticated;

DROP TRIGGER IF EXISTS ordine_instead_of_update_trigger ON public."Ordine";
CREATE TRIGGER ordine_instead_of_update_trigger
  INSTEAD OF UPDATE ON public."Ordine"
  FOR EACH ROW
  EXECUTE PROCEDURE public.ordine_instead_of_update();


-- =============================================================================
-- 5) pm_point_in_ring + create_order_with_items (poligono + PV + pagamento misto)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.pm_point_in_ring(
  p_lng double precision,
  p_lat double precision,
  p_ring jsonb
)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
AS $ring$
DECLARE
  n int;
  i int;
  j int;
  xi double precision;
  yi double precision;
  xj double precision;
  yj double precision;
  inside boolean := false;
BEGIN
  IF p_ring IS NULL OR jsonb_typeof(p_ring) <> 'array' THEN
    RETURN NULL;
  END IF;

  n := jsonb_array_length(p_ring);
  IF n < 4 THEN
    RETURN NULL;
  END IF;

  IF (p_ring->0->>0)::double precision = (p_ring->(n - 1)->>0)::double precision
     AND (p_ring->0->>1)::double precision = (p_ring->(n - 1)->>1)::double precision THEN
    n := n - 1;
  END IF;

  IF n < 3 THEN
    RETURN NULL;
  END IF;

  FOR i IN 0..(n - 1) LOOP
    j := (i + 1) % n;
    xi := (p_ring->i->>0)::double precision;
    yi := (p_ring->i->>1)::double precision;
    xj := (p_ring->j->>0)::double precision;
    yj := (p_ring->j->>1)::double precision;
    IF (yi > p_lat) <> (yj > p_lat) THEN
      IF p_lng < (xj - xi) * (p_lat - yi) / NULLIF(yj - yi, 0) + xi THEN
        inside := NOT inside;
      END IF;
    END IF;
  END LOOP;

  RETURN inside;
END;
$ring$;

COMMENT ON FUNCTION public.pm_point_in_ring(double precision, double precision, jsonb) IS
  'Ray casting: punto [lng,lat] dentro anello poligonale GeoJSON (primo anello).';

DO $drop$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT format(
      '%I.%I(%s)',
      ns.nspname,
      p.proname,
      pg_catalog.pg_get_function_identity_arguments(p.oid)
    ) AS sig
    FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace ns ON ns.oid = p.pronamespace
    WHERE p.proname = 'create_order_with_items'
      AND ns.nspname IN ('public', 'core')
  LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS ' || r.sig || ' CASCADE';
  END LOOP;
END
$drop$;

CREATE OR REPLACE FUNCTION public.create_order_with_items(
  p_tenant_id UUID,
  p_totale NUMERIC,
  p_stato TEXT DEFAULT 'IN_PREPARAZIONE',
  p_items JSONB DEFAULT '[]'::JSONB,
  p_note TEXT DEFAULT NULL,
  p_tipo_pagamento TEXT DEFAULT NULL,
  p_tipo_ordine TEXT DEFAULT NULL,
  p_nome_cliente TEXT DEFAULT NULL,
  p_orario_ritiro TEXT DEFAULT NULL,
  p_indirizzo_consegna TEXT DEFAULT NULL,
  p_consegna_lng DOUBLE PRECISION DEFAULT NULL,
  p_consegna_lat DOUBLE PRECISION DEFAULT NULL,
  p_pagamento_dettaglio JSONB DEFAULT NULL,
  p_punto_vendita_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, core, admin
AS $fn$
DECLARE
  v_ordine_id UUID;
  v_numero INTEGER;
  v_item JSONB;
  v_stato core.stato_ordine;
  v_po jsonb;
  v_ring jsonb;
  v_inside boolean;
  v_is_staff_cassa boolean;
BEGIN
  SELECT COALESCE(MAX(numero), 0) + 1 INTO v_numero
  FROM core.ordini
  WHERE tenant_id = p_tenant_id;

  BEGIN
    v_stato := COALESCE(NULLIF(trim(p_stato), ''), 'IN_PREPARAZIONE')::core.stato_ordine;
  EXCEPTION
    WHEN invalid_text_representation THEN
      v_stato := 'IN_PREPARAZIONE'::core.stato_ordine;
  END;

  v_po := NULL;
  IF to_regclass('admin.tenants') IS NOT NULL THEN
    SELECT t.parametri_operativi INTO v_po
    FROM admin.tenants t
    WHERE t.id = p_tenant_id
    LIMIT 1;
  END IF;
  IF v_po IS NULL AND to_regclass('core.tenants') IS NOT NULL THEN
    SELECT t.parametri_operativi INTO v_po
    FROM core.tenants t
    WHERE t.id = p_tenant_id
    LIMIT 1;
  END IF;

  v_ring := NULL;
  IF v_po IS NOT NULL
     AND (v_po->'consegna_area_poligono'->>'type') = 'Polygon'
     AND jsonb_typeof(v_po->'consegna_area_poligono'->'coordinates') = 'array'
     AND jsonb_array_length(v_po->'consegna_area_poligono'->'coordinates') >= 1
  THEN
    v_ring := v_po->'consegna_area_poligono'->'coordinates'->0;
  END IF;

  IF lower(trim(COALESCE(p_tipo_ordine, ''))) = 'delivery'
     AND v_ring IS NOT NULL
     AND jsonb_typeof(v_ring) = 'array'
     AND jsonb_array_length(v_ring) >= 4
  THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.utenti_ruoli ur
      WHERE ur.user_id = auth.uid()
        AND ur.tenant_id = p_tenant_id
        AND COALESCE(ur.attivo, true) = true
        AND (
          lower(trim(COALESCE(ur.ruolo, ''))) = 'cassa'
          OR COALESCE(ur.accesso_cassa, false) = true
        )
    ) INTO v_is_staff_cassa;

    IF NOT v_is_staff_cassa THEN
      IF p_consegna_lng IS NULL OR p_consegna_lat IS NULL THEN
        RAISE EXCEPTION 'Per la consegna a domicilio servono coordinate valide dell''indirizzo (verifica su mappa).';
      END IF;

      v_inside := public.pm_point_in_ring(p_consegna_lng, p_consegna_lat, v_ring);
      IF v_inside IS DISTINCT FROM true THEN
        RAISE EXCEPTION 'L''indirizzo di consegna è fuori dall''area coperta dal locale.';
      END IF;
    END IF;
  END IF;

  INSERT INTO core.ordini (
    tenant_id,
    numero,
    stato,
    totale,
    note,
    tipo_pagamento,
    tipo_ordine,
    nome_cliente,
    orario_ritiro,
    indirizzo_consegna,
    consegna_lng,
    consegna_lat,
    pagamento_dettaglio,
    punto_vendita_id
  )
  VALUES (
    p_tenant_id,
    v_numero,
    v_stato,
    p_totale,
    NULLIF(trim(COALESCE(p_note, '')), ''),
    NULLIF(trim(COALESCE(p_tipo_pagamento, '')), ''),
    NULLIF(trim(COALESCE(p_tipo_ordine, '')), ''),
    NULLIF(trim(COALESCE(p_nome_cliente, '')), ''),
    NULLIF(trim(COALESCE(p_orario_ritiro, '')), ''),
    NULLIF(trim(COALESCE(p_indirizzo_consegna, '')), ''),
    p_consegna_lng,
    p_consegna_lat,
    p_pagamento_dettaglio,
    p_punto_vendita_id
  )
  RETURNING id INTO v_ordine_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_items, '[]'::JSONB))
  LOOP
    INSERT INTO core.riga_ordine (
      tenant_id,
      ordine_id,
      prodotto_id,
      quantita,
      prezzo,
      formato_nome,
      ingredienti_cottura_summary
    )
    VALUES (
      p_tenant_id,
      v_ordine_id,
      (v_item->>'prodotto_id')::UUID,
      GREATEST(1, COALESCE((v_item->>'quantita')::INTEGER, 1)),
      COALESCE((v_item->>'prezzo')::NUMERIC, 0),
      NULLIF(trim(COALESCE(v_item->>'formato_nome', '')), ''),
      NULLIF(trim(COALESCE(v_item->>'ingredienti_cottura_summary', '')), '')
    );
  END LOOP;

  RETURN v_ordine_id;
END;
$fn$;

GRANT EXECUTE ON FUNCTION public.create_order_with_items(
  UUID, NUMERIC, TEXT, JSONB, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT,
  DOUBLE PRECISION, DOUBLE PRECISION, JSONB, UUID
) TO authenticated;

COMMENT ON FUNCTION public.create_order_with_items(
  UUID, NUMERIC, TEXT, JSONB, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT,
  DOUBLE PRECISION, DOUBLE PRECISION, JSONB, UUID
) IS
  'Crea ordine + righe. Delivery+poligono: clienti con lng/lat in area; staff cassa esentato. Opzionale pagamento_dettaglio JSONB e punto_vendita_id.';


-- =============================================================================
-- 6) Contabilità: movimenti manuali su DB (alternativa / affiancamento a localStorage)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.contabilita_movimenti (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
  data_mov DATE NOT NULL,
  descrizione TEXT,
  importo NUMERIC(12, 2) NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('contanti', 'elettronico')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contabilita_movimenti_tenant_data
  ON public.contabilita_movimenti(tenant_id, data_mov DESC);

ALTER TABLE public.contabilita_movimenti ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "contabilita_movimenti_staff_all" ON public.contabilita_movimenti;
CREATE POLICY "contabilita_movimenti_staff_all" ON public.contabilita_movimenti
  FOR ALL
  USING (
    tenant_id IN (SELECT tenant_id FROM public.utenti_ruoli WHERE user_id = auth.uid())
  )
  WITH CHECK (
    tenant_id IN (SELECT tenant_id FROM public.utenti_ruoli WHERE user_id = auth.uid())
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.contabilita_movimenti TO authenticated;

COMMENT ON TABLE public.contabilita_movimenti IS
  'Incassi manuali registrati da Admin (contanti / elettronico); usabile al posto del solo localStorage.';


-- =============================================================================
-- 7) Magazzino: movimenti di magazzino (base incrementale)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.magazzino_movimenti (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
  prodotto_id UUID,
  descrizione TEXT NOT NULL,
  qty_delta NUMERIC(14, 3) NOT NULL,
  unita TEXT DEFAULT 'pz',
  riferimento TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_magazzino_movimenti_tenant ON public.magazzino_movimenti(tenant_id, created_at DESC);

ALTER TABLE public.magazzino_movimenti ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "magazzino_movimenti_staff_all" ON public.magazzino_movimenti;
CREATE POLICY "magazzino_movimenti_staff_all" ON public.magazzino_movimenti
  FOR ALL
  USING (
    tenant_id IN (SELECT tenant_id FROM public.utenti_ruoli WHERE user_id = auth.uid())
  )
  WITH CHECK (
    tenant_id IN (SELECT tenant_id FROM public.utenti_ruoli WHERE user_id = auth.uid())
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.magazzino_movimenti TO authenticated;

COMMENT ON TABLE public.magazzino_movimenti IS
  'Movimenti di carico/scarico; prodotto_id opzionale se il movimento è aggregato o non legato al listino.';


-- =============================================================================
-- 8) Seed: un punto vendita predefinito per tenant senza sedi (multi-PV / cassa)
-- =============================================================================

INSERT INTO core.punti_vendita (tenant_id, nome, slug, attivo)
SELECT t.id, 'Sede principale', 'principale', true
FROM core.tenants t
WHERE NOT EXISTS (SELECT 1 FROM core.punti_vendita pv WHERE pv.tenant_id = t.id);


-- =============================================================================
-- Fine script consolidato sql_upgrade.sql
-- =============================================================================
