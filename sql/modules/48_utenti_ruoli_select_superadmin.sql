-- =============================================================================
-- 48) Super Admin: SELECT su utenti_ruoli (archivio password / ruoli_pizzeria)
-- =============================================================================
-- Con security_invoker=on sulla vista ruoli_pizzeria, RLS di utenti_ruoli filtra
-- le righe prima del WHERE della vista. SA vedeva solo la propria riga
-- (admin@…) e quindi una sola nota in Archivio password, nonostante le altre
-- note esistessero in staff_password_note.
--
-- Helper SECURITY DEFINER evita ricorsione RLS sulla stessa tabella.

CREATE OR REPLACE FUNCTION public.pm_auth_is_superadmin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.utenti_ruoli ur
    WHERE ur.user_id = auth.uid()
      AND COALESCE(ur.attivo, true) IS DISTINCT FROM false
      AND lower(trim(COALESCE(ur.ruolo, ''))) IN ('superadmin', 'super_admin')
  );
$$;

COMMENT ON FUNCTION public.pm_auth_is_superadmin() IS
  'True se auth.uid() ha ruolo superadmin in utenti_ruoli (bypass RLS; per policy).';

REVOKE ALL ON FUNCTION public.pm_auth_is_superadmin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pm_auth_is_superadmin() TO authenticated;

DROP POLICY IF EXISTS "utenti_ruoli_select_own" ON public.utenti_ruoli;

CREATE POLICY "utenti_ruoli_select_own" ON public.utenti_ruoli
  FOR SELECT
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1
      FROM public.tenant_admins a
      WHERE a.user_id = auth.uid()
        AND a.tenant_id = utenti_ruoli.tenant_id
    )
    OR public.pm_auth_is_superadmin()
  );
