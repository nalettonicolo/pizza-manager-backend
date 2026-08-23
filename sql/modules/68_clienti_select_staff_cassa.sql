-- =============================================================================
-- 68) Cassa/staff: SELECT su public.clienti del proprio tenant
-- =============================================================================
-- La ricerca clienti in cassa unisce anagrafica_clienti + clienti (account menù online).
-- Policy 50: solo tenant_admins / SA. Qui: qualsiasi utente con ruolo operativo
-- sul tenant (utenti_ruoli) può leggere i clienti del locale (nome, telefono, indirizzo).

DROP POLICY IF EXISTS "clienti_select_staff_tenant" ON public.clienti;

CREATE POLICY "clienti_select_staff_tenant" ON public.clienti
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.utenti_ruoli ur
      WHERE ur.user_id = (SELECT auth.uid())
        AND ur.tenant_id = clienti.tenant_id
    )
    OR EXISTS (
      SELECT 1
      FROM public.tenant_admins ta
      WHERE ta.user_id = (SELECT auth.uid())
        AND ta.tenant_id = clienti.tenant_id
    )
    OR public.pm_auth_is_superadmin()
  );

COMMENT ON POLICY "clienti_select_staff_tenant" ON public.clienti IS
  'Staff con ruolo sul tenant (cassa/operativo): lettura clienti web del locale per ricerca in cassa.';
