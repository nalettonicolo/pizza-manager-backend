# Verifica RLS e isolamento tenant (staging / produzione)

## Scopo

Fornire **linee guida** per verifiche manuali o script SQL eseguiti con due sessioni (`auth.uid()` diversi o JWT di test). Adattare nomi schema/tabella al proprio ambiente.

## Principi

1. **Mai** eseguire script di test su produzione senza finestra di manutenzione e backup.
2. Usare utenti reali di **due tenant** diversi creati ad hoc.
3. Documentare esito in ticket / Confluence.

## Esempi di query concettuali (Postgres / Supabase)

### A) Verifica che una policy blocchi il cross-tenant

Con sessione utente del **tenant A**, tentare `SELECT` su righe con `tenant_id` del **tenant B** sulla stessa tabella: deve restituire **0 righe** o errore secondo policy.

### B) RPC sensibili

Chiamare `replace_order_items` con `p_ordine_id` di un altro tenant senza permesso: deve fallire con `non_autorizzato` o equivalente.

### C) Ruolo anon

Verificare che `anon` possa solo leggere ciò che la policy `anon_select_*` consente (es. menu pubblico), e nulla su ordini.

## Inventario completo (sola lettura)

Esegui **`verify_database_inventory_readonly.sql`** (a sezioni) in SQL Editor o via **MCP Supabase in `read_only`**: copre estensioni, tabelle `public`/`core`/`admin`, RLS on/off, elenco policy, viste, funzioni `SECURITY DEFINER`, trigger, grant verso `anon`/`authenticated`, e checklist minima tabelle attese. Nessuna modifica al database.

## Checklist supervisione sicurezza (Supabase)

1. **Exposed schemas**  
   Dashboard progetto (es. `flfhrwzlrftuhkrfwzse`) → **Settings → API → Exposed schemas**.  
   Documentare per iscritto o allegato interno: elenco effettivo. Condizione di accettazione per il profilo “sicuro”: **`core` e `admin` non devono comparire** tra gli schemi esposti a PostgREST salvo decisione esplicita con RLS e test JWT completati.

2. **Core raggiungibile dal client**  
   Con chiave `anon` / sessione `authenticated`, provare le rotte REST su `core.*` se lo schema fosse esposto: senza grant adeguati o con RLS le risposte devono essere vuote o negate. Dopo `sql/sql_upgrade.sql`, le policy `pm_core_*` usano `public.pm_core_tenant_access` (superadmin, `utenti_ruoli`, `clienti`, rider tramite `core.rider.auth_user_id`).

3. **Schema admin e `pg_policies`**  
   Se RLS è `ON` su `admin.*` ma non compaiono policy, i client anon/auth non vedono righe (effetto “nero”). Lo `sql_upgrade` aggiunge policy **`pm_admin_*_superadmin`** solo dove RLS è attivo e non esiste ancora alcuna policy (accesso `authenticated` riservato a riga `utenti_ruoli` con `ruolo = superadmin`). Verifica:

   ```sql
   SELECT schemaname, tablename, policyname, roles, cmd
   FROM pg_policies
   WHERE schemaname = 'admin'
   ORDER BY tablename, policyname;
   ```

4. **Smoke cross-tenant**  
   In staging, eseguire le verifiche descritte in **`smoke_rls_cross_tenant.sql`** (ideale: due JWT reali, tenant A/B).

## Automazione futura

- Inventario: `npm run verify:rls-inventory` (Management API + token CLI).
- Cross-tenant JWT: `npm run verify:rls-jwt-ab` con env `RLS_JWT_A`, `RLS_JWT_B`, `RLS_TENANT_A`, `RLS_TENANT_B`.
  - Senza env → **SKIP** (exit 0); con `REQUIRE_RLS_JWT=1` → fail se mancano.
- Workflow: `.github/workflows/security-smoke.yml` (whitelist PO, inventario, JWT A/B, Stripe Edge).
- Smoke SQL manuale: **`smoke_rls_cross_tenant.sql`** in staging con due JWT reali resta l’orizzonte di accettazione completo.
