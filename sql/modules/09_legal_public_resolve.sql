
-- =============================================================================
-- 9) Vetrina cliente: campi normativi e pagamenti (policy HTML + Stripe/SumUp predisposizione)
-- =============================================================================

DO $legal$
BEGIN
  IF to_regclass('admin.tenants') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE admin.tenants ADD COLUMN IF NOT EXISTS legal_ragione_sociale TEXT';
    EXECUTE 'ALTER TABLE admin.tenants ADD COLUMN IF NOT EXISTS legal_piva TEXT';
    EXECUTE 'ALTER TABLE admin.tenants ADD COLUMN IF NOT EXISTS legal_pec TEXT';
    EXECUTE 'ALTER TABLE admin.tenants ADD COLUMN IF NOT EXISTS privacy_policy_html TEXT';
    EXECUTE 'ALTER TABLE admin.tenants ADD COLUMN IF NOT EXISTS cookie_policy_html TEXT';
    EXECUTE 'ALTER TABLE admin.tenants ADD COLUMN IF NOT EXISTS pagamento_online_provider TEXT';
    EXECUTE 'ALTER TABLE admin.tenants ADD COLUMN IF NOT EXISTS stripe_publishable_key TEXT';
    EXECUTE 'ALTER TABLE admin.tenants ADD COLUMN IF NOT EXISTS sumup_merchant_public_id TEXT';
    COMMENT ON COLUMN admin.tenants.privacy_policy_html IS 'HTML informativa privacy vetrina; se NULL si usa testo predefinito app.';
    COMMENT ON COLUMN admin.tenants.cookie_policy_html IS 'HTML cookie policy vetrina; se NULL si usa testo predefinito app.';
    COMMENT ON COLUMN admin.tenants.pagamento_online_provider IS 'stripe | sumup | null â€” checkout pubblico.';
    COMMENT ON COLUMN admin.tenants.stripe_publishable_key IS 'Chiave pubblica Stripe (pk_...), sicura in client.';
  END IF;
END
$legal$;

CREATE OR REPLACE FUNCTION public.resolve_public_tenant_by_domain(p_host text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, admin
AS $$
  SELECT to_jsonb(t)
  FROM (
    SELECT
      id,
      nome,
      logo_url,
      indirizzo,
      email,
      telefono,
      orari_settimana,
      parametri_operativi,
      legal_ragione_sociale,
      legal_piva,
      legal_pec,
      privacy_policy_html,
      cookie_policy_html,
      pagamento_online_provider,
      stripe_publishable_key,
      sumup_merchant_public_id
    FROM admin.tenants
    WHERE deleted_at IS NULL
      AND (attivo IS NULL OR attivo = true)
      AND (
        (
          public_domain IS NOT NULL
          AND btrim(public_domain) <> ''
          AND lower(btrim(public_domain)) = lower(btrim(p_host))
        )
        OR (
          lower(btrim(p_host)) LIKE '%.pizzamanager.it'
          AND lower(btrim(slug)) = lower(split_part(btrim(p_host), '.', 1))
        )
      )
    LIMIT 1
  ) t;
$$;

COMMENT ON FUNCTION public.resolve_public_tenant_by_domain(text) IS 'Menu pubblico: risolve tenant da hostname (dominio cliente collegato in admin.tenants.public_domain).';
