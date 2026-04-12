-- =============================================================================
-- PizzaManager — Verifica database (SOLO LETTURA)
-- =============================================================================
-- Eseguire in Supabase SQL Editor o tramite MCP Supabase (read_only) a chunk,
-- approvando ogni batch. Nessuna modifica allo schema o ai dati.
--
-- Progetto atteso: PizzaManagerApp (confronta con il tuo project_ref).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1) Contesto server (versione Postgres, database)
-- ---------------------------------------------------------------------------
SELECT version() AS postgres_version, current_database() AS db_name, current_user AS session_user;

-- ---------------------------------------------------------------------------
-- 2) Estensioni installate
-- ---------------------------------------------------------------------------
SELECT extname, extversion FROM pg_extension ORDER BY extname;

-- ---------------------------------------------------------------------------
-- 3) Schemi utente (esclusi di sistema tipici)
-- ---------------------------------------------------------------------------
SELECT schema_name
FROM information_schema.schemata
WHERE schema_name NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
ORDER BY schema_name;

-- ---------------------------------------------------------------------------
-- 4) Conteggio tabelle base per schema (inventario)
-- ---------------------------------------------------------------------------
SELECT n.nspname AS schema_name, COUNT(*) AS table_count
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind = 'r'
  AND n.nspname NOT IN ('pg_catalog', 'information_schema')
GROUP BY n.nspname
ORDER BY n.nspname;

-- ---------------------------------------------------------------------------
-- 5) Elenco tabelle public / core / admin (dettaglio)
-- ---------------------------------------------------------------------------
SELECT n.nspname AS schema_name, c.relname AS table_name
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind = 'r'
  AND n.nspname IN ('public', 'core', 'admin')
ORDER BY n.nspname, c.relname;

-- ---------------------------------------------------------------------------
-- 6) RLS: stato per ogni tabella in public / core / admin
--     relrowsecurity = false → nessuna policy RLS attiva (rischio se esposta a PostgREST)
-- ---------------------------------------------------------------------------
SELECT
  n.nspname AS schema_name,
  c.relname AS table_name,
  c.relrowsecurity AS rls_enabled,
  c.relforcerowsecurity AS rls_forced
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind = 'r'
  AND n.nspname IN ('public', 'core', 'admin')
ORDER BY n.nspname, c.relname;

-- ---------------------------------------------------------------------------
-- 7) Solo tabelle SENZA RLS in public / core / admin (da revisionare a mano)
-- ---------------------------------------------------------------------------
SELECT n.nspname AS schema_name, c.relname AS table_name
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind = 'r'
  AND n.nspname IN ('public', 'core', 'admin')
  AND NOT c.relrowsecurity
ORDER BY n.nspname, c.relname;

-- ---------------------------------------------------------------------------
-- 8) Tutte le policy RLS (public, core, admin)
-- ---------------------------------------------------------------------------
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual IS NOT NULL AS has_using,
  with_check IS NOT NULL AS has_with_check
FROM pg_policies
WHERE schemaname IN ('public', 'core', 'admin')
ORDER BY schemaname, tablename, policyname;

-- ---------------------------------------------------------------------------
-- 9) Policy complete (USING / WITH CHECK) — output lungo; eseguire se serve il dettaglio
-- ---------------------------------------------------------------------------
SELECT
  schemaname,
  tablename,
  policyname,
  cmd,
  roles,
  qual AS using_expression,
  with_check AS with_check_expression
FROM pg_policies
WHERE schemaname IN ('public', 'core', 'admin')
ORDER BY schemaname, tablename, policyname;

-- ---------------------------------------------------------------------------
-- 10) Viste in public / core / admin
-- ---------------------------------------------------------------------------
SELECT table_schema, table_name
FROM information_schema.views
WHERE table_schema IN ('public', 'core', 'admin')
ORDER BY table_schema, table_name;

-- ---------------------------------------------------------------------------
-- 11) Funzioni SECURITY DEFINER in public e core (superficie sensibile)
-- ---------------------------------------------------------------------------
SELECT
  n.nspname AS schema_name,
  p.proname AS function_name,
  pg_catalog.pg_get_function_identity_arguments(p.oid) AS args
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname IN ('public', 'core')
  AND p.prosecdef
ORDER BY n.nspname, p.proname;

-- ---------------------------------------------------------------------------
-- 12) Trigger su tabelle public / core (cenni)
-- ---------------------------------------------------------------------------
SELECT
  event_object_schema AS schema_name,
  event_object_table AS table_name,
  trigger_name,
  action_timing,
  string_agg(event_manipulation, ', ' ORDER BY event_manipulation) AS events
FROM information_schema.triggers
WHERE event_object_schema IN ('public', 'core', 'admin')
GROUP BY event_object_schema, event_object_table, trigger_name, action_timing
ORDER BY schema_name, table_name, trigger_name;

-- ---------------------------------------------------------------------------
-- 13) GRANT verso anon / authenticated su tabelle public (campione; elenco può essere lungo)
-- ---------------------------------------------------------------------------
SELECT
  table_schema,
  table_name,
  grantee,
  string_agg(privilege_type, ', ' ORDER BY privilege_type) AS privileges
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND grantee IN ('anon', 'authenticated', 'service_role')
GROUP BY table_schema, table_name, grantee
ORDER BY table_name, grantee;

-- ---------------------------------------------------------------------------
-- 14) Controllo incrociato: tabelle “attese” PizzaManager in public (mancanze)
--     Aggiungi/rimuovi righe VALUES in base alla tua baseline.
-- ---------------------------------------------------------------------------
WITH expected_public(tab_name) AS (
  VALUES
    ('utenti_ruoli'),
    ('clienti'),
    ('anagrafica_clienti'),
    ('contabilita_movimenti'),
    ('magazzino_movimenti'),
    ('fidelity_saldi'),
    ('fidelity_movimenti'),
    ('fiscal_outbox'),
    ('payment_link_intents'),
    ('notifiche_outbox'),
    ('turni_operatori'),
    ('tenant_admins'),
    ('cassa_ordine_audit'),
    ('chiusure_giornata'),
    ('ingrediente_allergeni'),
    ('staff_password_note'),
    ('superadmin_registratore_audit'),
    ('superadmin_registratore_state')
),
actual AS (
  SELECT c.relname AS tab_name
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE c.relkind = 'r' AND n.nspname = 'public'
)
SELECT e.tab_name AS expected_table_missing_in_public
FROM expected_public e
LEFT JOIN actual a ON a.tab_name = e.tab_name
WHERE a.tab_name IS NULL
ORDER BY 1;

-- ---------------------------------------------------------------------------
-- 15) Stesso per prefisso core (minimo operativo)
-- ---------------------------------------------------------------------------
WITH expected_core(tab_name) AS (
  VALUES
    ('tenants'),
    ('ordini'),
    ('riga_ordine'),
    ('prodotti'),
    ('categorie'),
    ('punti_vendita'),
    ('rider'),
    ('subscriptions')
),
actual AS (
  SELECT c.relname AS tab_name
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE c.relkind = 'r' AND n.nspname = 'core'
)
SELECT e.tab_name AS expected_table_missing_in_core
FROM expected_core e
LEFT JOIN actual a ON a.tab_name = e.tab_name
WHERE a.tab_name IS NULL
ORDER BY 1;

-- =============================================================================
-- Fine script. Interpretazione:
-- - Sez. 7: ogni tabella elencata è senza RLS → verificare se è intenzionale
--   (solo service_role / migrazioni) o se va abilitata RLS + policy.
-- - Sez. 14–15: righe vuote = nessuna mancanza rispetto alla checklist minima.
-- - Confrontare con agents/dataflows.md e sql/sql_upgrade.sql per evoluzioni.
-- =============================================================================
