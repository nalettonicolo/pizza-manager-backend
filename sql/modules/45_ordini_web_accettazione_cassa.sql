-- Accettazione ordini web: auto (capacità) vs manuale (cassa accetta/sposta/rifiuta).

ALTER TABLE core.ordini
  ADD COLUMN IF NOT EXISTS richiede_accettazione_cassa boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN core.ordini.richiede_accettazione_cassa IS
  'True se l''ordine web è in attesa di accettazione staff (parametro ordini_web_accettazione_mode=manuale).';

CREATE INDEX IF NOT EXISTS idx_ordini_accettazione_cassa_pending
  ON core.ordini (tenant_id, created_at DESC)
  WHERE richiede_accettazione_cassa IS TRUE AND deleted_at IS NULL;

-- Vista Ordine: espone la colonna + trigger update.
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
    richiede_accettazione_cassa = COALESCE(NEW.richiede_accettazione_cassa, OLD.richiede_accettazione_cassa),
    updated_at         = now()
  WHERE id = OLD.id
    AND tenant_id IN (
      SELECT tenant_id FROM public.utenti_ruoli WHERE user_id = auth.uid()
      UNION
      SELECT tenant_id FROM public.clienti WHERE id = auth.uid()
      UNION
      SELECT rr.tenant_id FROM core.rider rr
      WHERE rr.auth_user_id = auth.uid()
        AND COALESCE(rr.attivo, true) IS NOT FALSE
        AND rr.deleted_at IS NULL
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
    richiede_accettazione_cassa,
    online_payment,
    web_cliente_user_id,
    tenant_id AS "tenantId",
    created_at AS "createdAt",
    updated_at AS "updatedAt",
    deleted_at AS "deletedAt"
  FROM core.ordini
  WHERE deleted_at IS NULL
    AND tenant_id IN (
      SELECT tenant_id FROM public.utenti_ruoli WHERE user_id = auth.uid()
      UNION
      SELECT tenant_id FROM public.clienti WHERE id = auth.uid()
      UNION
      SELECT rr.tenant_id FROM core.rider rr
      WHERE rr.auth_user_id = auth.uid()
        AND COALESCE(rr.attivo, true) IS NOT FALSE
        AND rr.deleted_at IS NULL
    );

GRANT SELECT, INSERT, UPDATE, DELETE ON public."Ordine" TO authenticated;

DROP TRIGGER IF EXISTS ordine_instead_of_update_trigger ON public."Ordine";
CREATE TRIGGER ordine_instead_of_update_trigger
  INSTEAD OF UPDATE ON public."Ordine"
  FOR EACH ROW
  EXECUTE FUNCTION public.ordine_instead_of_update();

-- create_order_with_items: modalità accettazione da parametri_operativi
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

  v_web_cliente := NULL;
  IF v_is_web_cliente THEN
    v_web_cliente := auth.uid();
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

GRANT EXECUTE ON FUNCTION public.create_order_with_items(
  UUID, NUMERIC, TEXT, JSONB, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT,
  DOUBLE PRECISION, DOUBLE PRECISION, JSONB, UUID, INTEGER, TEXT, TEXT
) TO authenticated;

-- Pagamento online riuscito: non manda in cucina se serve accettazione cassa.
CREATE OR REPLACE FUNCTION public.edge_stripe_mark_payment_succeeded(
  p_payment_intent_id TEXT,
  p_charge_id TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, core
AS $ok$
DECLARE
  v_id UUID;
BEGIN
  IF COALESCE((auth.jwt())->>'role', '') IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  UPDATE core.ordini o
  SET
    stato = CASE
      WHEN COALESCE(o.richiede_accettazione_cassa, false) THEN o.stato
      ELSE 'IN_PREPARAZIONE'::core.stato_ordine
    END,
    tipo_pagamento = 'Carta (Stripe — pagato)',
    online_payment = COALESCE(o.online_payment, '{}'::jsonb) || jsonb_build_object(
      'provider', 'stripe',
      'stripe_payment_intent_id', p_payment_intent_id,
      'status', 'succeeded',
      'charge_id', p_charge_id,
      'paid_at', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
    ),
    updated_at = now()
  WHERE (o.online_payment->>'stripe_payment_intent_id') IS NOT DISTINCT FROM p_payment_intent_id
  RETURNING o.id INTO v_id;

  RETURN v_id;
END;
$ok$;

GRANT EXECUTE ON FUNCTION public.edge_stripe_mark_payment_succeeded(TEXT, TEXT) TO service_role;

CREATE OR REPLACE FUNCTION public.edge_sumup_mark_payment_succeeded(
  p_checkout_id TEXT,
  p_transaction_id TEXT,
  p_transaction_code TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, core
AS $ok$
DECLARE
  v_id UUID;
BEGIN
  IF COALESCE((auth.jwt())->>'role', '') IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  UPDATE core.ordini o
  SET
    stato = CASE
      WHEN COALESCE(o.richiede_accettazione_cassa, false) THEN o.stato
      ELSE 'IN_PREPARAZIONE'::core.stato_ordine
    END,
    tipo_pagamento = 'Carta (SumUp — pagato)',
    online_payment = COALESCE(o.online_payment, '{}'::jsonb) || jsonb_build_object(
      'provider', 'sumup',
      'sumup_checkout_id', p_checkout_id,
      'status', 'succeeded',
      'transaction_id', p_transaction_id,
      'transaction_code', p_transaction_code,
      'paid_at', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
    ),
    updated_at = now()
  WHERE (o.online_payment->>'sumup_checkout_id') IS NOT DISTINCT FROM p_checkout_id
  RETURNING o.id INTO v_id;

  RETURN v_id;
END;
$ok$;

GRANT EXECUTE ON FUNCTION public.edge_sumup_mark_payment_succeeded(TEXT, TEXT, TEXT) TO service_role;

-- Staff cassa/admin: accetta ordine web → cucina
CREATE OR REPLACE FUNCTION public.staff_accetta_ordine_web(p_ordine_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, core
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_ord core.ordini%ROWTYPE;
  v_ok boolean;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Accesso non autorizzato' USING ERRCODE = '42501';
  END IF;
  IF p_ordine_id IS NULL THEN
    RAISE EXCEPTION 'ordine_obbligatorio';
  END IF;

  SELECT * INTO v_ord FROM core.ordini WHERE id = p_ordine_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ordine_non_trovato' USING ERRCODE = 'P0002';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.utenti_ruoli ur
    WHERE ur.user_id = v_uid
      AND ur.tenant_id = v_ord.tenant_id
      AND COALESCE(ur.attivo, true) = true
      AND (
        lower(trim(COALESCE(ur.ruolo, ''))) IN ('cassa', 'admin', 'owner', 'superadmin')
        OR COALESCE(ur.accesso_cassa, false) = true
      )
  ) INTO v_ok;
  IF NOT v_ok THEN
    RAISE EXCEPTION 'permesso_negato' USING ERRCODE = '42501';
  END IF;

  IF NOT COALESCE(v_ord.richiede_accettazione_cassa, false) THEN
    RETURN jsonb_build_object('ok', true, 'già_accettato', true, 'ordine_id', v_ord.id, 'stato', v_ord.stato);
  END IF;

  UPDATE core.ordini
  SET
    stato = 'IN_PREPARAZIONE'::core.stato_ordine,
    richiede_accettazione_cassa = false,
    note = trim(BOTH ' ·' FROM regexp_replace(
      COALESCE(note, ''),
      '\s*·\s*Ordine web\s*·\s*in attesa accettazione cassa',
      '',
      'i'
    )),
    updated_at = now()
  WHERE id = p_ordine_id;

  RETURN jsonb_build_object('ok', true, 'già_accettato', false, 'ordine_id', p_ordine_id, 'stato', 'IN_PREPARAZIONE');
END;
$$;

COMMENT ON FUNCTION public.staff_accetta_ordine_web(UUID) IS
  'Cassa/admin: accetta ordine web in attesa → IN_PREPARAZIONE.';

REVOKE ALL ON FUNCTION public.staff_accetta_ordine_web(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.staff_accetta_ordine_web(UUID) TO authenticated;

-- Staff: rifiuta ordine web
CREATE OR REPLACE FUNCTION public.staff_rifiuta_ordine_web(p_ordine_id UUID, p_motivo TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, core
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_ord core.ordini%ROWTYPE;
  v_ok boolean;
  v_motivo TEXT := NULLIF(trim(COALESCE(p_motivo, '')), '');
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Accesso non autorizzato' USING ERRCODE = '42501';
  END IF;
  IF p_ordine_id IS NULL THEN
    RAISE EXCEPTION 'ordine_obbligatorio';
  END IF;

  SELECT * INTO v_ord FROM core.ordini WHERE id = p_ordine_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ordine_non_trovato' USING ERRCODE = 'P0002';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.utenti_ruoli ur
    WHERE ur.user_id = v_uid
      AND ur.tenant_id = v_ord.tenant_id
      AND COALESCE(ur.attivo, true) = true
      AND (
        lower(trim(COALESCE(ur.ruolo, ''))) IN ('cassa', 'admin', 'owner', 'superadmin')
        OR COALESCE(ur.accesso_cassa, false) = true
      )
  ) INTO v_ok;
  IF NOT v_ok THEN
    RAISE EXCEPTION 'permesso_negato' USING ERRCODE = '42501';
  END IF;

  UPDATE core.ordini
  SET
    stato = 'ANNULLATO'::core.stato_ordine,
    richiede_accettazione_cassa = false,
    note = trim(BOTH ' ·' FROM COALESCE(note, '') ||
      CASE WHEN v_motivo IS NOT NULL THEN ' · Rifiutato cassa: ' || v_motivo ELSE ' · Rifiutato da cassa' END),
    updated_at = now()
  WHERE id = p_ordine_id;

  RETURN jsonb_build_object('ok', true, 'ordine_id', p_ordine_id, 'stato', 'ANNULLATO');
END;
$$;

COMMENT ON FUNCTION public.staff_rifiuta_ordine_web(UUID, TEXT) IS
  'Cassa/admin: rifiuta ordine web in attesa → ANNULLATO.';

REVOKE ALL ON FUNCTION public.staff_rifiuta_ordine_web(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.staff_rifiuta_ordine_web(UUID, TEXT) TO authenticated;
