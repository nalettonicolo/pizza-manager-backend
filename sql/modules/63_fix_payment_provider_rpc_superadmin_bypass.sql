-- Modulo 63 — Fix bypass Super Admin su salvataggio provider di pagamento online
--
-- Bug segnalato dall'utente: "non mi salva la chiave" (Admin -> Pagamenti online,
-- chiave pubblica Stripe non veniva persistita nel DB).
--
-- Causa: public.upsert_tenant_online_payment_provider e
-- public.save_tenant_payment_provider_secret controllavano ESCLUSIVAMENTE
-- utenti_ruoli.ruolo = 'admin' per il tenant target, senza il bypass per
-- Super Admin già introdotto nel modulo 54 (admin_update_punto_vendita_area:
-- v_is_superadmin OR v_is_tenant_admin). Un Super Admin che opera in
-- supporto/demo su un tenant (ruolo effettivo diverso da 'admin' su quel
-- tenant specifico) riceveva 'forbidden' dalla RPC; il salvataggio sembrava
-- non fare nulla perché il frontend non mostra un errore esplicito in quel
-- punto (vedi anche nota UX in checklist).
--
-- Verificato via query diretta: admin.tenants.stripe_publishable_key e
-- admin.tenant_online_payment_providers.public_config per il tenant
-- 95c0b10f-b677-4131-abd9-e60e8cf9e3bf risultavano invariati (ancora il
-- placeholder "pk_test_...") nonostante il tentativo di salvataggio recente,
-- confermando che la scrittura non arrivava mai al DB.
--
-- Fix: aggiunto public.pm_auth_is_superadmin() come bypass OR, stesso pattern
-- del modulo 54. Nessun'altra logica di business modificata.

CREATE OR REPLACE FUNCTION public.upsert_tenant_online_payment_provider(
  p_tenant_id uuid,
  p_provider_key text,
  p_enabled boolean,
  p_public_config jsonb DEFAULT NULL::jsonb,
  p_sort_order integer DEFAULT NULL::integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'admin'
AS $function$
DECLARE
  v_key TEXT := lower(trim(COALESCE(p_provider_key, '')));
  v_config JSONB := COALESCE(p_public_config, '{}'::jsonb);
  v_sort INT;
  v_is_superadmin BOOLEAN;
  v_is_tenant_admin BOOLEAN;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'non_autenticato';
  END IF;
  IF v_key NOT IN ('stripe', 'sumup', 'satispay', 'nexi', 'paypal') THEN
    RAISE EXCEPTION 'provider non valido';
  END IF;

  SELECT public.pm_auth_is_superadmin() INTO v_is_superadmin;
  SELECT EXISTS (
    SELECT 1 FROM public.utenti_ruoli ur
    WHERE ur.user_id = auth.uid()
      AND ur.tenant_id = p_tenant_id
      AND COALESCE(ur.attivo, true) = true
      AND lower(trim(COALESCE(ur.ruolo, ''))) = 'admin'
  ) INTO v_is_tenant_admin;

  IF NOT COALESCE(v_is_superadmin, false) AND NOT v_is_tenant_admin THEN
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

  IF v_key = 'stripe' THEN
    UPDATE admin.tenants t
    SET stripe_publishable_key = NULLIF(btrim(COALESCE(v_config->>'stripe_publishable_key', t.stripe_publishable_key, '')), '')
    WHERE t.id = p_tenant_id;
  ELSIF v_key = 'sumup' THEN
    UPDATE admin.tenants t
    SET sumup_merchant_public_id = NULLIF(upper(btrim(COALESCE(v_config->>'sumup_merchant_public_id', t.sumup_merchant_public_id, ''))), '')
    WHERE t.id = p_tenant_id;
  END IF;

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
$function$;

CREATE OR REPLACE FUNCTION public.save_tenant_payment_provider_secret(p_tenant_id uuid, p_provider_key text, p_secret text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'admin'
AS $function$
DECLARE
  v_key TEXT := lower(trim(COALESCE(p_provider_key, '')));
  v_secret TEXT := btrim(COALESCE(p_secret, ''));
  v_is_superadmin BOOLEAN;
  v_is_tenant_admin BOOLEAN;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'non_autenticato';
  END IF;
  IF v_secret = '' THEN
    RAISE EXCEPTION 'segreto non valido';
  END IF;

  SELECT public.pm_auth_is_superadmin() INTO v_is_superadmin;
  SELECT EXISTS (
    SELECT 1 FROM public.utenti_ruoli ur
    WHERE ur.user_id = auth.uid()
      AND ur.tenant_id = p_tenant_id
      AND COALESCE(ur.attivo, true) = true
      AND lower(trim(COALESCE(ur.ruolo, ''))) = 'admin'
  ) INTO v_is_tenant_admin;

  IF NOT COALESCE(v_is_superadmin, false) AND NOT v_is_tenant_admin THEN
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
$function$;
