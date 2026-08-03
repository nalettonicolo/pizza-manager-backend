-- =============================================================================
-- 36) Realtime: core.ordini in publication supabase_realtime (cucina/bancone)
-- =============================================================================
-- Idempotente. Consente postgres_changes sulla tabella ordini per refresh live.
-- =============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
END;
$$;

DO $$
BEGIN
  IF to_regclass('core.ordini') IS NULL THEN
    RAISE NOTICE 'core.ordini assente: skip realtime publication';
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'core'
      AND tablename = 'ordini'
  ) THEN
    RAISE NOTICE 'core.ordini già in supabase_realtime';
  ELSE
    ALTER PUBLICATION supabase_realtime ADD TABLE core.ordini;
    RAISE NOTICE 'core.ordini aggiunto a supabase_realtime';
  END IF;

  -- Replica identity FULL: filtri tenant_id su UPDATE/DELETE più affidabili
  BEGIN
    EXECUTE 'ALTER TABLE core.ordini REPLICA IDENTITY FULL';
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE 'REPLICA IDENTITY FULL non applicato: %', SQLERRM;
  END;
END;
$$;
