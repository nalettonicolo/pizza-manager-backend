
-- =============================================================================
-- 17) Stripe online: conferma client + webhook secret per tenant
-- =============================================================================

DO $wh$
BEGIN
  IF to_regclass('admin.tenant_payment_secrets') IS NOT NULL THEN
    ALTER TABLE admin.tenant_payment_secrets
      ADD COLUMN IF NOT EXISTS stripe_webhook_secret TEXT;
    COMMENT ON COLUMN admin.tenant_payment_secrets.stripe_webhook_secret IS
      'Signing secret webhook Stripe (whsec_...) per questo tenant; opzionale se si usa STRIPE_WEBHOOK_SECRET globale Edge.';
  END IF;
END
$wh$;

CREATE OR REPLACE FUNCTION public.get_tenant_id_by_stripe_payment_intent(p_payment_intent_id TEXT)
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, core
STABLE
AS $$
  SELECT o.tenant_id
  FROM core.ordini o
  WHERE (o.online_payment->>'stripe_payment_intent_id') IS NOT DISTINCT FROM p_payment_intent_id
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_tenant_id_by_stripe_payment_intent(TEXT) TO service_role;

CREATE OR REPLACE FUNCTION public.get_stripe_webhook_secret_for_tenant_edge(p_tenant_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, admin
AS $gwh$
DECLARE
  v_secret TEXT;
BEGIN
  IF COALESCE((auth.jwt())->>'role', '') IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT s.stripe_webhook_secret INTO v_secret
  FROM admin.tenant_payment_secrets s
  WHERE s.tenant_id = p_tenant_id
    AND s.stripe_webhook_secret IS NOT NULL
    AND btrim(s.stripe_webhook_secret) <> '';

  RETURN v_secret;
END;
$gwh$;

GRANT EXECUTE ON FUNCTION public.get_stripe_webhook_secret_for_tenant_edge(UUID) TO service_role;

CREATE OR REPLACE FUNCTION public.tenant_stripe_webhook_configured(p_tenant_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, admin
AS $twc$
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
    SELECT 1 FROM admin.tenant_payment_secrets s
    WHERE s.tenant_id = p_tenant_id
      AND s.stripe_webhook_secret IS NOT NULL
      AND btrim(s.stripe_webhook_secret) <> ''
  );
END;
$twc$;

GRANT EXECUTE ON FUNCTION public.tenant_stripe_webhook_configured(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.save_tenant_stripe_webhook_secret(p_tenant_id UUID, p_secret TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, admin
AS $swh$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'non_autenticato';
  END IF;
  IF p_secret IS NULL OR btrim(p_secret) NOT LIKE 'whsec_%' THEN
    RAISE EXCEPTION 'webhook secret non valido (atteso whsec_...)';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.utenti_ruoli ur
    WHERE ur.user_id = auth.uid()
      AND ur.tenant_id = p_tenant_id
      AND COALESCE(ur.attivo, true) = true
      AND lower(trim(COALESCE(ur.ruolo, ''))) = 'admin'
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  INSERT INTO admin.tenant_payment_secrets (tenant_id, stripe_webhook_secret, updated_at)
  VALUES (p_tenant_id, btrim(p_secret), now())
  ON CONFLICT (tenant_id) DO UPDATE
  SET stripe_webhook_secret = EXCLUDED.stripe_webhook_secret, updated_at = now();
END;
$swh$;

GRANT EXECUTE ON FUNCTION public.save_tenant_stripe_webhook_secret(UUID, TEXT) TO authenticated;

-- Staff: stato configurazione pagamenti online (nessun segreto esposto)
CREATE OR REPLACE FUNCTION public.tenant_online_payment_setup_status(p_tenant_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, admin
AS $status$
DECLARE
  v_prov TEXT;
  v_pk TEXT;
  v_sk BOOLEAN;
  v_wh BOOLEAN;
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
    trim(COALESCE(t.stripe_publishable_key, ''))
  INTO v_prov, v_pk
  FROM admin.tenants t
  WHERE t.id = p_tenant_id;

  SELECT
    (s.stripe_secret IS NOT NULL AND btrim(s.stripe_secret) <> ''),
    (s.stripe_webhook_secret IS NOT NULL AND btrim(s.stripe_webhook_secret) <> '')
  INTO v_sk, v_wh
  FROM admin.tenant_payment_secrets s
  WHERE s.tenant_id = p_tenant_id;

  v_sk := COALESCE(v_sk, false);
  v_wh := COALESCE(v_wh, false);

  RETURN jsonb_build_object(
    'provider', NULLIF(v_prov, ''),
    'stripe_publishable_configured', v_pk LIKE 'pk_%',
    'stripe_secret_configured', v_sk,
    'stripe_webhook_configured', v_wh,
    'ready',
    (v_prov = 'stripe' AND v_pk LIKE 'pk_%' AND v_sk)
  );
END;
$status$;

GRANT EXECUTE ON FUNCTION public.tenant_online_payment_setup_status(UUID) TO authenticated;
