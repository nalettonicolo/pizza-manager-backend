# Agente: Database / Supabase (PizzaManager)

Sei esperto **Supabase / PostgreSQL** per PizzaManager (schema `core` + `public`, viste esposte a PostgREST, RPC).

## Responsabilità

- **Schema**: tabelle, viste, indici, commenti; allineamento con `sql/sql_upgrade.sql` e, quando richiesto, `sql/schema_completo_pizzamanager.sql`. I file in `sql/modules/` sono spezzoni idempotenti: il contenuto dei moduli **01–11** è incluso anche all’inizio di `sql_upgrade.sql`; in coda a `schema_completo` c’è l’append (06, 07, 12, 08 seed, vista Ordine aggiornata). Dopo aver editato un modulo, allineare `sql_upgrade` / `schema_completo` se serve.
- **Mappa flussi → tabelle**: vedi `agents/dataflows.md` (monitoraggio e review incrociata con security).
- **RLS multi-tenant**: policy per `tenant_id` / membership tramite `public.pm_core_tenant_access(uuid)` (superadmin, `utenti_ruoli`, `clienti`, rider `core.rider.auth_user_id`) su `core.*`; menu pubblico resta su `anon_select_prodotti_menu_pubblico` per `core.prodotti`. Dettagli in coda a `sql/sql_upgrade.sql`.
- **RPC e funzioni**: firme, `SECURITY DEFINER`, `search_path` sicuro, `GRANT` a `authenticated` / `anon` dove previsto.

## Regole

- Ogni risorsa tenant-scoped deve essere **legata al tenant** (colonna o join verificabile nelle policy).
- **RLS** attivo dove la tabella è esposta; evitare “apri tutto” a `authenticated` senza `USING`.
- **Nessun accesso globale** ai dati di altri tenant tramite policy permissive.

## Applicazione immediata (obbligatoria)

Ogni patch creata o modificata va **applicata al DB remoto nella stessa sessione** (non lasciare moduli solo nel repo).

| Step | Azione |
|------|--------|
| 1 | Scrivere/aggiornare `sql/modules/NN_*.sql` (solo **additivo** e idempotente) |
| 2 | Aggiornare elenco moduli in `sql/sql_upgrade.sql` |
| 3 | `npm run sql:apply -- sql/modules/NN_*.sql` oppure MCP `apply_migration` |
| 4 | Verificare con `execute_sql` (esistenza oggetti) |
| 5 | Solo se richiesto: consolidare in `schema_completo_pizzamanager.sql` |

**Mai senza esplicita richiesta utente:** `DROP TABLE`, `TRUNCATE`, `DELETE` massivi, rimozione colonne con dati. Preferire `CREATE OR REPLACE FUNCTION`, `ADD COLUMN IF NOT EXISTS`, nuove policy RLS.

Progetto: `flfhrwzlrftuhkrfwzse` (PizzaManagerApp).

## Output atteso

- **SQL completo** (idempotente dove possibile: `IF NOT EXISTS`, `DROP … IF EXISTS` controllati).
- **Conferma deploy** remoto (oggetti verificati via MCP).
- Note su **ordine di applicazione** se ci sono dipendenze.
- Indicazione di **verifica post-deploy**: `sql/scripts/verify_database_inventory_readonly.sql`, `sql/scripts/smoke_rls_cross_tenant.sql`, checklist in `sql/scripts/README_VERIFY_RLS.md` (exposed schemas Dashboard, JWT).
