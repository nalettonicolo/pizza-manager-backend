-- =============================================================================
-- Smoke test: isolamento tenant (cross-tenant) — STAGING consigliato
-- =============================================================================
-- Prerequisiti:
--   • Dopo applicazione sql/sql_upgrade.sql (sezione RLS core + pm_core_tenant_access).
--   • Due tenant reali (A e B) e due utenti staff (o cliente) ciascuno legato al proprio tenant.
--
-- Metodo consigliato (valida anche PostgREST / JWT come in produzione):
--   1) Dashboard Supabase → Settings → API: annotare "Exposed schemas" (deve riflettere
--      ciò che è documentato: di norma solo public; core/admin solo con RLS completa e coscenza).
--   2) Con Client REST o app, sessione JWT utente del tenant A:
--      tentare lettura di una riga nota del tenant B (es. SELECT su core.ordini o vista public."Ordine").
--      Atteso: 0 righe o errore RLS; mai dati del tenant B.
--   3) Ripetere con JWT del tenant B (simmetrico).
--
-- Controllo in SQL Editor (simulazione limitata di auth.uid — utile come ausilio, non sostituto del JWT):
--   Sostituire gli UUID e, se il progetto espone le GUC jwt, provare:
--
--   SELECT set_config('request.jwt.claim.sub', '<uuid_auth.users_staff_tenant_A>', true);
--   SELECT count(*) FROM core.ordini WHERE tenant_id = '<uuid_tenant_B>';
--   -- Atteso: 0
--
-- Nota: il comportamento esatto delle GUC dipende dalla versione hosting; la prova con JWT reale
-- dall’SDK resta l’orizzonte di accettazione.
-- =============================================================================

-- Record di marcia (copiare risultati nel ticket / checklist sicurezza)
SELECT current_database() AS db, current_user AS role, now() AS eseguito_il;

-- Verifica presenza funzione di accesso tenant
SELECT proname, oidvectortypes(proargtypes) AS args
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND proname = 'pm_core_tenant_access';

-- Campione: policy su tabelle core tenant-sensitive (estratto da pg_policies)
SELECT schemaname, tablename, policyname, roles, cmd
FROM pg_policies
WHERE schemaname = 'core'
  AND policyname LIKE 'pm\_core%' ESCAPE '\'
ORDER BY tablename, policyname
LIMIT 50;

-- Admin: policy presenti (dopo migrazione; superadmin-only se aggiunte da sql_upgrade)
SELECT schemaname, tablename, policyname
FROM pg_policies
WHERE schemaname = 'admin'
ORDER BY tablename, policyname;
