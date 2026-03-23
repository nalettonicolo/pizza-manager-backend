-- La vista public.tenants con CASE su `piano` (→ core.piano_saas) NON è aggiornabile automaticamente:
-- UPDATE da app/PostgREST su colonne operative (logo_url, orari, ecc.) falliscono.
-- Vista semplice su admin.tenants (solo riferimenti a colonne) → UPDATE/INSERT consentiti al ruolo con GRANT.

DO $$
DECLARE
  relkind "char";
BEGIN
  IF to_regclass('admin.tenants') IS NULL THEN
    RAISE NOTICE 'admin.tenants assente: salta vista updatable.';
    RETURN;
  END IF;

  SELECT c.relkind INTO relkind
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relname = 'tenants';

  IF relkind = 'r' THEN
    RAISE NOTICE 'public.tenants è una tabella: salta.';
    RETURN;
  END IF;

  DROP VIEW IF EXISTS public.tenants CASCADE;

  CREATE VIEW public.tenants AS
  SELECT * FROM admin.tenants;

  ALTER VIEW public.tenants OWNER TO postgres;
  GRANT ALL ON TABLE public.tenants TO service_role;
END $$;

DO $$
BEGIN
  IF to_regclass('admin.tenants') IS NOT NULL THEN
    GRANT USAGE ON SCHEMA admin TO authenticated;
    GRANT USAGE ON SCHEMA admin TO anon;
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE admin.tenants TO authenticated;
    GRANT SELECT ON TABLE admin.tenants TO anon;
  END IF;

  IF to_regclass('public.tenants') IS NOT NULL THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.tenants TO authenticated;
    GRANT SELECT ON TABLE public.tenants TO anon;
    GRANT ALL ON TABLE public.tenants TO service_role;
  END IF;
END $$;
