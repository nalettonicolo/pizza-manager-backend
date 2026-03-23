-- Dopo DROP/CREATE di public.tenants le migrazioni 20260322140000 / 20260322180000
-- concedevano solo a service_role → PostgREST (anon/authenticated) riceve
-- "permission denied for view tenants".
-- Con vista SECURITY INVOKER servono privilegi su public.tenants e sulla base admin.tenants,
-- più USAGE sullo schema admin.

DO $$
BEGIN
  IF to_regclass('admin.tenants') IS NOT NULL THEN
    GRANT USAGE ON SCHEMA admin TO authenticated;
    GRANT USAGE ON SCHEMA admin TO anon;
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE admin.tenants TO authenticated;
    -- Lettura pubblica limitata in app (es. getPublicTenantInfo): in progetti multi-tenant
    -- valutare RLS su admin.tenants o una vista/rpc dedicata.
    GRANT SELECT ON TABLE admin.tenants TO anon;
  END IF;

  IF to_regclass('public.tenants') IS NOT NULL THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.tenants TO authenticated;
    GRANT SELECT ON TABLE public.tenants TO anon;
    GRANT ALL ON TABLE public.tenants TO service_role;
  END IF;
END $$;
