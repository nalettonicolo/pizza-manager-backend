-- =============================================================================
-- Modulo 69 — Ordine da cassa collegato al cliente web (web_cliente_user_id)
-- =============================================================================
-- Quando lo staff conferma in cassa un carrello di un account web (fonte=web),
-- l'ordine deve risultare tra "Ultimi ordini" del cliente e la vetrina può
-- svuotare il sessionStorage confrontando totale/ordine recente.
--
-- p_web_cliente_user_id: solo staff; ignorato se auth.uid() è già un cliente web
-- (anti-spoofing). Deve esistere in public.clienti per il tenant.

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'create_order_with_items'
  LOOP
    EXECUTE format('DROP FUNCTION IF EXISTS %s', r.sig);
  END LOOP;
END $$;

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
  p_idempotency_key TEXT DEFAULT NULL,
  p_web_cliente_user_id UUID DEFAULT NULL
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
  v_pay TEXT;
  v_mode TEXT;
  v_need_accept boolean := false;
  v_note TEXT;
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
    SELECT EXISTS (
      SELECT 1 FROM public.clienti c
      WHERE c.id = auth.uid() AND c.tenant_id = p_tenant_id
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

  v_po := NULL;
  IF to_regclass('public.tenants') IS NOT NULL THEN
    SELECT t.parametri_operativi INTO v_po
    FROM public.tenants t
    WHERE t.id = p_tenant_id
    LIMIT 1;
  END IF;
  IF v_po IS NULL AND to_regclass('admin.tenants') IS NOT NULL THEN
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
  v_po := COALESCE(v_po, '{}'::jsonb);
  v_mode := lower(trim(COALESCE(v_po->>'ordini_web_accettazione_mode', 'auto')));
  IF v_mode NOT IN ('auto', 'manuale') THEN
    v_mode := 'auto';
  END IF;

  IF v_is_web_cliente THEN
    IF lower(trim(COALESCE(p_tipo_ordine, ''))) NOT IN ('', 'delivery', 'negozio') THEN
      RAISE EXCEPTION 'tipo_ordine_non_valido';
    END IF;
    IF upper(trim(COALESCE(p_stato, 'IN_PREPARAZIONE'))) NOT IN ('IN_PREPARAZIONE', 'IN_ATTESA') THEN
      RAISE EXCEPTION 'stato_ordine_non_valido';
    END IF;
    v_pay := lower(trim(COALESCE(p_tipo_pagamento, '')));
    IF v_mode = 'manuale' THEN
      v_need_accept := true;
    ELSIF upper(trim(COALESCE(p_stato, ''))) = 'IN_ATTESA'
       AND v_pay NOT LIKE '%stripe%'
       AND v_pay NOT LIKE '%online%'
       AND v_pay NOT LIKE '%carta%'
       AND v_pay NOT LIKE '%sumup%' THEN
      RAISE EXCEPTION 'stato_in_attesa_richiede_pagamento_online';
    END IF;
    PERFORM public.assert_web_cliente_antifraud(p_tenant_id);
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

  IF v_need_accept THEN
    v_stato := 'IN_ATTESA'::core.stato_ordine;
  END IF;

  -- Cliente web: sempre auth.uid(). Staff: può collegare l'account web selezionato in cassa.
  v_web_cliente := NULL;
  IF v_is_web_cliente THEN
    v_web_cliente := auth.uid();
  ELSIF p_web_cliente_user_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.clienti c
      WHERE c.id = p_web_cliente_user_id
        AND c.tenant_id = p_tenant_id
    ) THEN
      RAISE EXCEPTION 'web_cliente_non_valido';
    END IF;
    v_web_cliente := p_web_cliente_user_id;
  END IF;

  IF v_is_web_cliente
     AND p_orario_ritiro IS NOT NULL
     AND trim(p_orario_ritiro) <> '' THEN
    PERFORM public.assert_slot_capacity_for_ordine(p_tenant_id, p_orario_ritiro, p_items, v_po);
  END IF;

  v_ring := NULL;
  IF (v_po->'consegna_area_poligono'->>'type') = 'Polygon'
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

  v_note := NULLIF(trim(COALESCE(p_note, '')), '');
  IF v_need_accept THEN
    IF v_note IS NULL OR position('accettazione cassa' in lower(v_note)) = 0 THEN
      v_note := trim(BOTH ' ·' FROM COALESCE(v_note, '') || ' · Ordine web · in attesa accettazione cassa');
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
    web_cliente_user_id,
    richiede_accettazione_cassa
  )
  VALUES (
    p_tenant_id,
    v_numero,
    v_stato,
    p_totale,
    v_note,
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
    v_web_cliente,
    v_need_accept
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

REVOKE ALL ON FUNCTION public.create_order_with_items(
  UUID, NUMERIC, TEXT, JSONB, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT,
  DOUBLE PRECISION, DOUBLE PRECISION, JSONB, UUID, INTEGER, TEXT, TEXT, UUID
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.create_order_with_items(
  UUID, NUMERIC, TEXT, JSONB, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT,
  DOUBLE PRECISION, DOUBLE PRECISION, JSONB, UUID, INTEGER, TEXT, TEXT, UUID
) TO authenticated;

COMMENT ON FUNCTION public.create_order_with_items(
  UUID, NUMERIC, TEXT, JSONB, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT,
  DOUBLE PRECISION, DOUBLE PRECISION, JSONB, UUID, INTEGER, TEXT, TEXT, UUID
) IS
  'Crea ordine + righe. web_cliente_user_id da auth se cliente web; staff può passare p_web_cliente_user_id.';

-- Ripara ordine demo #60 (cassa su Cliente Test senza collegamento web).
UPDATE core.ordini o
SET web_cliente_user_id = c.id
FROM public.clienti c
WHERE o.tenant_id = '95c0b10f-b677-4131-abd9-e60e8cf9e3bf'
  AND o.numero = 60
  AND o.web_cliente_user_id IS NULL
  AND c.tenant_id = o.tenant_id
  AND lower(trim(c.email)) = 'info@pizzamanager.it';
