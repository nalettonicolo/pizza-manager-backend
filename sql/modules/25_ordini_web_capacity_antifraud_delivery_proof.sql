
-- =============================================================================
-- 25) Ordini web: IN_ATTESA Stripe, capacity forno, antifraud, proof of delivery
-- =============================================================================

-- --- Helpers slot / capacity -------------------------------------------------

CREATE OR REPLACE FUNCTION public.pm_ordine_items_pizze_count(p_items JSONB)
RETURNS INTEGER
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(SUM(GREATEST(1, COALESCE((elem->>'quantita')::INTEGER, 1))), 0)::INTEGER
  FROM jsonb_array_elements(COALESCE(p_items, '[]'::JSONB)) AS elem;
$$;

CREATE OR REPLACE FUNCTION public.pm_orario_ritiro_to_slot_key(p_orario TEXT)
RETURNS BIGINT
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_raw TEXT;
  v_h INT;
  v_m INT;
  v_day DATE;
  v_slot_min INT;
BEGIN
  v_raw := NULLIF(trim(COALESCE(p_orario, '')), '');
  IF v_raw IS NULL THEN
    RETURN NULL;
  END IF;

  IF v_raw ~ '^\d{4}-\d{2}-\d{2}' THEN
    BEGIN
      v_day := (v_raw::TIMESTAMPTZ AT TIME ZONE 'Europe/Rome')::DATE;
      v_h := EXTRACT(HOUR FROM v_raw::TIMESTAMPTZ AT TIME ZONE 'Europe/Rome')::INT;
      v_m := EXTRACT(MINUTE FROM v_raw::TIMESTAMPTZ AT TIME ZONE 'Europe/Rome')::INT;
    EXCEPTION
      WHEN OTHERS THEN
        RETURN NULL;
    END;
  ELSE
    v_raw := replace(replace(v_raw, E'\u202f', ''), ' ', '');
    v_raw := replace(v_raw, '.', ':');
    v_h := split_part(v_raw, ':', 1)::INT;
    v_m := COALESCE(NULLIF(split_part(v_raw, ':', 2), '')::INT, 0);
    v_day := (now() AT TIME ZONE 'Europe/Rome')::DATE;
  END IF;

  v_slot_min := (v_h * 60 + v_m) / 15 * 15;
  v_h := v_slot_min / 60;
  v_m := v_slot_min % 60;

  RETURN (
    EXTRACT(
      EPOCH FROM (
        (v_day + make_time(v_h, v_m, 0)) AT TIME ZONE 'Europe/Rome'
      )
    ) * 1000
  )::BIGINT;
END;
$$;

CREATE OR REPLACE FUNCTION public.assert_slot_capacity_for_ordine(
  p_tenant_id UUID,
  p_orario_ritiro TEXT,
  p_items JSONB,
  p_parametri JSONB DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, core, admin
AS $$
DECLARE
  v_slot_key BIGINT;
  v_max INT;
  v_existing INT;
  v_new INT;
  v_po JSONB;
BEGIN
  v_slot_key := public.pm_orario_ritiro_to_slot_key(p_orario_ritiro);
  IF v_slot_key IS NULL THEN
    RETURN;
  END IF;

  v_po := COALESCE(p_parametri, '{}'::JSONB);
  v_max := GREATEST(
    1,
    ROUND(COALESCE((v_po->>'pizze_ogni_15_min')::NUMERIC, 8))::INT
  );

  SELECT COALESCE(SUM(ro.quantita), 0)::INT
  INTO v_existing
  FROM core.ordini o
  JOIN core.riga_ordine ro
    ON ro.ordine_id = o.id
   AND ro.tenant_id = o.tenant_id
  WHERE o.tenant_id = p_tenant_id
    AND o.stato::TEXT NOT IN ('ANNULLATO')
    AND (o.created_at AT TIME ZONE 'Europe/Rome')::DATE = (now() AT TIME ZONE 'Europe/Rome')::DATE
    AND public.pm_orario_ritiro_to_slot_key(o.orario_ritiro) = v_slot_key;

  v_new := public.pm_ordine_items_pizze_count(p_items);

  IF v_existing + v_new > v_max THEN
    RAISE EXCEPTION 'slot_forno_pieno: la fascia oraria selezionata ha raggiunto la capacità massima del forno.';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.assert_web_cliente_antifraud(p_tenant_id UUID)
RETURNS VOID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, core
AS $$
DECLARE
  v_count INT;
  v_blocked BOOLEAN;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'non_autenticato';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.web_cliente_blocklist b
    WHERE b.tenant_id = p_tenant_id
      AND b.user_id = auth.uid()
      AND COALESCE(b.attivo, true) = true
  ) INTO v_blocked;

  IF COALESCE(v_blocked, false) THEN
    RAISE EXCEPTION 'ordine_web_bloccato';
  END IF;

  SELECT COUNT(*)::INT
  INTO v_count
  FROM core.ordini o
  WHERE o.tenant_id = p_tenant_id
    AND o.web_cliente_user_id = auth.uid()
    AND o.created_at > now() - INTERVAL '1 hour'
    AND o.stato::TEXT NOT IN ('ANNULLATO');

  IF v_count >= 8 THEN
    RAISE EXCEPTION 'troppi_ordini_web_recenti: attendi prima di inviare un nuovo ordine.';
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public.web_cliente_blocklist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  motivo TEXT,
  attivo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT web_cliente_blocklist_unique UNIQUE (tenant_id, user_id)
);

ALTER TABLE public.web_cliente_blocklist ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "web_blocklist_staff" ON public.web_cliente_blocklist;
CREATE POLICY "web_blocklist_staff" ON public.web_cliente_blocklist
  FOR ALL
  USING (
    tenant_id IN (
      SELECT ur.tenant_id
      FROM public.utenti_ruoli ur
      WHERE ur.user_id = auth.uid()
        AND COALESCE(ur.attivo, true) = true
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.web_cliente_blocklist TO authenticated;

-- --- RPC carico slot vetrina (checkout) ------------------------------------

CREATE OR REPLACE FUNCTION public.vetrina_slot_carico_oggi(p_tenant_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, core
AS $$
DECLARE
  v_ok BOOLEAN := false;
  v_out JSONB := '{}'::JSONB;
BEGIN
  IF p_tenant_id IS NULL OR auth.uid() IS NULL THEN
    RAISE EXCEPTION 'non_autorizzato';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.clienti c
    WHERE c.id = auth.uid() AND c.tenant_id = p_tenant_id
  ) OR EXISTS (
    SELECT 1 FROM public.utenti_ruoli ur
    WHERE ur.user_id = auth.uid()
      AND ur.tenant_id = p_tenant_id
      AND COALESCE(ur.attivo, true) = true
  ) INTO v_ok;

  IF NOT COALESCE(v_ok, false) THEN
    RAISE EXCEPTION 'tenant_non_autorizzato';
  END IF;

  SELECT COALESCE(
    jsonb_object_agg(s.slot_key::TEXT, s.pizze),
    '{}'::JSONB
  )
  INTO v_out
  FROM (
    SELECT
      public.pm_orario_ritiro_to_slot_key(o.orario_ritiro) AS slot_key,
      COALESCE(SUM(ro.quantita), 0)::INT AS pizze
    FROM core.ordini o
    JOIN core.riga_ordine ro
      ON ro.ordine_id = o.id
     AND ro.tenant_id = o.tenant_id
    WHERE o.tenant_id = p_tenant_id
      AND o.stato::TEXT NOT IN ('ANNULLATO')
      AND (o.created_at AT TIME ZONE 'Europe/Rome')::DATE = (now() AT TIME ZONE 'Europe/Rome')::DATE
      AND o.orario_ritiro IS NOT NULL
      AND trim(o.orario_ritiro) <> ''
    GROUP BY 1
  ) s
  WHERE s.slot_key IS NOT NULL;

  RETURN COALESCE(v_out, '{}'::JSONB);
END;
$$;

GRANT EXECUTE ON FUNCTION public.vetrina_slot_carico_oggi(UUID) TO authenticated;

-- --- Proof of delivery -------------------------------------------------------

CREATE TABLE IF NOT EXISTS core.consegna_prova (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
  ordine_id UUID NOT NULL REFERENCES core.ordini(id) ON DELETE CASCADE,
  rider_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('firma', 'foto', 'note')),
  payload JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_consegna_prova_ordine
  ON core.consegna_prova(ordine_id, created_at DESC);

ALTER TABLE core.consegna_prova ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "consegna_prova_staff_select" ON core.consegna_prova;
CREATE POLICY "consegna_prova_staff_select" ON core.consegna_prova
  FOR SELECT
  USING (
    tenant_id IN (
      SELECT ur.tenant_id
      FROM public.utenti_ruoli ur
      WHERE ur.user_id = auth.uid()
        AND COALESCE(ur.attivo, true) = true
    )
  );

GRANT SELECT ON core.consegna_prova TO authenticated;

CREATE OR REPLACE FUNCTION public.delivery_mark_consegnato_with_proof(
  p_ordine_id UUID,
  p_prove JSONB DEFAULT '[]'::JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, core
AS $$
DECLARE
  v_tenant_id UUID;
  v_item JSONB;
  v_tipo TEXT;
BEGIN
  IF p_ordine_id IS NULL THEN
    RAISE EXCEPTION 'ordine_obbligatorio';
  END IF;

  SELECT o.tenant_id INTO v_tenant_id
  FROM core.ordini o
  WHERE o.id = p_ordine_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ordine_non_trovato';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_prove, '[]'::JSONB))
  LOOP
    v_tipo := lower(trim(COALESCE(v_item->>'tipo', '')));
    IF v_tipo NOT IN ('firma', 'foto', 'note') THEN
      CONTINUE;
    END IF;
    INSERT INTO core.consegna_prova (tenant_id, ordine_id, rider_user_id, tipo, payload)
    VALUES (
      v_tenant_id,
      p_ordine_id,
      auth.uid(),
      v_tipo,
      COALESCE(v_item->'payload', '{}'::JSONB)
    );
  END LOOP;

  PERFORM public.delivery_mark_consegnato(p_ordine_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.delivery_mark_consegnato_with_proof(UUID, JSONB) TO authenticated;

-- --- OAuth API clients (stub enterprise) -------------------------------------

CREATE TABLE IF NOT EXISTS public.api_oauth_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
  client_id TEXT NOT NULL UNIQUE,
  client_secret_hash TEXT NOT NULL,
  nome TEXT NOT NULL,
  scopes TEXT[] NOT NULL DEFAULT ARRAY['read:ordini']::TEXT[],
  attivo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.api_oauth_clients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "api_oauth_clients_sa" ON public.api_oauth_clients;
CREATE POLICY "api_oauth_clients_sa" ON public.api_oauth_clients
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.utenti_ruoli ur
      WHERE ur.user_id = auth.uid()
        AND lower(trim(COALESCE(ur.ruolo, ''))) IN ('superadmin', 'super_admin')
    )
  );

GRANT SELECT ON public.api_oauth_clients TO authenticated;

-- --- Patch create_order_with_items (web IN_ATTESA + guard) -------------------

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
  v_pay TEXT;
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

  IF v_is_web_cliente THEN
    IF lower(trim(COALESCE(p_tipo_ordine, ''))) NOT IN ('', 'delivery', 'negozio') THEN
      RAISE EXCEPTION 'tipo_ordine_non_valido';
    END IF;
    IF upper(trim(COALESCE(p_stato, 'IN_PREPARAZIONE'))) NOT IN ('IN_PREPARAZIONE', 'IN_ATTESA') THEN
      RAISE EXCEPTION 'stato_ordine_non_valido';
    END IF;
    v_pay := lower(trim(COALESCE(p_tipo_pagamento, '')));
    IF upper(trim(COALESCE(p_stato, ''))) = 'IN_ATTESA'
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

  v_web_cliente := NULL;
  IF v_is_web_cliente THEN
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

  IF v_is_web_cliente
     AND p_orario_ritiro IS NOT NULL
     AND trim(p_orario_ritiro) <> '' THEN
    PERFORM public.assert_slot_capacity_for_ordine(p_tenant_id, p_orario_ritiro, p_items, v_po);
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
  'Crea ordine + righe. Web: IN_ATTESA per pagamento online, capacity forno, antifraud.';
