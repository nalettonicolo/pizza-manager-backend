-- =============================================================================
-- Read-only: quante SECURITY DEFINER restano senza search_path?
-- Atteso dopo modulo 31: 0 su public/core/admin
-- =============================================================================

SELECT
  n.nspname AS schema_name,
  p.proname AS func_name,
  pg_get_function_identity_arguments(p.oid) AS args
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE p.prosecdef = true
  AND n.nspname IN ('public', 'core', 'admin')
  AND (
    p.proconfig IS NULL
    OR NOT EXISTS (
      SELECT 1
      FROM unnest(COALESCE(p.proconfig, ARRAY[]::text[])) AS cfg(c)
      WHERE cfg.c LIKE 'search_path=%'
    )
  )
ORDER BY 1, 2;

-- Conteggio rapido
SELECT count(*) AS definer_senza_search_path
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE p.prosecdef = true
  AND n.nspname IN ('public', 'core', 'admin')
  AND (
    p.proconfig IS NULL
    OR NOT EXISTS (
      SELECT 1
      FROM unnest(COALESCE(p.proconfig, ARRAY[]::text[])) AS cfg(c)
      WHERE cfg.c LIKE 'search_path=%'
    )
  );
