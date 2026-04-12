-- =============================================================================
-- PizzaManager — SQL UPGRADE (modifiche successive al baseline)
-- =============================================================================
--
-- Baseline completo (nuovo DB o allineamento totale): eseguire per primo
--   sql/schema_completo_pizzamanager.sql
--   (include ex snapshot remoto + tutte le patch che erano in supabase/migrations/).
--
-- Questo file è il punto unico per le nuove DDL/DML incrementali: preferire
-- blocchi idempotenti (IF NOT EXISTS, DO $$ … $$, DROP … IF EXISTS dove sicuro).
-- Le patch che toccano Ordine / create_order_with_items / replace_order_items vanno
-- incluse qui (non solo nei moduli sotto sql/modules/), così un’unica esecuzione basta.
--
-- Changelog (estratto):
--   2026-04-11 — public.replace_order_items: modifica righe ordine dalla cassa
--     (sostituisce righe, totale, azzera cucina_prep_stato; staff cassa / accesso_cassa).
--   2026-04 — public.utenti_ruoli.nome_visualizzato + vista ruoli_pizzeria aggiornata.
--
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Patch: fiscal_outbox + payment_link_intents (modulo 12 — stesso contenuto di
-- sql/modules/12_fiscal_outbox_payment_links.sql)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.fiscal_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
  ordine_id UUID REFERENCES core.ordini(id) ON DELETE SET NULL,
  punto_vendita_id UUID,
  kind TEXT NOT NULL CHECK (
    kind IN (
      'corrispettivo_rt',
      'chiusura_giornaliera_rt',
      'annullo_rt',
      'sdi_fattura',
      'sdi_nota_credito',
      'export_file',
      'noop_test'
    )
  ),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'processing', 'sent', 'ack', 'failed', 'cancelled')
  ),
  idempotency_key TEXT NOT NULL,
  payload_canonical JSONB NOT NULL DEFAULT '{}'::jsonb,
  provider_key TEXT,
  provider_request JSONB,
  provider_response JSONB,
  last_error TEXT,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  next_retry_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  acknowledged_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT fiscal_outbox_tenant_idempotency UNIQUE (tenant_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_fiscal_outbox_tenant_status
  ON public.fiscal_outbox(tenant_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_fiscal_outbox_ordine
  ON public.fiscal_outbox(ordine_id)
  WHERE ordine_id IS NOT NULL;

COMMENT ON TABLE public.fiscal_outbox IS
  'Coda fiscal: corrispettivi RT, chiusure, SDI, export. Adapter esterni mappano payload_canonical → fornitore.';

COMMENT ON COLUMN public.fiscal_outbox.payload_canonical IS
  'Payload interno stabile (importi, righe, aliquote, riferimenti ordine) prima del mapping verso il provider.';

COMMENT ON COLUMN public.fiscal_outbox.provider_key IS
  'Identificativo implementazione: es. rtmiddleware_acme, export_xml_v1, noop.';

CREATE TABLE IF NOT EXISTS public.payment_link_intents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
  ordine_id UUID NOT NULL REFERENCES core.ordini(id) ON DELETE CASCADE,
  importo_cent BIGINT NOT NULL CHECK (importo_cent > 0),
  valuta TEXT NOT NULL DEFAULT 'EUR',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'sent', 'opened', 'paid', 'failed', 'expired', 'cancelled')
  ),
  idempotency_key TEXT NOT NULL,
  destinatario_telefono TEXT,
  payment_url TEXT,
  provider_key TEXT,
  provider_intent_id TEXT,
  provider_payload JSONB,
  last_error TEXT,
  sms_sent_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT payment_link_intents_tenant_idempotency UNIQUE (tenant_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_payment_link_intents_tenant_status
  ON public.payment_link_intents(tenant_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_payment_link_intents_ordine
  ON public.payment_link_intents(ordine_id);

COMMENT ON TABLE public.payment_link_intents IS
  'Intent pay-by-link: generazione URL, invio SMS, stato da webhook PSP.';

ALTER TABLE public.fiscal_outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_link_intents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fiscal_outbox_staff_all" ON public.fiscal_outbox;
CREATE POLICY "fiscal_outbox_staff_all" ON public.fiscal_outbox
  FOR ALL
  USING (
    tenant_id IN (SELECT ur.tenant_id FROM public.utenti_ruoli ur WHERE ur.user_id = auth.uid())
  )
  WITH CHECK (
    tenant_id IN (SELECT ur.tenant_id FROM public.utenti_ruoli ur WHERE ur.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "payment_link_intents_staff_all" ON public.payment_link_intents;
CREATE POLICY "payment_link_intents_staff_all" ON public.payment_link_intents
  FOR ALL
  USING (
    tenant_id IN (SELECT ur.tenant_id FROM public.utenti_ruoli ur WHERE ur.user_id = auth.uid())
  )
  WITH CHECK (
    tenant_id IN (SELECT ur.tenant_id FROM public.utenti_ruoli ur WHERE ur.user_id = auth.uid())
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fiscal_outbox TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_link_intents TO authenticated;

CREATE OR REPLACE FUNCTION public.pm_touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_fiscal_outbox_updated ON public.fiscal_outbox;
CREATE TRIGGER tr_fiscal_outbox_updated
  BEFORE UPDATE ON public.fiscal_outbox
  FOR EACH ROW EXECUTE FUNCTION public.pm_touch_updated_at();

DROP TRIGGER IF EXISTS tr_payment_link_intents_updated ON public.payment_link_intents;
CREATE TRIGGER tr_payment_link_intents_updated
  BEFORE UPDATE ON public.payment_link_intents
  FOR EACH ROW EXECUTE FUNCTION public.pm_touch_updated_at();

-- -----------------------------------------------------------------------------
-- telefono_ritiro + vista public."Ordine" + RPC create_order_with_items
-- (allineato a sql/modules/04_ordine_view_trigger.sql e 05_pm_point_create_order.sql)
-- -----------------------------------------------------------------------------

ALTER TABLE core.ordini ADD COLUMN IF NOT EXISTS telefono_ritiro TEXT;
COMMENT ON COLUMN core.ordini.telefono_ritiro IS 'Telefono contatto per ritiro in negozio (opzionale).';

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
    nome_cliente       = COALESCE(NEW.nome_cliente, OLD.nome_cliente),
    telefono_ritiro    = COALESCE(NEW.telefono_ritiro, OLD.telefono_ritiro),
    orario_ritiro      = COALESCE(NEW.orario_ritiro, OLD.orario_ritiro),
    indirizzo_consegna = COALESCE(NEW.indirizzo_consegna, OLD.indirizzo_consegna),
    consegna_lng       = COALESCE(NEW.consegna_lng, OLD.consegna_lng),
    consegna_lat       = COALESCE(NEW.consegna_lat, OLD.consegna_lat),
    pagamento_dettaglio = COALESCE(NEW.pagamento_dettaglio, OLD.pagamento_dettaglio),
    stato_consegna     = COALESCE(NEW.stato_consegna, OLD.stato_consegna),
    punto_vendita_id   = COALESCE(NEW.punto_vendita_id, OLD.punto_vendita_id),
    turno_operatori_id = COALESCE(NEW.turno_operatori_id, OLD.turno_operatori_id),
    rider_id           = COALESCE(NEW.rider_id, OLD.rider_id),
    turno_rider_id     = COALESCE(NEW.turno_rider_id, OLD.turno_rider_id),
    percorso_attivo_id = COALESCE(NEW.percorso_attivo_id, OLD.percorso_attivo_id),
    stato_delivery     = COALESCE(NEW.stato_delivery, OLD.stato_delivery),
    assegnato_rider_at = COALESCE(NEW.assegnato_rider_at, OLD.assegnato_rider_at),
    ritiro_bancone_rider_at = COALESCE(NEW.ritiro_bancone_rider_at, OLD.ritiro_bancone_rider_at),
    consegna_effettiva_at = COALESCE(NEW.consegna_effettiva_at, OLD.consegna_effettiva_at),
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
    telefono_ritiro,
    orario_ritiro,
    indirizzo_consegna,
    consegna_lng,
    consegna_lat,
    pagamento_dettaglio,
    stato_consegna,
    punto_vendita_id,
    turno_operatori_id,
    rider_id,
    turno_rider_id,
    percorso_attivo_id,
    stato_delivery,
    assegnato_rider_at,
    ritiro_bancone_rider_at,
    consegna_effettiva_at,
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
  EXECUTE FUNCTION public.ordine_instead_of_update();

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
  p_punto_vendita_id UUID DEFAULT NULL,
  p_turno_operatori_id INTEGER DEFAULT NULL,
  p_telefono_ritiro TEXT DEFAULT NULL
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
  v_turno_pv uuid;
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

  IF p_turno_operatori_id IS NOT NULL THEN
    IF to_regclass('public.turni_operatori') IS NULL THEN
      RAISE EXCEPTION 'turni_operatori non disponibile sul database';
    END IF;
    SELECT t.punto_vendita_id INTO v_turno_pv
    FROM public.turni_operatori t
    WHERE t.id = p_turno_operatori_id
      AND t.tenant_id = p_tenant_id
      AND t.user_id = auth.uid()
      AND t.stato = 'aperto'
      AND t.chiuso_il IS NULL;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'turno_non_valido';
    END IF;
    IF p_punto_vendita_id IS NOT NULL AND v_turno_pv IS DISTINCT FROM p_punto_vendita_id THEN
      RAISE EXCEPTION 'turno_punto_vendita_mismatch';
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
    telefono_ritiro,
    orario_ritiro,
    indirizzo_consegna,
    consegna_lng,
    consegna_lat,
    pagamento_dettaglio,
    punto_vendita_id,
    turno_operatori_id
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
    NULLIF(trim(COALESCE(p_telefono_ritiro, '')), ''),
    NULLIF(trim(COALESCE(p_orario_ritiro, '')), ''),
    NULLIF(trim(COALESCE(p_indirizzo_consegna, '')), ''),
    p_consegna_lng,
    p_consegna_lat,
    p_pagamento_dettaglio,
    p_punto_vendita_id,
    p_turno_operatori_id
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
  DOUBLE PRECISION, DOUBLE PRECISION, JSONB, UUID, INTEGER, TEXT
) TO authenticated;

COMMENT ON FUNCTION public.create_order_with_items(
  UUID, NUMERIC, TEXT, JSONB, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT,
  DOUBLE PRECISION, DOUBLE PRECISION, JSONB, UUID, INTEGER, TEXT
) IS
  'Crea ordine + righe. Delivery+poligono: clienti con lng/lat in area; staff cassa esentato. telefono_ritiro opzionale (ritiro negozio).';

-- -----------------------------------------------------------------------------
-- Sostituisce tutte le righe di un ordine (modifica cassa). Transazionale.
-- Richiede utente con ruolo cassa o accesso_cassa sul tenant dell’ordine.
-- -----------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.replace_order_items(UUID, NUMERIC, JSONB);

CREATE OR REPLACE FUNCTION public.replace_order_items(
  p_ordine_id UUID,
  p_totale NUMERIC,
  p_items JSONB DEFAULT '[]'::JSONB
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, core, admin
AS $rep$
DECLARE
  v_tenant_id UUID;
  v_stato core.stato_ordine;
  v_item JSONB;
  v_is_staff_cassa BOOLEAN;
  v_pid UUID;
BEGIN
  IF p_ordine_id IS NULL THEN
    RAISE EXCEPTION 'ordine_id_obbligatorio';
  END IF;

  SELECT o.tenant_id, o.stato INTO v_tenant_id, v_stato
  FROM core.ordini o
  WHERE o.id = p_ordine_id;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'ordine_non_trovato';
  END IF;

  IF v_stato = 'ANNULLATO'::core.stato_ordine THEN
    RAISE EXCEPTION 'ordine_annullato_non_modificabile';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.utenti_ruoli ur
    WHERE ur.user_id = auth.uid()
      AND ur.tenant_id = v_tenant_id
      AND COALESCE(ur.attivo, true) = true
      AND (
        lower(trim(COALESCE(ur.ruolo, ''))) = 'cassa'
        OR COALESCE(ur.accesso_cassa, false) = true
      )
  ) INTO v_is_staff_cassa;

  IF NOT v_is_staff_cassa THEN
    RAISE EXCEPTION 'non_autorizzato';
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'almeno_una_riga';
  END IF;

  DELETE FROM core.riga_ordine
  WHERE ordine_id = p_ordine_id
    AND tenant_id = v_tenant_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_pid := NULL;
    BEGIN
      v_pid := (v_item->>'prodotto_id')::UUID;
    EXCEPTION
      WHEN invalid_text_representation THEN
        RAISE EXCEPTION 'prodotto_id_non_valido';
    END;

    IF v_pid IS NULL THEN
      RAISE EXCEPTION 'prodotto_id_obbligatorio';
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM core.prodotti p
      WHERE p.id = v_pid
        AND p.tenant_id = v_tenant_id
    ) THEN
      RAISE EXCEPTION 'prodotto_non_valido';
    END IF;

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
      v_tenant_id,
      p_ordine_id,
      v_pid,
      GREATEST(1, COALESCE((v_item->>'quantita')::INTEGER, 1)),
      COALESCE((v_item->>'prezzo')::NUMERIC, 0),
      NULLIF(
        trim(COALESCE(v_item->>'formato_nome', v_item->>'formatoNome', '')),
        ''
      ),
      NULLIF(
        trim(
          COALESCE(
            v_item->>'ingredienti_cottura_summary',
            v_item->>'ingredientiCotturaSummary',
            ''
          )
        ),
        ''
      )
    );
  END LOOP;

  UPDATE core.ordini
  SET
    totale = p_totale,
    updated_at = now(),
    cucina_prep_stato = '{}'::jsonb
  WHERE id = p_ordine_id
    AND tenant_id = v_tenant_id;
END;
$rep$;

GRANT EXECUTE ON FUNCTION public.replace_order_items(UUID, NUMERIC, JSONB) TO authenticated;

COMMENT ON FUNCTION public.replace_order_items(UUID, NUMERIC, JSONB) IS
  'Cassa: sostituisce righe ordine, ricalcola totale, azzera cucina_prep_stato (nuovi id riga).';

-- -----------------------------------------------------------------------------
-- Ingredienti: prep_cucina (lista lavorazioni in schermata Cucina)
-- Ordini: cucina_prep_stato JSONB { "doneByRiga": { "riga_uuid": ["ing_uuid"] } }
-- -----------------------------------------------------------------------------

ALTER TABLE core.ingredienti ADD COLUMN IF NOT EXISTS prep_cucina BOOLEAN NOT NULL DEFAULT false;
COMMENT ON COLUMN core.ingredienti.prep_cucina IS
  'Se true, la cucina prepara questo ingrediente in anticipo (es. scongelare); stato per riga ordine in ordini.cucina_prep_stato.';

ALTER TABLE core.ordini ADD COLUMN IF NOT EXISTS cucina_prep_stato JSONB NOT NULL DEFAULT '{}'::jsonb;
COMMENT ON COLUMN core.ordini.cucina_prep_stato IS
  'Preparazioni cucina: doneByRiga mappa id riga ordine -> array id ingredienti segnati come pronti.';

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
    nome_cliente       = COALESCE(NEW.nome_cliente, OLD.nome_cliente),
    telefono_ritiro    = COALESCE(NEW.telefono_ritiro, OLD.telefono_ritiro),
    orario_ritiro      = COALESCE(NEW.orario_ritiro, OLD.orario_ritiro),
    indirizzo_consegna = COALESCE(NEW.indirizzo_consegna, OLD.indirizzo_consegna),
    consegna_lng       = COALESCE(NEW.consegna_lng, OLD.consegna_lng),
    consegna_lat       = COALESCE(NEW.consegna_lat, OLD.consegna_lat),
    pagamento_dettaglio = COALESCE(NEW.pagamento_dettaglio, OLD.pagamento_dettaglio),
    stato_consegna     = COALESCE(NEW.stato_consegna, OLD.stato_consegna),
    punto_vendita_id   = COALESCE(NEW.punto_vendita_id, OLD.punto_vendita_id),
    turno_operatori_id = COALESCE(NEW.turno_operatori_id, OLD.turno_operatori_id),
    rider_id           = COALESCE(NEW.rider_id, OLD.rider_id),
    turno_rider_id     = COALESCE(NEW.turno_rider_id, OLD.turno_rider_id),
    percorso_attivo_id = COALESCE(NEW.percorso_attivo_id, OLD.percorso_attivo_id),
    stato_delivery     = COALESCE(NEW.stato_delivery, OLD.stato_delivery),
    assegnato_rider_at = COALESCE(NEW.assegnato_rider_at, OLD.assegnato_rider_at),
    ritiro_bancone_rider_at = COALESCE(NEW.ritiro_bancone_rider_at, OLD.ritiro_bancone_rider_at),
    consegna_effettiva_at = COALESCE(NEW.consegna_effettiva_at, OLD.consegna_effettiva_at),
    cucina_prep_stato  = COALESCE(NEW.cucina_prep_stato, OLD.cucina_prep_stato),
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
    telefono_ritiro,
    orario_ritiro,
    indirizzo_consegna,
    consegna_lng,
    consegna_lat,
    pagamento_dettaglio,
    stato_consegna,
    punto_vendita_id,
    turno_operatori_id,
    rider_id,
    turno_rider_id,
    percorso_attivo_id,
    stato_delivery,
    assegnato_rider_at,
    ritiro_bancone_rider_at,
    consegna_effettiva_at,
    cucina_prep_stato,
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
  EXECUTE FUNCTION public.ordine_instead_of_update();

-- -----------------------------------------------------------------------------
-- Prodotti: prep_cucina (task in Cucina per fritti, bibite, dolci, ecc.)
-- -----------------------------------------------------------------------------

ALTER TABLE core.prodotti ADD COLUMN IF NOT EXISTS prep_cucina BOOLEAN NOT NULL DEFAULT false;
COMMENT ON COLUMN core.prodotti.prep_cucina IS
  'Se true, la schermata Cucina mostra un task di preparazione per ogni riga ordine (fritti, bibite, dolci, ecc.).';

DROP VIEW IF EXISTS public."Prodotto" CASCADE;

CREATE VIEW public."Prodotto" AS
  SELECT
    id,
    nome,
    descrizione,
    prezzo,
    attivo,
    ordine,
    immagine_url,
    visibile_online,
    prep_cucina,
    tenant_id,
    categoria_id,
    created_at AS "createdAt",
    updated_at AS "updatedAt",
    deleted_at AS "deletedAt"
  FROM core.prodotti
  WHERE tenant_id IN (
    SELECT tenant_id FROM public.utenti_ruoli WHERE user_id = auth.uid()
    UNION
    SELECT tenant_id FROM public.clienti WHERE id = auth.uid()
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public."Prodotto" TO authenticated;
GRANT SELECT ON public."Prodotto" TO anon;

-- -----------------------------------------------------------------------------
-- Dipendenti: nome in sede (es. «Anna» alla cassa) per turni / riferimento umano
-- -----------------------------------------------------------------------------

ALTER TABLE public.utenti_ruoli
  ADD COLUMN IF NOT EXISTS nome_visualizzato TEXT;

COMMENT ON COLUMN public.utenti_ruoli.nome_visualizzato IS
  'Nome o etichetta del dipendente in sede (es. Anna), distinto dall’account email; usabile per turni e report.';

DROP VIEW IF EXISTS public.ruoli_pizzeria CASCADE;

CREATE VIEW public.ruoli_pizzeria AS
SELECT
  ur.user_id,
  ur.ruolo,
  ur.tenant_id,
  ur.puo_modificare_parametri,
  ur.attivo,
  ur.accesso_riepilogo,
  ur.accesso_cassa,
  ur.accesso_cucina,
  ur.accesso_bancone,
  ur.accesso_pizzaiolo,
  ur.accesso_delivery,
  ur.accesso_pony,
  ur.nome_visualizzato,
  u.email
FROM public.utenti_ruoli ur
JOIN auth.users u ON u.id = ur.user_id
WHERE ur.tenant_id IN (
  SELECT tenant_id FROM public.utenti_ruoli WHERE user_id = auth.uid()
)
OR EXISTS (
  SELECT 1
  FROM public.utenti_ruoli ur_sa
  WHERE ur_sa.user_id = auth.uid()
    AND COALESCE(ur_sa.attivo, true) IS DISTINCT FROM false
    AND lower(trim(ur_sa.ruolo)) = 'superadmin'
);

GRANT SELECT ON public.ruoli_pizzeria TO authenticated;
