-- =============================================================================
-- Modulo 53 — Abilita RLS sulle tabelle legacy di backup (residui pre-migrazione core.*)
-- Applicato su Supabase (project flfhrwzlrftuhkrfwzse) il 2026-08-22 come
-- "enable_rls_legacy_backup_tables" via MCP apply_migration.
-- =============================================================================
--
-- Contesto: l'advisor di sicurezza Supabase segnalava 9 tabelle in schema "public"
-- con RLS disabilitata, quindi completamente esposte a anon/authenticated tramite
-- PostgREST. Verificato prima di applicare:
--   - Tutte le 9 tabelle risultano vuote (0 righe).
--   - Nessun file in src/ referenzia questi nomi tabella (grep su
--     Tenant_backup|Ingrediente_backup|Prodotto_backup|ProdottoIngrediente_backup|
--     Ordine_backup|RigaOrdine_backup|ConfigurazioneCosti_backup|_prisma_migrations|
--     .from("User") → nessun risultato).
-- Sono residui della vecchia struttura Prisma prima della migrazione allo schema
-- core.* (tabelle "_backup" + la tabella storica delle migrazioni Prisma).
--
-- Nessuna policy aggiunta: RLS on + zero policy = accesso negato a chiunque
-- (anon/authenticated), coerente col fatto che nulla nel prodotto le usa più.
-- Se in futuro servisse leggerle (es. recupero dati storici), aggiungere prima
-- una policy esplicita per il ruolo giusto — non riabilitare l'accesso pubblico.

ALTER TABLE public."Tenant_backup" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ConfigurazioneCosti_backup" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Ingrediente_backup" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Prodotto_backup" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ProdottoIngrediente_backup" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Ordine_backup" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."RigaOrdine_backup" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."_prisma_migrations" ENABLE ROW LEVEL SECURITY;
