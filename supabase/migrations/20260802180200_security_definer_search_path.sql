-- =============================================================================
-- 31) Hardening: SET search_path su tutte le SECURITY DEFINER in public/core
-- =============================================================================
-- Riduce rischio search_path hijacking. Idempotente: altera solo funzioni
-- SECURITY DEFINER senza search_path già impostato.
-- =============================================================================

DO $$
DECLARE
  r RECORD;
  v_sql TEXT;
  v_count INT := 0;
BEGIN
  FOR r IN
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
    ORDER BY n.nspname, p.proname
  LOOP
    v_sql := format(
      'ALTER FUNCTION %I.%I(%s) SET search_path = public, core, pg_temp',
      r.schema_name,
      r.func_name,
      r.args
    );
    EXECUTE v_sql;
    v_count := v_count + 1;
  END LOOP;

  RAISE NOTICE 'security_definer_search_path: altered % functions', v_count;
END;
$$;

COMMENT ON SCHEMA public IS
  'PizzaManager public API; SECURITY DEFINER devono avere search_path esplicito (modulo 31).';
