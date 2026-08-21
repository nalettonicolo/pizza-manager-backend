-- =============================================================================
-- 50) Archivio password: SA/admin vedono anche account cliente del tenant
-- =============================================================================
-- staff_password_note può contenere note per user_id cliente (es. Cliente Test),
-- ma l’UI legge solo utenti_ruoli e SA non passa clienti clienti SELECT su public.clienti
-- (solo policy «own»). Aggiunge SELECT per tenant_admins e Super Admin.

DROP POLICY IF EXISTS "clienti_select_tenant_admin_or_sa" ON public.clienti;

CREATE POLICY "clienti_select_tenant_admin_or_sa" ON public.clienti
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.tenant_admins ta
      WHERE ta.user_id = auth.uid()
        AND ta.tenant_id = clienti.tenant_id
    )
    OR public.pm_auth_is_superadmin()
  );

COMMENT ON POLICY "clienti_select_tenant_admin_or_sa" ON public.clienti IS
  'Admin del locale e Super Admin: lettura anagrafica clienti del tenant (archivio password / supporto).';
