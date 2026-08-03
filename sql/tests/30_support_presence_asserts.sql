-- =============================================================================
-- Asserts (read-only / smoke) — presence tenant bind
-- Eseguire come superuser o service role dopo apply di modulo 30.
-- =============================================================================

-- 1) Tabella con RLS forzata
SELECT c.relrowsecurity AS rls, c.relforcerowsecurity AS force_rls
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname = 'support_presence';
-- atteso: rls=true, force_rls=true

-- 2) Nessun grant INSERT/UPDATE/DELETE ad authenticated
SELECT privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name = 'support_presence'
  AND grantee = 'authenticated'
ORDER BY 1;
-- atteso: solo SELECT

-- 3) Funzione presente
SELECT proname
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND proname = 'upsert_support_presence';
