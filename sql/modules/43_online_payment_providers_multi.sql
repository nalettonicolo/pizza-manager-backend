-- =============================================================================
-- 43) Pagamenti online multi-provider (Stripe, SumUp, Satispay, Nexi, PayPal)
-- Il cliente in vetrina sceglie tra i gestori abilitati e pronti.
-- =============================================================================

CREATE TABLE IF NOT EXISTS admin.tenant_online_payment_providers (
  tenant_id UUID NOT NULL REFERENCES admin.tenants(id) ON DELETE CASCADE,
  provider_key TEXT NOT NULL CHECK (
    provider_key IN ('stripe', 'sumup', 'satispay', 'nexi', 'paypal')
  ),
  enabled BOOLEAN NOT NULL DEFAULT false,
  public_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  sort_order INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, provider_key)
);

COMMENT ON TABLE admin.tenant_online_payment_providers IS
  'Gestori pagamento online abilitati per tenant (vetrina). Segreti in tenant_payment_secrets.';

ALTER TABLE admin.tenant_payment_secrets
  ADD COLUMN IF NOT EXISTS provider_secrets JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN admin.tenant_payment_secrets.provider_secrets IS
  'Segreti PSP aggiuntivi keyed by provider (satispay, nexi, paypal). Stripe/SumUp restano nelle colonne dedicate.';

-- Seed da colonne legacy (idempotente)
INSERT INTO admin.tenant_online_payment_providers (tenant_id, provider_key, enabled, public_config, sort_order)
SELECT
  t.id,
  'stripe',
  (
    lower(trim(COALESCE(t.pagamento_online_provider, ''))) = 'stripe'
    OR (t.stripe_publishable_key IS NOT NULL AND btrim(t.stripe_publishable_key) <> '')
  ),
  jsonb_strip_nulls(jsonb_build_object(
    'stripe_publishable_key', NULLIF(btrim(COALESCE(t.stripe_publishable_key, '')), '')
  )),
  10
FROM admin.tenants t
ON CONFLICT (tenant_id, provider_key) DO UPDATE
SET
  enabled = EXCLUDED.enabled OR admin.tenant_online_payment_providers.enabled,
  public_config = admin.tenant_online_payment_providers.public_config
    || EXCLUDED.public_config,
  updated_at = now();

INSERT INTO admin.tenant_online_payment_providers (tenant_id, provider_key, enabled, public_config, sort_order)
SELECT
  t.id,
  'sumup',
  (
    lower(trim(COALESCE(t.pagamento_online_provider, ''))) = 'sumup'
    OR (t.sumup_merchant_public_id IS NOT NULL AND btrim(t.sumup_merchant_public_id) <> '')
  ),
  jsonb_strip_nulls(jsonb_build_object(
    'sumup_merchant_public_id', NULLIF(upper(btrim(COALESCE(t.sumup_merchant_public_id, ''))), '')
  )),
  20
FROM admin.tenants t
ON CONFLICT (tenant_id, provider_key) DO UPDATE
SET
  enabled = EXCLUDED.enabled OR admin.tenant_online_payment_providers.enabled,
  public_config = admin.tenant_online_payment_providers.public_config
    || EXCLUDED.public_config,
  updated_at = now();

-- Placeholder righe per altri gestori (disabilitati)
INSERT INTO admin.tenant_online_payment_providers (tenant_id, provider_key, enabled, sort_order)
SELECT t.id, k.provider_key, false, k.sort_order
FROM admin.tenants t
CROSS JOIN (
  VALUES ('satispay', 30), ('nexi', 40), ('paypal', 50)
) AS k(provider_key, sort_order)
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public._payment_provider_ready(
  p_provider_key TEXT,
  p_public JSONB,
  p_stripe_secret BOOLEAN,
  p_sumup_secret BOOLEAN,
  p_provider_secrets JSONB
)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
AS $ready$
DECLARE
  v_pub JSONB := COALESCE(p_public, '{}'::jsonb);
  v_sec JSONB := COALESCE(p_provider_secrets, '{}'::jsonb);
BEGIN
  CASE lower(trim(COALESCE(p_provider_key, '')))
    WHEN 'stripe' THEN
      RETURN COALESCE(v_pub->>'stripe_publishable_key', '') LIKE 'pk_%'
        AND COALESCE(p_stripe_secret, false);
    WHEN 'sumup' THEN
      RETURN length(COALESCE(v_pub->>'sumup_merchant_public_id', '')) >= 4
        AND COALESCE(p_sumup_secret, false);
    WHEN 'satispay' THEN
      RETURN length(COALESCE(v_pub->>'satispay_key_id', '')) >= 3
        AND btrim(COALESCE(v_sec->'satispay'->>'token', '')) <> '';
    WHEN 'nexi' THEN
      RETURN length(COALESCE(v_pub->>'nexi_alias', '')) >= 3
        AND btrim(COALESCE(v_sec->'nexi'->>'api_key', '')) <> '';
    WHEN 'paypal' THEN
      RETURN length(COALESCE(v_pub->>'paypal_client_id', '')) >= 8
        AND btrim(COALESCE(v_sec->'paypal'->>'secret', '')) <> '';
    ELSE
      RETURN false;
  END CASE;
END;
$ready$;

CREATE OR REPLACE FUNCTION public.list_tenant_online_payment_providers(p_tenant_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, admin
STABLE
AS $list$
DECLARE
  v_stripe BOOLEAN;
  v_sumup BOOLEAN;
  v_provider_secrets JSONB;
  v_rows JSONB;
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
    (s.stripe_secret IS NOT NULL AND btrim(s.stripe_secret) <> ''),
    (s.sumup_api_key IS NOT NULL AND btrim(s.sumup_api_key) <> ''),
    COALESCE(s.provider_secrets, '{}'::jsonb)
  INTO v_stripe, v_sumup, v_provider_secrets
  FROM admin.tenant_payment_secrets s
  WHERE s.tenant_id = p_tenant_id;

  v_stripe := COALESCE(v_stripe, false);
  v_sumup := COALESCE(v_sumup, false);
  v_provider_secrets := COALESCE(v_provider_secrets, '{}'::jsonb);

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'provider_key', p.provider_key,
      'enabled', p.enabled,
      'public_config', p.public_config,
      'sort_order', p.sort_order,
      'ready', public._payment_provider_ready(
        p.provider_key,
        p.public_config,
        v_stripe,
        v_sumup,
        v_provider_secrets
      ),
      'secret_configured', CASE p.provider_key
        WHEN 'stripe' THEN v_stripe
        WHEN 'sumup' THEN v_sumup
        WHEN 'satispay' THEN btrim(COALESCE(v_provider_secrets->'satispay'->>'token', '')) <> ''
        WHEN 'nexi' THEN btrim(COALESCE(v_provider_secrets->'nexi'->>'api_key', '')) <> ''
        WHEN 'paypal' THEN btrim(COALESCE(v_provider_secrets->'paypal'->>'secret', '')) <> ''
        ELSE false
      END
    )
    ORDER BY p.sort_order, p.provider_key
  ), '[]'::jsonb)
  INTO v_rows
  FROM admin.tenant_online_payment_providers p
  WHERE p.tenant_id = p_tenant_id;

  RETURN v_rows;
END;
$list$;

GRANT EXECUTE ON FUNCTION public.list_tenant_online_payment_providers(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.upsert_tenant_online_payment_provider(
  p_tenant_id UUID,
  p_provider_key TEXT,
  p_enabled BOOLEAN,
  p_public_config JSONB DEFAULT NULL,
  p_sort_order INT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, admin
AS $upsert$
DECLARE
  v_key TEXT := lower(trim(COALESCE(p_provider_key, '')));
  v_config JSONB := COALESCE(p_public_config, '{}'::jsonb);
  v_sort INT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'non_autenticato';
  END IF;
  IF v_key NOT IN ('stripe', 'sumup', 'satispay', 'nexi', 'paypal') THEN
    RAISE EXCEPTION 'provider non valido';
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

  v_sort := COALESCE(p_sort_order, CASE v_key
    WHEN 'stripe' THEN 10
    WHEN 'sumup' THEN 20
    WHEN 'satispay' THEN 30
    WHEN 'nexi' THEN 40
    WHEN 'paypal' THEN 50
    ELSE 99
  END);

  INSERT INTO admin.tenant_online_payment_providers (
    tenant_id, provider_key, enabled, public_config, sort_order, updated_at
  )
  VALUES (p_tenant_id, v_key, COALESCE(p_enabled, false), v_config, v_sort, now())
  ON CONFLICT (tenant_id, provider_key) DO UPDATE
  SET
    enabled = COALESCE(p_enabled, admin.tenant_online_payment_providers.enabled),
    public_config = CASE
      WHEN p_public_config IS NULL THEN admin.tenant_online_payment_providers.public_config
      ELSE admin.tenant_online_payment_providers.public_config || p_public_config
    END,
    sort_order = v_sort,
    updated_at = now();

  -- Sync colonne legacy per Stripe / SumUp (compat checkout edge attuale)
  IF v_key = 'stripe' THEN
    UPDATE admin.tenants t
    SET stripe_publishable_key = NULLIF(btrim(COALESCE(v_config->>'stripe_publishable_key', t.stripe_publishable_key, '')), '')
    WHERE t.id = p_tenant_id;
  ELSIF v_key = 'sumup' THEN
    UPDATE admin.tenants t
    SET sumup_merchant_public_id = NULLIF(upper(btrim(COALESCE(v_config->>'sumup_merchant_public_id', t.sumup_merchant_public_id, ''))), '')
    WHERE t.id = p_tenant_id;
  END IF;

  -- pagamento_online_provider legacy: primo abilitato+pronto, altrimenti null se nessuno
  UPDATE admin.tenants t
  SET pagamento_online_provider = (
    SELECT p.provider_key
    FROM admin.tenant_online_payment_providers p
    WHERE p.tenant_id = p_tenant_id AND p.enabled = true
    ORDER BY p.sort_order, p.provider_key
    LIMIT 1
  )
  WHERE t.id = p_tenant_id;

  RETURN public.list_tenant_online_payment_providers(p_tenant_id);
END;
$upsert$;

GRANT EXECUTE ON FUNCTION public.upsert_tenant_online_payment_provider(UUID, TEXT, BOOLEAN, JSONB, INT) TO authenticated;

CREATE OR REPLACE FUNCTION public.save_tenant_payment_provider_secret(
  p_tenant_id UUID,
  p_provider_key TEXT,
  p_secret TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, admin
AS $save$
DECLARE
  v_key TEXT := lower(trim(COALESCE(p_provider_key, '')));
  v_secret TEXT := btrim(COALESCE(p_secret, ''));
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'non_autenticato';
  END IF;
  IF v_secret = '' THEN
    RAISE EXCEPTION 'segreto non valido';
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

  IF v_key = 'stripe' THEN
    PERFORM public.save_tenant_stripe_secret(p_tenant_id, v_secret);
    RETURN;
  ELSIF v_key = 'sumup' THEN
    PERFORM public.save_tenant_sumup_secret(p_tenant_id, v_secret);
    RETURN;
  ELSIF v_key NOT IN ('satispay', 'nexi', 'paypal') THEN
    RAISE EXCEPTION 'provider non valido';
  END IF;

  INSERT INTO admin.tenant_payment_secrets (tenant_id, provider_secrets, updated_at)
  VALUES (
    p_tenant_id,
    jsonb_build_object(v_key, jsonb_build_object(
      CASE v_key
        WHEN 'satispay' THEN 'token'
        WHEN 'nexi' THEN 'api_key'
        WHEN 'paypal' THEN 'secret'
      END,
      v_secret
    )),
    now()
  )
  ON CONFLICT (tenant_id) DO UPDATE
  SET
    provider_secrets = COALESCE(admin.tenant_payment_secrets.provider_secrets, '{}'::jsonb)
      || EXCLUDED.provider_secrets,
    updated_at = now();
END;
$save$;

GRANT EXECUTE ON FUNCTION public.save_tenant_payment_provider_secret(UUID, TEXT, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.tenant_payment_provider_secret_configured(
  p_tenant_id UUID,
  p_provider_key TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, admin
STABLE
AS $cfg$
DECLARE
  v_key TEXT := lower(trim(COALESCE(p_provider_key, '')));
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

  IF v_key = 'stripe' THEN
    RETURN public.tenant_payment_stripe_configured(p_tenant_id);
  ELSIF v_key = 'sumup' THEN
    RETURN public.tenant_payment_sumup_configured(p_tenant_id);
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM admin.tenant_payment_secrets s
    WHERE s.tenant_id = p_tenant_id
      AND btrim(COALESCE(
        CASE v_key
          WHEN 'satispay' THEN s.provider_secrets->'satispay'->>'token'
          WHEN 'nexi' THEN s.provider_secrets->'nexi'->>'api_key'
          WHEN 'paypal' THEN s.provider_secrets->'paypal'->>'secret'
        END,
        ''
      )) <> ''
  );
END;
$cfg$;

GRANT EXECUTE ON FUNCTION public.tenant_payment_provider_secret_configured(UUID, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.tenant_online_payment_setup_status(p_tenant_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, admin
STABLE
AS $status$
DECLARE
  v_providers JSONB;
  v_enabled_ready INT;
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

  v_providers := public.list_tenant_online_payment_providers(p_tenant_id);

  SELECT count(*)::int INTO v_enabled_ready
  FROM jsonb_array_elements(v_providers) elem
  WHERE (elem->>'enabled')::boolean = true
    AND (elem->>'ready')::boolean = true;

  RETURN jsonb_build_object(
    'providers', v_providers,
    'enabled_ready_count', COALESCE(v_enabled_ready, 0),
    'ready', COALESCE(v_enabled_ready, 0) > 0,
    -- legacy fields (primo provider abilitato)
    'provider', (
      SELECT elem->>'provider_key'
      FROM jsonb_array_elements(v_providers) elem
      WHERE (elem->>'enabled')::boolean = true
      ORDER BY (elem->>'sort_order')::int
      LIMIT 1
    ),
    'stripe_publishable_configured', EXISTS (
      SELECT 1 FROM jsonb_array_elements(v_providers) e
      WHERE e->>'provider_key' = 'stripe'
        AND COALESCE(e->'public_config'->>'stripe_publishable_key', '') LIKE 'pk_%'
    ),
    'stripe_secret_configured', public.tenant_payment_stripe_configured(p_tenant_id),
    'stripe_webhook_configured', public.tenant_stripe_webhook_configured(p_tenant_id),
    'sumup_merchant_configured', EXISTS (
      SELECT 1 FROM jsonb_array_elements(v_providers) e
      WHERE e->>'provider_key' = 'sumup'
        AND length(COALESCE(e->'public_config'->>'sumup_merchant_public_id', '')) >= 4
    ),
    'sumup_secret_configured', public.tenant_payment_sumup_configured(p_tenant_id)
  );
END;
$status$;

GRANT EXECUTE ON FUNCTION public.tenant_online_payment_setup_status(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_public_online_payment_providers(p_tenant_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, admin
STABLE
AS $pub$
DECLARE
  v_stripe BOOLEAN;
  v_sumup BOOLEAN;
  v_provider_secrets JSONB;
BEGIN
  IF p_tenant_id IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  SELECT
    (s.stripe_secret IS NOT NULL AND btrim(s.stripe_secret) <> ''),
    (s.sumup_api_key IS NOT NULL AND btrim(s.sumup_api_key) <> ''),
    COALESCE(s.provider_secrets, '{}'::jsonb)
  INTO v_stripe, v_sumup, v_provider_secrets
  FROM admin.tenant_payment_secrets s
  WHERE s.tenant_id = p_tenant_id;

  v_stripe := COALESCE(v_stripe, false);
  v_sumup := COALESCE(v_sumup, false);

  RETURN COALESCE((
    SELECT jsonb_agg(
      jsonb_build_object(
        'provider_key', p.provider_key,
        'public_config', p.public_config,
        'sort_order', p.sort_order
      )
      ORDER BY p.sort_order, p.provider_key
    )
    FROM admin.tenant_online_payment_providers p
    WHERE p.tenant_id = p_tenant_id
      AND p.enabled = true
      AND public._payment_provider_ready(
        p.provider_key,
        p.public_config,
        v_stripe,
        v_sumup,
        v_provider_secrets
      )
      -- Solo gestori con checkout implementato (edge). Satispay/Nexi/PayPal esclusi finché non live.
      AND p.provider_key IN ('stripe', 'sumup')
  ), '[]'::jsonb);
END;
$pub$;

GRANT EXECUTE ON FUNCTION public.get_public_online_payment_providers(UUID) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_public_tenant_by_id(p_tenant_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, core, admin, pg_temp
AS $$
DECLARE
  v_row JSONB;
BEGIN
  IF p_tenant_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT jsonb_build_object(
    'id', t.id,
    'nome', t.nome,
    'slug', t.slug,
    'logo_url', t.logo_url,
    'attivo', COALESCE(t.attivo, true),
    'piano', t.piano,
    'email', t.email,
    'telefono', t.telefono,
    'parametri_operativi', public.pm_public_parametri_operativi(COALESCE(t.parametri_operativi, '{}'::JSONB)),
    'orari_settimana', t.orari_settimana,
    'indirizzo', t.indirizzo,
    'legal_ragione_sociale', t.legal_ragione_sociale,
    'legal_piva', t.legal_piva,
    'legal_pec', t.legal_pec,
    'privacy_policy_html', t.privacy_policy_html,
    'cookie_policy_html', t.cookie_policy_html,
    'pagamento_online_provider', t.pagamento_online_provider,
    'stripe_publishable_key', t.stripe_publishable_key,
    'sumup_merchant_public_id', t.sumup_merchant_public_id,
    'online_payment_providers', public.get_public_online_payment_providers(t.id)
  )
  INTO v_row
  FROM admin.tenants t
  WHERE t.id = p_tenant_id
    AND COALESCE(t.attivo, true) = true
    AND t.deleted_at IS NULL;

  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_tenant_by_id(UUID) TO anon, authenticated;

-- Snapshot SumUp: accetta ordine se SumUp è tra i provider abilitati (non solo legacy scalar)
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
  v_merchant TEXT;
  v_sumup_enabled BOOLEAN;
BEGIN
  IF COALESCE((auth.jwt())->>'role', '') IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT
    o.tenant_id,
    o.totale,
    o.stato::text,
    o.web_cliente_user_id,
    upper(trim(COALESCE(
      (SELECT p.public_config->>'sumup_merchant_public_id'
       FROM admin.tenant_online_payment_providers p
       WHERE p.tenant_id = o.tenant_id AND p.provider_key = 'sumup'),
      t.sumup_merchant_public_id,
      ''
    )))
  INTO v_tid, v_tot, v_stato, v_web, v_merchant
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

  SELECT EXISTS (
    SELECT 1 FROM admin.tenant_online_payment_providers p
    WHERE p.tenant_id = v_tid AND p.provider_key = 'sumup' AND p.enabled = true
  ) INTO v_sumup_enabled;

  IF NOT v_sumup_enabled AND lower(trim(COALESCE(
    (SELECT t.pagamento_online_provider FROM admin.tenants t WHERE t.id = v_tid), ''
  ))) IS DISTINCT FROM 'sumup' THEN
    v_sumup_enabled := true;
  END IF;

  IF NOT COALESCE(v_sumup_enabled, false) THEN
    RAISE EXCEPTION 'SumUp non abilitato per questo locale';
  END IF;

  IF v_merchant IS NULL OR length(v_merchant) < 4 THEN
    RAISE EXCEPTION 'merchant code SumUp non configurato';
  END IF;

  RETURN QUERY SELECT v_tid, v_tot, v_stato, v_merchant;
END;
$snap$;
