-- =============================================================================
-- Fix sicurezza: vista public.tenants esposta senza RLS (SECURITY DEFINER)
-- =============================================================================
-- Trovato con audit di sicurezza (Supabase advisors, 2026-08-27): la vista
-- public.tenants era definita come SECURITY DEFINER, quindi bypassava
-- completamente la RLS della tabella sottostante admin.tenants (policy
-- pm_admin_tenants_tenant_access, che scopa correttamente per tenant tramite
-- pm_core_tenant_access(id)).
--
-- Effetto pratico prima del fix:
--  - anon poteva leggere SELECT su public.tenants: nome, stripe_customer_id,
--    stripe_subscription_id, partita_iva, email_fatturazione, pec,
--    codice_univoco_sdi, sconto_percentuale, email, telefono, indirizzo,
--    lat/lng, prova_valida_fino DI TUTTI I TENANT, senza autenticazione.
--  - authenticated (qualsiasi utente loggato di qualsiasi tenant) aveva
--    INSERT/UPDATE/DELETE su public.tenants senza restrizioni di RLS,
--    quindi poteva potenzialmente modificare/cancellare tenant altrui.
--
-- Fix: rendere la vista "security_invoker" (rispetta i permessi/RLS di chi
-- interroga, non del proprietario) e togliere del tutto l'accesso anonimo.
-- Con security_invoker=true, l'accesso di authenticated torna scoped al
-- proprio tenant grazie alla RLS già esistente su admin.tenants — non serve
-- toccare quei grant.
-- =============================================================================

ALTER VIEW public.tenants SET (security_invoker = true);

REVOKE ALL ON public.tenants FROM anon;

COMMENT ON VIEW public.tenants IS
  'Vista su admin.tenants, security_invoker=true dal 2026-08-27: rispetta la RLS di admin.tenants (pm_admin_tenants_tenant_access). Accesso anon rimosso: conteneva dati di fatturazione/fiscali di tutti i tenant.';
