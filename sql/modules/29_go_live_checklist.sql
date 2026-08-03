-- =============================================================================
-- 29) Go-live cliente: checklist condivisa su DB
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.tenant_go_live_checklist (
  tenant_id UUID PRIMARY KEY REFERENCES core.tenants(id) ON DELETE CASCADE,
  anagrafica BOOLEAN NOT NULL DEFAULT false,
  dns BOOLEAN NOT NULL DEFAULT false,
  menu BOOLEAN NOT NULL DEFAULT false,
  legali BOOLEAN NOT NULL DEFAULT false,
  smoke_test BOOLEAN NOT NULL DEFAULT false,
  auth_redirects BOOLEAN NOT NULL DEFAULT false,
  firebase_host BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.tenant_go_live_checklist ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "go_live_checklist_sa" ON public.tenant_go_live_checklist;
CREATE POLICY "go_live_checklist_sa" ON public.tenant_go_live_checklist
  FOR ALL
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

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenant_go_live_checklist TO authenticated;

CREATE OR REPLACE FUNCTION public.sa_get_go_live_checklist(p_tenant_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, core
AS $$
DECLARE
  v_ok BOOLEAN := false;
  v_row public.tenant_go_live_checklist%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'non_autorizzato';
  END IF;
  SELECT EXISTS (
    SELECT 1 FROM public.utenti_ruoli ur
    WHERE ur.user_id = auth.uid()
      AND COALESCE(ur.attivo, true) = true
      AND lower(trim(COALESCE(ur.ruolo, ''))) IN ('superadmin', 'super_admin')
  ) INTO v_ok;
  IF NOT COALESCE(v_ok, false) THEN
    RAISE EXCEPTION 'solo_superadmin';
  END IF;

  SELECT * INTO v_row
  FROM public.tenant_go_live_checklist
  WHERE tenant_id = p_tenant_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'tenant_id', p_tenant_id,
      'anagrafica', false,
      'dns', false,
      'menu', false,
      'legali', false,
      'smoke_test', false,
      'auth_redirects', false,
      'firebase_host', false,
      'updated_at', null
    );
  END IF;

  RETURN jsonb_build_object(
    'tenant_id', v_row.tenant_id,
    'anagrafica', v_row.anagrafica,
    'dns', v_row.dns,
    'menu', v_row.menu,
    'legali', v_row.legali,
    'smoke_test', v_row.smoke_test,
    'auth_redirects', v_row.auth_redirects,
    'firebase_host', v_row.firebase_host,
    'updated_at', v_row.updated_at
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.sa_get_go_live_checklist(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.sa_upsert_go_live_checklist(
  p_tenant_id UUID,
  p_checks JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, core
AS $$
DECLARE
  v_ok BOOLEAN := false;
BEGIN
  IF auth.uid() IS NULL OR p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'non_autorizzato';
  END IF;
  SELECT EXISTS (
    SELECT 1 FROM public.utenti_ruoli ur
    WHERE ur.user_id = auth.uid()
      AND COALESCE(ur.attivo, true) = true
      AND lower(trim(COALESCE(ur.ruolo, ''))) IN ('superadmin', 'super_admin')
  ) INTO v_ok;
  IF NOT COALESCE(v_ok, false) THEN
    RAISE EXCEPTION 'solo_superadmin';
  END IF;

  INSERT INTO public.tenant_go_live_checklist AS t (
    tenant_id,
    anagrafica,
    dns,
    menu,
    legali,
    smoke_test,
    auth_redirects,
    firebase_host,
    updated_at,
    updated_by
  )
  VALUES (
    p_tenant_id,
    COALESCE((p_checks->>'anagrafica')::boolean, false),
    COALESCE((p_checks->>'dns')::boolean, false),
    COALESCE((p_checks->>'menu')::boolean, false),
    COALESCE((p_checks->>'legali')::boolean, false),
    COALESCE((p_checks->>'smoke_test')::boolean, false),
    COALESCE((p_checks->>'auth_redirects')::boolean, false),
    COALESCE((p_checks->>'firebase_host')::boolean, false),
    now(),
    auth.uid()
  )
  ON CONFLICT (tenant_id) DO UPDATE SET
    anagrafica = EXCLUDED.anagrafica,
    dns = EXCLUDED.dns,
    menu = EXCLUDED.menu,
    legali = EXCLUDED.legali,
    smoke_test = EXCLUDED.smoke_test,
    auth_redirects = EXCLUDED.auth_redirects,
    firebase_host = EXCLUDED.firebase_host,
    updated_at = now(),
    updated_by = auth.uid();

  RETURN public.sa_get_go_live_checklist(p_tenant_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.sa_upsert_go_live_checklist(UUID, JSONB) TO authenticated;

COMMENT ON TABLE public.tenant_go_live_checklist IS
  'Checklist go-live condivisa (Super Admin); non localStorage.';
