-- =============================================================================
-- 38) Chiudi residui advisor sicurezza post 34/35
-- =============================================================================
-- Snapshot advisor dopo 34/35 (~45 WARN):
--   - function_search_path_mutable: pm_storage_path_tenant_id
--   - rls_enabled_no_policy: public.turni_operatori (RLS on, 0 policy)
-- I 5 anon DEFINER + 37 authenticated DEFINER restanti sono intenzionali
-- (vetrina pubblica / staff RPC con assert). Nessun DROP.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0011: search_path su helper Storage path
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT format('%I.%I(%s)', n.nspname, p.proname, pg_get_function_identity_arguments(p.oid)) AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'pm_storage_path_tenant_id'
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path = public, pg_temp', r.sig);
  END LOOP;
END;
$$;

-- Helper di migrazione 34: non deve restare invocabile da client
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = '_pm_revoke_exec_client_roles'
  ) THEN
    PERFORM public._pm_revoke_exec_client_roles('public', '_pm_revoke_exec_client_roles');
  END IF;
EXCEPTION
  WHEN undefined_function THEN
    NULL;
END;
$$;

REVOKE ALL ON FUNCTION public._pm_revoke_exec_client_roles(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._pm_revoke_exec_client_roles(text, text) FROM anon, authenticated;

-- -----------------------------------------------------------------------------
-- turni_operatori: RLS attiva ma senza policy → advisor + deny-by-default
-- Accesso operativo resta via RPC SECURITY DEFINER (turni_cassa_*).
-- Policy staff: lettura/scrittura solo sul proprio tenant (utenti_ruoli).
-- -----------------------------------------------------------------------------
ALTER TABLE public.turni_operatori ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_isolation_turni_operatori" ON public.turni_operatori;
DROP POLICY IF EXISTS "turni_operatori_all_by_azienda" ON public.turni_operatori;
DROP POLICY IF EXISTS "turni_operatori_staff_select" ON public.turni_operatori;
DROP POLICY IF EXISTS "turni_operatori_staff_insert" ON public.turni_operatori;
DROP POLICY IF EXISTS "turni_operatori_staff_update" ON public.turni_operatori;
DROP POLICY IF EXISTS "turni_operatori_staff_delete" ON public.turni_operatori;
DROP POLICY IF EXISTS "turni_operatori_sa_all" ON public.turni_operatori;

CREATE POLICY "turni_operatori_staff_select" ON public.turni_operatori
  FOR SELECT TO authenticated
  USING (
    tenant_id IN (
      SELECT ur.tenant_id
      FROM public.utenti_ruoli ur
      WHERE ur.user_id = auth.uid()
        AND COALESCE(ur.attivo, true) = true
    )
  );

CREATE POLICY "turni_operatori_staff_insert" ON public.turni_operatori
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id IN (
      SELECT ur.tenant_id
      FROM public.utenti_ruoli ur
      WHERE ur.user_id = auth.uid()
        AND COALESCE(ur.attivo, true) = true
    )
  );

CREATE POLICY "turni_operatori_staff_update" ON public.turni_operatori
  FOR UPDATE TO authenticated
  USING (
    tenant_id IN (
      SELECT ur.tenant_id
      FROM public.utenti_ruoli ur
      WHERE ur.user_id = auth.uid()
        AND COALESCE(ur.attivo, true) = true
    )
  )
  WITH CHECK (
    tenant_id IN (
      SELECT ur.tenant_id
      FROM public.utenti_ruoli ur
      WHERE ur.user_id = auth.uid()
        AND COALESCE(ur.attivo, true) = true
    )
  );

CREATE POLICY "turni_operatori_staff_delete" ON public.turni_operatori
  FOR DELETE TO authenticated
  USING (
    tenant_id IN (
      SELECT ur.tenant_id
      FROM public.utenti_ruoli ur
      WHERE ur.user_id = auth.uid()
        AND COALESCE(ur.attivo, true) = true
    )
  );

CREATE POLICY "turni_operatori_sa_all" ON public.turni_operatori
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.utenti_ruoli ur
      WHERE ur.user_id = auth.uid()
        AND COALESCE(ur.attivo, true) = true
        AND lower(trim(COALESCE(ur.ruolo, ''))) IN ('superadmin', 'super_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.utenti_ruoli ur
      WHERE ur.user_id = auth.uid()
        AND COALESCE(ur.attivo, true) = true
        AND lower(trim(COALESCE(ur.ruolo, ''))) IN ('superadmin', 'super_admin')
    )
  );

-- Nessun accesso diretto PostgREST da anon; staff solo se GRANT esplicito (oggi no).
REVOKE ALL ON TABLE public.turni_operatori FROM PUBLIC;
REVOKE ALL ON TABLE public.turni_operatori FROM anon;
-- authenticated: nessun GRANT table (resta via RPC). Policy pronte se un giorno si espone.
GRANT ALL ON TABLE public.turni_operatori TO service_role;
