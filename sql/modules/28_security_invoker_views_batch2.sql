-- =============================================================================
-- 28) Security advisors batch 2: security_invoker su viste public residue
-- =============================================================================
-- CRITICAL Security Definer View:
--   configurazione_costi, prodotti_menu_pubblico, formati, Ingrediente, ingredienti,
--   RigaOrdine, cottura, tenants
-- + qualsiasi altra vista public esposta ad anon/authenticated senza invoker.
-- =============================================================================

-- Privilegi base (security_invoker richiede SELECT sulle tabelle sottostanti)
GRANT SELECT ON TABLE core.configurazione_costi TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE core.configurazione_costi TO authenticated;

GRANT SELECT ON TABLE core.formati TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE core.formati TO authenticated;

GRANT SELECT ON TABLE core.ingredienti TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE core.ingredienti TO authenticated;

GRANT SELECT ON TABLE core.riga_ordine TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE core.riga_ordine TO authenticated;

GRANT SELECT ON TABLE core.cottura TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE core.cottura TO authenticated;

GRANT SELECT ON TABLE core.prodotti TO authenticated;
GRANT SELECT ON TABLE core.categorie TO authenticated;

-- tenants: vista pubblica / autenticati (vetrina); garantisci lettura base
DO $ten$
BEGIN
  IF to_regclass('admin.tenants') IS NOT NULL THEN
    EXECUTE 'GRANT SELECT ON TABLE admin.tenants TO authenticated';
    EXECUTE 'GRANT SELECT ON TABLE admin.tenants TO anon';
  END IF;
  IF to_regclass('core.tenants') IS NOT NULL THEN
    EXECUTE 'GRANT SELECT ON TABLE core.tenants TO authenticated';
    EXECUTE 'GRANT SELECT ON TABLE core.tenants TO anon';
  END IF;
END
$ten$;

-- Imposta security_invoker=on su tutte le viste public ancora in modalità definer
-- e raggiungibili da anon o authenticated (stesso criterio del linter Supabase).
DO $fix$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT c.relname AS view_name
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'v'
      AND (
        pg_catalog.has_table_privilege('anon', c.oid, 'SELECT')
        OR pg_catalog.has_table_privilege('authenticated', c.oid, 'SELECT')
      )
      AND NOT (
        lower(COALESCE(c.reloptions::text, '{}'))::text[]
        && ARRAY[
          'security_invoker=1',
          'security_invoker=true',
          'security_invoker=yes',
          'security_invoker=on'
        ]
      )
  LOOP
    EXECUTE format('ALTER VIEW public.%I SET (security_invoker = on)', r.view_name);
    RAISE NOTICE 'security_invoker=on → public.%', r.view_name;
  END LOOP;
END
$fix$;

-- Explicit (documentazione / idempotenza nomi noti)
DO $named$
DECLARE
  v TEXT;
  views TEXT[] := ARRAY[
    'configurazione_costi',
    'prodotti_menu_pubblico',
    'formati',
    'Ingrediente',
    'ingredienti',
    'RigaOrdine',
    'cottura',
    'tenants'
  ];
BEGIN
  FOREACH v IN ARRAY views
  LOOP
    IF to_regclass(format('public.%I', v)) IS NOT NULL THEN
      EXECUTE format('ALTER VIEW public.%I SET (security_invoker = on)', v);
    END IF;
  END LOOP;
END
$named$;
