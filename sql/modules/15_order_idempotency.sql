
-- =============================================================================
-- 15) Idempotency create_order_with_items (coda offline cassa)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.order_idempotency_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
  idempotency_key TEXT NOT NULL,
  ordine_id UUID NOT NULL REFERENCES core.ordini(id) ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT order_idempotency_tenant_key UNIQUE (tenant_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_order_idempotency_ordine
  ON public.order_idempotency_keys(ordine_id);

ALTER TABLE public.order_idempotency_keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "order_idempotency_staff_select" ON public.order_idempotency_keys;
CREATE POLICY "order_idempotency_staff_select" ON public.order_idempotency_keys
  FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM public.utenti_ruoli WHERE user_id = auth.uid()));

GRANT SELECT ON public.order_idempotency_keys TO authenticated;

COMMENT ON TABLE public.order_idempotency_keys IS
  'Chiavi idempotenza per create_order_with_items (retry offline senza ordini duplicati).';

-- Ricrea RPC con parametro p_idempotency_key (ultimo argomento, default NULL).
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
  p_telefono_ritiro TEXT DEFAULT NULL,
  p_idempotency_key TEXT DEFAULT NULL
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
  v_web_cliente uuid;
  v_idem_key TEXT;
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

  v_idem_key := NULLIF(trim(COALESCE(p_idempotency_key, '')), '');
  IF v_idem_key IS NOT NULL THEN
    SELECT oik.ordine_id INTO v_ordine_id
    FROM public.order_idempotency_keys oik
    WHERE oik.tenant_id = p_tenant_id
      AND oik.idempotency_key = v_idem_key;
    IF FOUND THEN
      RETURN v_ordine_id;
    END IF;
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

  v_web_cliente := NULL;
  IF EXISTS (
    SELECT 1
    FROM public.clienti c
    WHERE c.id = auth.uid()
      AND c.tenant_id = p_tenant_id
  ) THEN
    v_web_cliente := auth.uid();
  END IF;

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
    turno_operatori_id,
    web_cliente_user_id
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
    p_turno_operatori_id,
    v_web_cliente
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

  IF v_idem_key IS NOT NULL THEN
    INSERT INTO public.order_idempotency_keys (tenant_id, idempotency_key, ordine_id, created_by)
    VALUES (p_tenant_id, v_idem_key, v_ordine_id, auth.uid())
    ON CONFLICT (tenant_id, idempotency_key) DO NOTHING;

    SELECT oik.ordine_id INTO v_ordine_id
    FROM public.order_idempotency_keys oik
    WHERE oik.tenant_id = p_tenant_id
      AND oik.idempotency_key = v_idem_key;
  END IF;

  RETURN v_ordine_id;
END;
$fn$;

GRANT EXECUTE ON FUNCTION public.create_order_with_items(
  UUID, NUMERIC, TEXT, JSONB, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT,
  DOUBLE PRECISION, DOUBLE PRECISION, JSONB, UUID, INTEGER, TEXT, TEXT
) TO authenticated;

COMMENT ON FUNCTION public.create_order_with_items(
  UUID, NUMERIC, TEXT, JSONB, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT,
  DOUBLE PRECISION, DOUBLE PRECISION, JSONB, UUID, INTEGER, TEXT, TEXT
) IS
  'Crea ordine + righe. p_idempotency_key opzionale: retry sicuro senza duplicati (coda offline).';
