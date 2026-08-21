-- =============================================================================
-- 42) SumUp online checkout (hosted) — test/live per tenant
-- =============================================================================

CREATE OR REPLACE FUNCTION public.save_tenant_sumup_secret(p_tenant_id UUID, p_secret TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, admin
AS $save$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'non_autenticato';
  END IF;
  IF p_secret IS NULL OR btrim(p_secret) = '' THEN
    RAISE EXCEPTION 'chiave SumUp non valida';
  END IF;
  IF btrim(p_secret) !~ '^(sup_sk_|sk_test_|sk_live_)' THEN
    RAISE EXCEPTION 'chiave SumUp non valida (atteso sup_sk_…, sk_test_… o sk_live_…)';
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

  INSERT INTO admin.tenant_payment_secrets (tenant_id, sumup_api_key, updated_at)
  VALUES (p_tenant_id, btrim(p_secret), now())
  ON CONFLICT (tenant_id) DO UPDATE
  SET sumup_api_key = EXCLUDED.sumup_api_key, updated_at = now();
END;
$save$;

GRANT EXECUTE ON FUNCTION public.save_tenant_sumup_secret(UUID, TEXT) TO authenticated;

COMMENT ON FUNCTION public.save_tenant_sumup_secret(UUID, TEXT) IS
  'Salva API key SumUp per il tenant (solo ruolo admin).';

CREATE OR REPLACE FUNCTION public.tenant_payment_sumup_configured(p_tenant_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, admin
STABLE
AS $fn$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'non_autenticato';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.utenti_ruoli ur
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
      AND s.sumup_api_key IS NOT NULL
      AND btrim(s.sumup_api_key) <> ''
  );
END;
$fn$;

GRANT EXECUTE ON FUNCTION public.tenant_payment_sumup_configured(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_sumup_secret_for_tenant_edge(p_tenant_id UUID)
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

  SELECT s.sumup_api_key INTO v_secret
  FROM admin.tenant_payment_secrets s
  WHERE s.tenant_id = p_tenant_id;

  RETURN v_secret;
END;
$get$;

GRANT EXECUTE ON FUNCTION public.get_sumup_secret_for_tenant_edge(UUID) TO service_role;

CREATE OR REPLACE FUNCTION public.edge_ordine_snapshot_for_sumup(
  p_ordine_id UUID,
  p_user_id UUID
)
RETURNS TABLE (
  tenant_id UUID,
  totale NUMERIC,
  stato TEXT,
  merchant_code TEXT
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
  v_merchant TEXT;
BEGIN
  IF COALESCE((auth.jwt())->>'role', '') IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT
    o.tenant_id,
    o.totale,
    o.stato::text,
    o.web_cliente_user_id,
    lower(trim(COALESCE(t.pagamento_online_provider, ''))),
    upper(trim(COALESCE(t.sumup_merchant_public_id, '')))
  INTO v_tid, v_tot, v_stato, v_web, v_prov, v_merchant
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
  IF v_prov IS DISTINCT FROM 'sumup' THEN
    RAISE EXCEPTION 'provider non sumup';
  END IF;
  IF v_merchant IS NULL OR length(v_merchant) < 4 THEN
    RAISE EXCEPTION 'merchant code SumUp non configurato';
  END IF;

  RETURN QUERY SELECT v_tid, v_tot, v_stato, v_merchant;
END;
$snap$;

GRANT EXECUTE ON FUNCTION public.edge_ordine_snapshot_for_sumup(UUID, UUID) TO service_role;

CREATE OR REPLACE FUNCTION public.edge_sumup_attach_checkout(
  p_ordine_id UUID,
  p_checkout_id TEXT,
  p_status TEXT,
  p_amount NUMERIC
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
      'provider', 'sumup',
      'sumup_checkout_id', p_checkout_id,
      'status', p_status,
      'amount', p_amount,
      'currency', 'eur'
    ),
    updated_at = now()
  WHERE o.id = p_ordine_id
    AND o.stato::text = 'IN_ATTESA';
END;
$att$;

GRANT EXECUTE ON FUNCTION public.edge_sumup_attach_checkout(UUID, TEXT, TEXT, NUMERIC) TO service_role;

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
    stato = 'IN_PREPARAZIONE'::core.stato_ordine,
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

CREATE INDEX IF NOT EXISTS idx_ordini_online_payment_sumup_checkout
  ON core.ordini ((online_payment->>'sumup_checkout_id'))
  WHERE (online_payment->>'sumup_checkout_id') IS NOT NULL;

CREATE OR REPLACE FUNCTION public.tenant_online_payment_setup_status(p_tenant_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, admin
AS $status$
DECLARE
  v_prov TEXT;
  v_pk TEXT;
  v_merchant TEXT;
  v_sk BOOLEAN;
  v_wh BOOLEAN;
  v_sumup BOOLEAN;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'non_autenticato';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.utenti_ruoli ur
    WHERE ur.user_id = auth.uid()
      AND ur.tenant_id = p_tenant_id
      AND COALESCE(ur.attivo, true) = true
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT
    lower(trim(COALESCE(t.pagamento_online_provider, ''))),
    trim(COALESCE(t.stripe_publishable_key, '')),
    trim(COALESCE(t.sumup_merchant_public_id, ''))
  INTO v_prov, v_pk, v_merchant
  FROM admin.tenants t
  WHERE t.id = p_tenant_id;

  SELECT
    (s.stripe_secret IS NOT NULL AND btrim(s.stripe_secret) <> ''),
    (s.stripe_webhook_secret IS NOT NULL AND btrim(s.stripe_webhook_secret) <> ''),
    (s.sumup_api_key IS NOT NULL AND btrim(s.sumup_api_key) <> '')
  INTO v_sk, v_wh, v_sumup
  FROM admin.tenant_payment_secrets s
  WHERE s.tenant_id = p_tenant_id;

  v_sk := COALESCE(v_sk, false);
  v_wh := COALESCE(v_wh, false);
  v_sumup := COALESCE(v_sumup, false);

  RETURN jsonb_build_object(
    'provider', NULLIF(v_prov, ''),
    'stripe_publishable_configured', v_pk LIKE 'pk_%',
    'stripe_secret_configured', v_sk,
    'stripe_webhook_configured', v_wh,
    'sumup_merchant_configured', length(COALESCE(v_merchant, '')) >= 4,
    'sumup_secret_configured', v_sumup,
    'ready',
    CASE
      WHEN v_prov = 'stripe' THEN (v_pk LIKE 'pk_%' AND v_sk)
      WHEN v_prov = 'sumup' THEN (length(COALESCE(v_merchant, '')) >= 4 AND v_sumup)
      ELSE false
    END
  );
END;
$status$;

GRANT EXECUTE ON FUNCTION public.tenant_online_payment_setup_status(UUID) TO authenticated;
