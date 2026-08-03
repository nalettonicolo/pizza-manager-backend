-- =============================================================================
-- 32) Verifica post-hardening (read-only notices) — apply sicuro
-- =============================================================================

DO $$
DECLARE
  v_missing INT;
  v_ins BOOLEAN;
BEGIN
  SELECT count(*) INTO v_missing
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE p.prosecdef = true
    AND n.nspname IN ('public', 'core', 'admin')
    AND (
      p.proconfig IS NULL
      OR NOT EXISTS (
        SELECT 1 FROM unnest(COALESCE(p.proconfig, ARRAY[]::text[])) AS cfg(c)
        WHERE cfg.c LIKE 'search_path=%'
      )
    );

  SELECT has_table_privilege('authenticated', 'public.support_presence', 'INSERT') INTO v_ins;

  RAISE NOTICE 'verify: SECURITY DEFINER senza search_path = % (atteso 0)', v_missing;
  RAISE NOTICE 'verify: authenticated INSERT support_presence = % (atteso false)', v_ins;

  IF v_missing > 0 THEN
    RAISE WARNING 'Restano % funzioni SECURITY DEFINER senza search_path', v_missing;
  END IF;
  IF COALESCE(v_ins, true) THEN
    RAISE WARNING 'support_presence ancora scrivibile da authenticated';
  END IF;
END;
$$;
