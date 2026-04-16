-- =============================================================================
-- PizzaManager — SQL UPGRADE (nuove implementazioni incrementali)
-- =============================================================================
--
-- Stato:
-- - Le patch storiche sono state consolidate in:
--   sql/schema_completo_pizzamanager.sql
-- - Questo file deve contenere SOLO nuove modifiche non ancora consolidate.
--
-- Regole operative:
-- 1) Aggiungere qui solo patch incrementali idempotenti.
-- 2) Dopo applicazione e verifica, consolidare in schema_completo.
-- 3) Poi svuotare di nuovo questo file mantenendo il template.
--
-- Template blocco patch:
-- -----------------------------------------------------------------------------
-- -- YYYY-MM-DD - titolo breve
-- DO $$
-- BEGIN
--   -- SQL idempotente
-- END $$;
-- -----------------------------------------------------------------------------
--
-- 2026-04-15 - Fix categorie corrette in vetrina / preview (tenant-safe)
DROP VIEW IF EXISTS public.prodotti_menu_pubblico CASCADE;
CREATE VIEW public.prodotti_menu_pubblico AS
  SELECT
    p.id,
    p.nome,
    p.descrizione,
    p.prezzo,
    p.attivo,
    p.ordine,
    p.immagine_url,
    p.visibile_online,
    p.tenant_id,
    p.categoria_id,
    cat.nome AS categoria_nome,
    p.created_at AS "createdAt",
    p.updated_at AS "updatedAt",
    p.deleted_at AS "deletedAt"
  FROM core.prodotti p
  LEFT JOIN core.categorie cat
    ON cat.id = p.categoria_id
   AND cat.tenant_id = p.tenant_id
  WHERE p.deleted_at IS NULL
    AND (p.attivo = true OR p.attivo IS NULL)
    AND (p.visibile_online = true OR p.visibile_online IS NULL);

REVOKE SELECT ON public.prodotti_menu_pubblico FROM anon;
GRANT SELECT ON public.prodotti_menu_pubblico TO authenticated;

-- 2026-04-15 - Archivio dipendenti (anagrafica HR base per tenant)
CREATE TABLE IF NOT EXISTS public.staff_archivio_dipendenti (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome_completo TEXT,
  codice_fiscale TEXT,
  data_nascita DATE,
  luogo_nascita TEXT,
  indirizzo_residenza TEXT,
  telefono_personale TEXT,
  email_personale TEXT,
  mansione TEXT,
  tipo_contratto TEXT,
  data_assunzione DATE,
  iban TEXT,
  corsi_formazione JSONB NOT NULL DEFAULT '[]'::jsonb,
  documenti_lavoro JSONB NOT NULL DEFAULT '[]'::jsonb,
  note_hr TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT staff_archivio_dipendenti_tenant_user_unique UNIQUE (tenant_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_staff_archivio_dipendenti_tenant
  ON public.staff_archivio_dipendenti(tenant_id);

ALTER TABLE public.staff_archivio_dipendenti ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS staff_archivio_dipendenti_tenant_all ON public.staff_archivio_dipendenti;
CREATE POLICY staff_archivio_dipendenti_tenant_all ON public.staff_archivio_dipendenti
  FOR ALL
  USING (
    tenant_id IN (SELECT tenant_id FROM public.utenti_ruoli WHERE user_id = auth.uid())
  )
  WITH CHECK (
    tenant_id IN (SELECT tenant_id FROM public.utenti_ruoli WHERE user_id = auth.uid())
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff_archivio_dipendenti TO authenticated;

COMMENT ON TABLE public.staff_archivio_dipendenti IS
  'Archivio dipendenti per tenant: dati anagrafici, contrattuali, corsi e note HR.';

-- 2026-04-16 - Hardening create_order_with_items (tenant access + canale web)
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
  v_has_tenant_access boolean;
  v_is_web_cliente boolean;
  v_turno_pv uuid;
BEGIN
  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'tenant_obbligatorio';
  END IF;

  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'non_autenticato';
  END IF;

  v_has_tenant_access := false;
  IF to_regproc('public.pm_core_tenant_access(uuid)') IS NOT NULL THEN
    SELECT public.pm_core_tenant_access(p_tenant_id) INTO v_has_tenant_access;
  ELSE
    SELECT EXISTS (
      SELECT 1
      FROM public.utenti_ruoli ur
      WHERE ur.user_id = auth.uid()
        AND ur.tenant_id = p_tenant_id
        AND COALESCE(ur.attivo, true) = true
    ) INTO v_has_tenant_access;
  END IF;

  IF NOT COALESCE(v_has_tenant_access, false) THEN
    RAISE EXCEPTION 'tenant_non_autorizzato';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.clienti c
    WHERE c.id = auth.uid()
      AND c.tenant_id = p_tenant_id
  ) INTO v_is_web_cliente;

  IF v_is_web_cliente THEN
    IF lower(trim(COALESCE(p_tipo_ordine, ''))) NOT IN ('', 'delivery', 'negozio') THEN
      RAISE EXCEPTION 'tipo_ordine_non_valido';
    END IF;
    IF upper(trim(COALESCE(p_stato, 'IN_PREPARAZIONE'))) NOT IN ('IN_PREPARAZIONE') THEN
      RAISE EXCEPTION 'stato_ordine_non_valido';
    END IF;
  END IF;

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

-- 2026-04-16 - Delivery: transizione CONSEGNATO atomica (stato_consegna + stato ordine)
CREATE OR REPLACE FUNCTION public.delivery_mark_consegnato(
  p_ordine_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, core
AS $$
DECLARE
  v_tenant_id UUID;
  v_allowed BOOLEAN;
BEGIN
  IF p_ordine_id IS NULL THEN
    RAISE EXCEPTION 'ordine_id_obbligatorio';
  END IF;

  SELECT o.tenant_id
  INTO v_tenant_id
  FROM core.ordini o
  WHERE o.id = p_ordine_id;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'ordine_non_trovato';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.utenti_ruoli ur
    WHERE ur.user_id = auth.uid()
      AND ur.tenant_id = v_tenant_id
      AND COALESCE(ur.attivo, true) = true
      AND (
        lower(trim(COALESCE(ur.ruolo, ''))) IN ('delivery', 'pony', 'cassa', 'admin')
        OR COALESCE(ur.accesso_delivery, false) = true
        OR COALESCE(ur.accesso_pony, false) = true
        OR COALESCE(ur.accesso_cassa, false) = true
      )
  ) INTO v_allowed;

  IF NOT COALESCE(v_allowed, false) THEN
    RAISE EXCEPTION 'non_autorizzato';
  END IF;

  UPDATE core.ordini o
  SET
    stato_consegna = 'CONSEGNATO',
    stato = 'CONSEGNATO'::core.stato_ordine,
    stato_delivery = 'CONSEGNATO'::core.stato_delivery,
    consegna_effettiva_at = COALESCE(o.consegna_effettiva_at, now()),
    updated_at = now()
  WHERE o.id = p_ordine_id
    AND o.tenant_id = v_tenant_id;

  IF to_regclass('core.ordine_consegna_evento') IS NOT NULL THEN
    INSERT INTO core.ordine_consegna_evento (tenant_id, ordine_id, tipo, payload, created_by)
    VALUES (v_tenant_id, p_ordine_id, 'delivery_mark_consegnato', '{}'::jsonb, auth.uid());
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delivery_mark_consegnato(UUID) TO authenticated;

-- 2026-04-16 - Vetrina anon: nomi ingredienti per ricerca menu (tenant-safe, stessi filtri di prodotti_menu_pubblico)
CREATE OR REPLACE FUNCTION public.get_public_menu_ingredient_names(
  p_tenant_id UUID,
  p_product_ids UUID[]
)
RETURNS TABLE (
  prodotto_id UUID,
  nomi TEXT[]
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, core
AS $$
  SELECT
    pi.prodotto_id,
    coalesce(
      array_agg(btrim(i.nome) ORDER BY lower(btrim(i.nome)))
        FILTER (WHERE i.nome IS NOT NULL AND btrim(i.nome) <> ''),
      '{}'::text[]
    ) AS nomi
  FROM core.prodotto_ingrediente pi
  INNER JOIN core.ingredienti i
    ON i.id = pi.ingrediente_id
   AND i.tenant_id = pi.tenant_id
  INNER JOIN core.prodotti p
    ON p.id = pi.prodotto_id
   AND p.tenant_id = pi.tenant_id
  WHERE pi.tenant_id = p_tenant_id
    AND p_product_ids IS NOT NULL
    AND cardinality(p_product_ids) >= 1
    AND pi.prodotto_id = ANY(p_product_ids)
    AND p.deleted_at IS NULL
    AND (p.attivo = true OR p.attivo IS NULL)
    AND (p.visibile_online = true OR p.visibile_online IS NULL)
    AND i.deleted_at IS NULL
  GROUP BY pi.prodotto_id;
$$;

COMMENT ON FUNCTION public.get_public_menu_ingredient_names(UUID, UUID[]) IS
  'Vetrina pubblica: elenco nomi ingredienti per prodotti del menu online del tenant. SECURITY DEFINER; allineato ai filtri di public.prodotti_menu_pubblico.';

GRANT EXECUTE ON FUNCTION public.get_public_menu_ingredient_names(UUID, UUID[]) TO anon;
GRANT EXECUTE ON FUNCTION public.get_public_menu_ingredient_names(UUID, UUID[]) TO authenticated;

-- 2026-04-16 - Vetrina SaaS (localhost / app.*): menu per tenant senza GRANT SELECT anon sulla vista
CREATE OR REPLACE FUNCTION public.get_public_menu_for_tenant(p_tenant_id UUID)
RETURNS SETOF public.prodotti_menu_pubblico
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, core
AS $$
  SELECT v.*
  FROM public.prodotti_menu_pubblico v
  WHERE p_tenant_id IS NOT NULL
    AND v.tenant_id = p_tenant_id;
$$;

COMMENT ON FUNCTION public.get_public_menu_for_tenant(UUID) IS
  'Menu pubblico filtrato per tenant (anteprima /negozio /preview, ?tenant=). SECURITY DEFINER: necessario dopo REVOKE SELECT anon su public.prodotti_menu_pubblico.';

GRANT EXECUTE ON FUNCTION public.get_public_menu_for_tenant(UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.get_public_menu_for_tenant(UUID) TO authenticated;

-- 2026-04-17 - prodotto_ingrediente: posizione in cottura (menu pizze admin)
ALTER TABLE core.prodotto_ingrediente ADD COLUMN IF NOT EXISTS posizione_cottura TEXT NOT NULL DEFAULT 'in_cottura';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'prodotto_ingrediente_posizione_cottura_chk'
  ) THEN
    ALTER TABLE core.prodotto_ingrediente ADD CONSTRAINT prodotto_ingrediente_posizione_cottura_chk
      CHECK (posizione_cottura IN ('in_cottura', 'fuori_cottura', 'a_parte'));
  END IF;
END $$;

COMMENT ON COLUMN core.prodotto_ingrediente.posizione_cottura IS
  'Dove va messo l''ingrediente sulla pizza: in forno, dopo cottura, o servito a parte.';

DROP VIEW IF EXISTS public.prodotto_ingrediente CASCADE;

CREATE VIEW public.prodotto_ingrediente AS
  SELECT
    pi.id,
    pi.tenant_id,
    pi.prodotto_id,
    pi.ingrediente_id,
    pi.quantita,
    pi.ordine,
    pi.posizione_cottura
  FROM core.prodotto_ingrediente pi
  WHERE pi.tenant_id IN (
    SELECT tenant_id FROM public.utenti_ruoli WHERE user_id = auth.uid()
    UNION
    SELECT tenant_id FROM public.clienti WHERE id = auth.uid()
  );

GRANT SELECT, INSERT, DELETE ON public.prodotto_ingrediente TO authenticated;

CREATE OR REPLACE FUNCTION public.prodotto_ingrediente_insert()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO core.prodotto_ingrediente (
    tenant_id,
    prodotto_id,
    ingrediente_id,
    quantita,
    ordine,
    posizione_cottura
  )
  VALUES (
    NEW.tenant_id,
    NEW.prodotto_id,
    NEW.ingrediente_id,
    COALESCE(NEW.quantita, 1),
    COALESCE(NEW.ordine, 0),
    COALESCE(NEW.posizione_cottura, 'in_cottura')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS prodotto_ingrediente_insert_trigger ON public.prodotto_ingrediente;
CREATE TRIGGER prodotto_ingrediente_insert_trigger
  INSTEAD OF INSERT ON public.prodotto_ingrediente
  FOR EACH ROW EXECUTE FUNCTION public.prodotto_ingrediente_insert();

CREATE OR REPLACE FUNCTION public.prodotto_ingrediente_delete()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM core.prodotto_ingrediente
  WHERE prodotto_id = OLD.prodotto_id
    AND tenant_id = OLD.tenant_id
    AND ingrediente_id = OLD.ingrediente_id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS prodotto_ingrediente_delete_trigger ON public.prodotto_ingrediente;
CREATE TRIGGER prodotto_ingrediente_delete_trigger
  INSTEAD OF DELETE ON public.prodotto_ingrediente
  FOR EACH ROW EXECUTE FUNCTION public.prodotto_ingrediente_delete();