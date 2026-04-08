-- Pagamenti online: stato su ordine, legame cliente web, segreti Stripe solo service_role.

DO $e$
BEGIN
  IF to_regclass('core.ordini') IS NULL THEN
    RAISE NOTICE 'core.ordini assente: salto online_payment.';
    RETURN;
  END IF;
  ALTER TABLE core.ordini ADD COLUMN IF NOT EXISTS online_payment JSONB;
  COMMENT ON COLUMN core.ordini.online_payment IS 'Stripe/SumUp: provider, payment_intent_id, charge_id, status, refund ids (aggiornato da Edge/webhook).';
  ALTER TABLE core.ordini ADD COLUMN IF NOT EXISTS web_cliente_user_id UUID;
  COMMENT ON COLUMN core.ordini.web_cliente_user_id IS 'auth.users id del cliente che ha creato l''ordine da vetrina (per verifica pagamento).';
  -- Allineamento con migrazioni turni cassa: la vista Ordine referenzia questa colonna.
  ALTER TABLE core.ordini ADD COLUMN IF NOT EXISTS turno_operatori_id INTEGER;
END
$e$;

-- Segreti gateway: mai esposti a anon/authenticated via REST; solo Edge (service_role).
DO $sec$
BEGIN
  IF to_regclass('admin.tenants') IS NULL THEN
    RAISE NOTICE 'admin.tenants assente: salto tenant_payment_secrets.';
    RETURN;
  END IF;

  CREATE TABLE IF NOT EXISTS admin.tenant_payment_secrets (
    tenant_id UUID PRIMARY KEY REFERENCES admin.tenants (id) ON DELETE CASCADE,
    stripe_secret TEXT,
    sumup_api_key TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );

  COMMENT ON TABLE admin.tenant_payment_secrets IS 'Chiavi segrete gateway (Stripe sk_, SumUp API): solo service_role / Edge Functions.';

  ALTER TABLE admin.tenant_payment_secrets ENABLE ROW LEVEL SECURITY;

  REVOKE ALL ON admin.tenant_payment_secrets FROM PUBLIC;
  REVOKE ALL ON admin.tenant_payment_secrets FROM anon;
  REVOKE ALL ON admin.tenant_payment_secrets FROM authenticated;
  GRANT ALL ON admin.tenant_payment_secrets TO service_role;
END
$sec$;

-- Staff: solo flag presenza segreto Stripe (no valore).
CREATE OR REPLACE FUNCTION public.tenant_payment_stripe_configured(p_tenant_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, admin
AS $fn$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'non autenticato';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.utenti_ruoli ur
    WHERE ur.user_id = auth.uid()
      AND ur.tenant_id = p_tenant_id
      AND COALESCE(ur.attivo, true) = true
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM admin.tenant_payment_secrets s
    WHERE s.tenant_id = p_tenant_id
      AND s.stripe_secret IS NOT NULL
      AND btrim(s.stripe_secret) <> ''
  );
END;
$fn$;

GRANT EXECUTE ON FUNCTION public.tenant_payment_stripe_configured(UUID) TO authenticated;

COMMENT ON FUNCTION public.tenant_payment_stripe_configured(UUID) IS
  'True se il tenant ha sk_ Stripe salvata (solo staff; non espone il segreto).';

CREATE OR REPLACE FUNCTION public.save_tenant_stripe_secret(p_tenant_id UUID, p_secret TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, admin
AS $save$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'non autenticato';
  END IF;
  IF p_secret IS NULL OR btrim(p_secret) NOT LIKE 'sk_%' THEN
    RAISE EXCEPTION 'chiave Stripe non valida (atteso sk_...)';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.utenti_ruoli ur
    WHERE ur.user_id = auth.uid()
      AND ur.tenant_id = p_tenant_id
      AND COALESCE(ur.attivo, true) = true
      AND lower(trim(COALESCE(ur.ruolo, ''))) = 'admin'
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  INSERT INTO admin.tenant_payment_secrets (tenant_id, stripe_secret, updated_at)
  VALUES (p_tenant_id, btrim(p_secret), now())
  ON CONFLICT (tenant_id) DO UPDATE
  SET stripe_secret = EXCLUDED.stripe_secret, updated_at = now();
END;
$save$;

GRANT EXECUTE ON FUNCTION public.save_tenant_stripe_secret(UUID, TEXT) TO authenticated;

COMMENT ON FUNCTION public.save_tenant_stripe_secret(UUID, TEXT) IS
  'Salva sk_ Stripe per il tenant (solo ruolo admin).';

CREATE OR REPLACE FUNCTION public.get_stripe_secret_for_tenant_edge(p_tenant_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, admin
AS $get$
DECLARE
  v_secret TEXT;
BEGIN
  IF COALESCE((auth.jwt())->>'role', '') IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT s.stripe_secret INTO v_secret
  FROM admin.tenant_payment_secrets s
  WHERE s.tenant_id = p_tenant_id;

  RETURN v_secret;
END;
$get$;

GRANT EXECUTE ON FUNCTION public.get_stripe_secret_for_tenant_edge(UUID) TO service_role;

COMMENT ON FUNCTION public.get_stripe_secret_for_tenant_edge(UUID) IS
  'Solo Edge (service_role): legge sk_ Stripe per PaymentIntent / rimborsi.';

CREATE OR REPLACE FUNCTION public.stripe_refund_allowed(p_ordine_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, core
STABLE
AS $rf$
  SELECT EXISTS (
    SELECT 1
    FROM core.ordini o
    JOIN public.utenti_ruoli ur ON ur.tenant_id = o.tenant_id
    WHERE o.id = p_ordine_id
      AND ur.user_id = p_user_id
      AND COALESCE(ur.attivo, true) = true
      AND (
        lower(trim(COALESCE(ur.ruolo, ''))) = 'admin'
        OR COALESCE(ur.accesso_cassa, false) = true
      )
  );
$rf$;

GRANT EXECUTE ON FUNCTION public.stripe_refund_allowed(UUID, UUID) TO service_role;

COMMENT ON FUNCTION public.stripe_refund_allowed(UUID, UUID) IS
  'Solo Edge (service_role): verifica se l''utente può rimborsare l''ordine.';

-- Ricrea create_order_with_items con web_cliente_user_id
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
  p_turno_operatori_id INTEGER DEFAULT NULL
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
  v_web_cliente uuid;
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

  RETURN v_ordine_id;
END;
$fn$;

GRANT EXECUTE ON FUNCTION public.create_order_with_items(
  UUID, NUMERIC, TEXT, JSONB, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT,
  DOUBLE PRECISION, DOUBLE PRECISION, JSONB, UUID, INTEGER
) TO authenticated;

COMMENT ON FUNCTION public.create_order_with_items(
  UUID, NUMERIC, TEXT, JSONB, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT,
  DOUBLE PRECISION, DOUBLE PRECISION, JSONB, UUID, INTEGER
) IS
  'Crea ordine + righe. web_cliente_user_id valorizzato se auth.uid() è cliente del tenant.';

-- Vista Ordine: online_payment
CREATE OR REPLACE FUNCTION public.ordine_instead_of_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, core
AS $tr$
BEGIN
  UPDATE core.ordini
  SET
    stato                 = COALESCE(NEW.stato, OLD.stato),
    totale                = COALESCE(NEW.totale, OLD.totale),
    note                  = COALESCE(NEW.note, OLD.note),
    tipo_pagamento        = COALESCE(NEW.tipo_pagamento, OLD.tipo_pagamento),
    tipo_ordine           = COALESCE(NEW.tipo_ordine, OLD.tipo_ordine),
    nome_cliente          = NEW.nome_cliente,
    orario_ritiro         = NEW.orario_ritiro,
    indirizzo_consegna    = NEW.indirizzo_consegna,
    consegna_lng          = COALESCE(NEW.consegna_lng, OLD.consegna_lng),
    consegna_lat          = COALESCE(NEW.consegna_lat, OLD.consegna_lat),
    pagamento_dettaglio   = COALESCE(NEW.pagamento_dettaglio, OLD.pagamento_dettaglio),
    stato_consegna        = COALESCE(NEW.stato_consegna, OLD.stato_consegna),
    punto_vendita_id      = COALESCE(NEW.punto_vendita_id, OLD.punto_vendita_id),
    turno_operatori_id    = COALESCE(NEW.turno_operatori_id, OLD.turno_operatori_id),
    online_payment        = COALESCE(NEW.online_payment, OLD.online_payment),
    updated_at            = now()
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
    turno_operatori_id,
    online_payment,
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

CREATE INDEX IF NOT EXISTS idx_ordini_online_payment_stripe_pi
  ON core.ordini ((online_payment->>'stripe_payment_intent_id'))
  WHERE (online_payment->>'stripe_payment_intent_id') IS NOT NULL;

-- Aggiornamenti ordine da webhook Stripe (solo service_role / Edge)
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
    stato = 'IN_PREPARAZIONE'::core.stato_ordine,
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

CREATE OR REPLACE FUNCTION public.edge_stripe_mark_payment_failed(
  p_payment_intent_id TEXT,
  p_message TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, core
AS $fail$
DECLARE
  v_id UUID;
BEGIN
  IF COALESCE((auth.jwt())->>'role', '') IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  UPDATE core.ordini o
  SET
    online_payment = COALESCE(o.online_payment, '{}'::jsonb) || jsonb_build_object(
      'provider', 'stripe',
      'stripe_payment_intent_id', p_payment_intent_id,
      'status', 'payment_failed',
      'failure_message', LEFT(COALESCE(p_message, ''), 2000)
    ),
    updated_at = now()
  WHERE (o.online_payment->>'stripe_payment_intent_id') IS NOT DISTINCT FROM p_payment_intent_id
  RETURNING o.id INTO v_id;

  RETURN v_id;
END;
$fail$;

GRANT EXECUTE ON FUNCTION public.edge_stripe_mark_payment_failed(TEXT, TEXT) TO service_role;

CREATE OR REPLACE FUNCTION public.edge_stripe_append_refund(
  p_payment_intent_id TEXT,
  p_refund_id TEXT,
  p_amount_cent INTEGER
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, core
AS $ref$
DECLARE
  v_id UUID;
  v_arr jsonb;
BEGIN
  IF COALESCE((auth.jwt())->>'role', '') IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT o.id, COALESCE(o.online_payment->'refunds', '[]'::jsonb)
  INTO v_id, v_arr
  FROM core.ordini o
  WHERE (o.online_payment->>'stripe_payment_intent_id') IS NOT DISTINCT FROM p_payment_intent_id
  LIMIT 1;

  IF v_id IS NULL THEN
    RETURN NULL;
  END IF;

  v_arr := COALESCE(v_arr, '[]'::jsonb) || jsonb_build_array(
    jsonb_build_object(
      'refund_id', p_refund_id,
      'amount_cent', p_amount_cent,
      'at', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
    )
  );

  UPDATE core.ordini o
  SET
    online_payment = COALESCE(o.online_payment, '{}'::jsonb) || jsonb_build_object('refunds', v_arr),
    updated_at = now()
  WHERE o.id = v_id;

  RETURN v_id;
END;
$ref$;

GRANT EXECUTE ON FUNCTION public.edge_stripe_append_refund(TEXT, TEXT, INTEGER) TO service_role;

CREATE OR REPLACE FUNCTION public.edge_ordine_snapshot_for_stripe(
  p_ordine_id UUID,
  p_user_id UUID
)
RETURNS TABLE (
  tenant_id UUID,
  totale NUMERIC,
  stato TEXT,
  stripe_provider TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, core, admin
AS $snap$
DECLARE
  v_web UUID;
  v_stato TEXT;
  v_tot NUMERIC;
  v_tid UUID;
  v_prov TEXT;
BEGIN
  IF COALESCE((auth.jwt())->>'role', '') IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT
    o.tenant_id,
    o.totale,
    o.stato::text,
    o.web_cliente_user_id,
    lower(trim(COALESCE(t.pagamento_online_provider, '')))
  INTO v_tid, v_tot, v_stato, v_web, v_prov
  FROM core.ordini o
  LEFT JOIN admin.tenants t ON t.id = o.tenant_id
  WHERE o.id = p_ordine_id;

  IF v_tid IS NULL THEN
    RAISE EXCEPTION 'ordine non trovato';
  END IF;
  IF v_web IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'ordine non associato al cliente';
  END IF;
  IF v_stato IS DISTINCT FROM 'IN_ATTESA' THEN
    RAISE EXCEPTION 'ordine non in attesa pagamento';
  END IF;
  IF v_prov IS DISTINCT FROM 'stripe' THEN
    RAISE EXCEPTION 'provider non stripe';
  END IF;

  RETURN QUERY SELECT v_tid, v_tot, v_stato, v_prov;
END;
$snap$;

GRANT EXECUTE ON FUNCTION public.edge_ordine_snapshot_for_stripe(UUID, UUID) TO service_role;

CREATE OR REPLACE FUNCTION public.edge_stripe_attach_payment_intent(
  p_ordine_id UUID,
  p_payment_intent_id TEXT,
  p_status TEXT,
  p_amount_cent INTEGER
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, core
AS $att$
BEGIN
  IF COALESCE((auth.jwt())->>'role', '') IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  UPDATE core.ordini o
  SET
    online_payment = jsonb_build_object(
      'provider', 'stripe',
      'stripe_payment_intent_id', p_payment_intent_id,
      'status', p_status,
      'amount_cent', p_amount_cent,
      'currency', 'eur'
    ),
    updated_at = now()
  WHERE o.id = p_ordine_id
    AND o.stato::text = 'IN_ATTESA';
END;
$att$;

GRANT EXECUTE ON FUNCTION public.edge_stripe_attach_payment_intent(UUID, TEXT, TEXT, INTEGER) TO service_role;

CREATE OR REPLACE FUNCTION public.edge_get_ordine_payment_context(p_ordine_id UUID)
RETURNS TABLE (tenant_id UUID, online_payment JSONB)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, core
STABLE
AS $ctx$
BEGIN
  IF COALESCE((auth.jwt())->>'role', '') IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  RETURN QUERY
  SELECT o.tenant_id, o.online_payment
  FROM core.ordini o
  WHERE o.id = p_ordine_id
  LIMIT 1;
END;
$ctx$;

GRANT EXECUTE ON FUNCTION public.edge_get_ordine_payment_context(UUID) TO service_role;
