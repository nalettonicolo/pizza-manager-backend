# Punto situazione — Database / SQL / RLS

**Data:** 2026-08-04  
**Progetto Supabase:** `flfhrwzlrftuhkrfwzse` (PizzaManagerApp)  
**Ambito:** schema Postgres, moduli incrementali, RLS multi-tenant, RPC `SECURITY DEFINER`, grant `anon`/`authenticated`, verifica remota, gap e Definition of Done SQL.

---

## 1. Sintesi esecutiva

Il database PizzaManager è **multi-tenant obbligatorio** (`tenant_id` + `public.pm_core_tenant_access`), con autorità su soldi/ordini/turni nelle **RPC `SECURITY DEFINER`**, non nel solo frontend.

Tra fine luglio e inizio agosto 2026 è stata chiusa una **ondata di hardening** (moduli **30–39**): binding presence al tenant da identità, `search_path` sulle DEFINER, revoke mirati su Edge/secrets/fiscal e su RPC che richiedono login, Realtime su `core.ordini`, bucket Storage privato per proof di consegna, policy su `turni_operatori`, RPC pubblica sicura `get_public_tenant_by_id` per anteprima SaaS.

**Advisor sicurezza:** da ~106 a ~**43** WARN (documentato in `MACROFASI_SVILUPPO.md` / backlog). Di questi, ~42 sono **rumore atteso** (vetrina pubblica + staff RPC con assert interno); **1 residuo HIBP** richiede piano Supabase **Pro+** (toggle Dashboard, non patch SQL).

**Consolidamento:** i moduli **15–39** sono elencati come indice in `sql/sql_upgrade.sql` (corpo attualmente **template vuoto** — solo commenti). `schema_completo_pizzamanager.sql` include baseline + consolidamenti fino a blocchi storici (contabilità, magazzino, fiscal, RLS `pm_core_*`); **non** include ancora in coda i moduli 30–39 come blocco datato unico. Fonte operativa delle patch recenti: **`sql/modules/NN_*.sql`** applicati sul remoto.

---

## 2. Tre livelli di artefatti SQL

| Artefatto | Ruolo | Quando usarlo |
|-----------|--------|----------------|
| `sql/schema_completo_pizzamanager.sql` | **Baseline unificato** (snapshot remoto + migration consolidate + append CONSOLIDAMENTO moduli storici + blocco RLS `pm_core_tenant_access`) | Nuovo ambiente / DR controllato; **non** rieseguire intero su produzione viva |
| `sql/sql_upgrade.sql` | **Indice + template** delle patch incrementali; dopo consolidamento torna “vuoto” (solo header) | Documenta *cosa* applicare; oggi elenca moduli **15–39** in commento |
| `sql/modules/NN_*.sql` | **Spezzoni idempotenti** di lavoro (additivi: `IF NOT EXISTS`, `CREATE OR REPLACE`, `ADD COLUMN IF NOT EXISTS`) | **Fonte operativa**: scrivere → aggiornare indice in `sql_upgrade` → **applicare subito** al remoto |

### Workflow obbligatorio (repo + remoto)

1. Scrivere/aggiornare `sql/modules/NN_descrizione.sql` (solo additivo e idempotente).  
2. Aggiornare l’elenco commentato in `sql/sql_upgrade.sql`.  
3. Deploy: `npm run sql:apply -- sql/modules/NN_*.sql` oppure MCP `apply_migration`.  
4. Verifica read-only (esistenza oggetti / grant / notices).  
5. Consolidare in `schema_completo` **solo se richiesto** dal team; poi ripulire il corpo di `sql_upgrade`.

**Vietato senza richiesta esplicita:** `DROP TABLE`, `TRUNCATE`, `DELETE` massivi, `DROP COLUMN` su dati produttivi.

Riferimenti operativi: `agents/database.md`, `sql/modules/README.md`, `sql/scripts/README_VERIFY_RLS.md`.

---

## 3. Inventario moduli (`sql/modules/`)

Presenti **39** moduli numerati (+ `README.md`). Ordine di applicazione: **numerico**. Su DB nuovo, attenzione a dipendenze note (es. rider **11** prima della vista Ordine **04**).

### 3.1 Storico / prodotto (01–29) — sintesi

| Range | Tema |
|-------|------|
| 01–05 | Fidelity, PV, estensioni ordini, vista `Ordine`, `create_order_with_items` / geo |
| 06–08 | Contabilità movimenti, magazzino movimenti, seed PV |
| 09–13 | Legal resolve, lat/lng PV, rider enterprise, fiscal/payment links, telefono ritiro |
| 14–16 | Magazzino fornitori/DDT, idempotency ordini, contabilità estesa |
| 17–20 | Stripe online, geo clienti, profilo cliente, storico ordini cliente |
| 21–25 | Fidelity/notifiche, catalogo SA, worker notifiche, canale parametri, capacity/antifraud/proof |
| 26–29 | Support presence, security_invoker views (batch 1–2), go-live checklist SA |

### 3.2 Hardening e produzione hard (30–39) — dettaglio

| Modulo | File | Contenuto | Stato atteso |
|--------|------|-----------|--------------|
| **30** | `30_support_presence_tenant_bind.sql` | Presence: `p_tenant_id` **ignorato**; tenant da `utenti_ruoli`/`clienti`; RLS FORCE; solo SELECT autenticato + upsert DEFINER; no write diretta client | Hardening P0 presence |
| **31** | `31_security_definer_search_path.sql` | Batch `ALTER FUNCTION … SET search_path = public, core, pg_temp` su tutte le SECURITY DEFINER in `public`/`core`/`admin` senza config | Mitiga search_path hijacking |
| **32** | `32_verify_hardening_notices.sql` | DO read-only: conta DEFINER senza `search_path` (atteso **0**); verifica `authenticated` **non** ha INSERT su `support_presence` | Verifica post-31/30 |
| **33** | `33_sa_support_punti_vendita.sql` | Vista `public.punti_vendita` `security_invoker`: membership **oppure** Super Admin vede tutti i PV (Sala QA) | Supporto SA |
| **34** | `34_revoke_edge_secrets_and_search_path.sql` | Helper `_pm_revoke_exec_client_roles`; REVOKE client su Edge Stripe / fiscal claim; revoke trigger interni; admin RPC senza `anon`; `search_path` su helper `pm_*` | Hardening grant P0 |
| **35** | `35_revoke_anon_auth_required_rpcs.sql` | REVOKE `anon` + GRANT `authenticated` su RPC che richiedono `auth.uid()` (ordini, delivery, turni, cliente_*, presence, …) | Chiude advisor 0028 superfluo |
| **36** | `36_realtime_ordini_publication.sql` | `core.ordini` in publication `supabase_realtime`; `REPLICA IDENTITY FULL` | Cucina/bancone live |
| **37** | `37_storage_consegna_prove.sql` | Bucket privato `consegna-prove` (5 MB, immagini); helper `pm_storage_path_tenant_id`; policy staff/SA su `storage.objects` | Proof firma/foto |
| **38** | `38_advisor_residuals_turni_search_path.sql` | `search_path` su `pm_storage_path_tenant_id`; policy RLS staff/SA su `turni_operatori`; revoke table da `anon` | Residui advisor post-34/35 |
| **39** | `39_public_tenant_by_id.sql` | RPC `get_public_tenant_by_id(uuid)` DEFINER: campi pubblici da `admin.tenants` attivi; `GRANT` a `anon`+`authenticated` | Anteprima SaaS / menu |

> **Nota README moduli:** `sql/modules/README.md` è **parzialmente aggiornato** (ferma descrizione dettagliata intorno al 17). L’indice canonico aggiornato è l’header di `sql/sql_upgrade.sql` (righe moduli 15–39).

---

## 4. Moduli 30–39 — note tecniche per area

### 4.1 Hardening presence e search_path (30–32)

- **Problema risolto (30):** un autenticato poteva tentare heartbeat su `tenant_id` arbitrario passato dal client. Ora il tenant deriva **solo** da membership; Super Admin senza riga staff tenant **non scrive** presence.  
- **RLS:** `FORCE ROW LEVEL SECURITY`; policy SELECT solo SA; `REVOKE` INSERT/UPDATE/DELETE da client.  
- **31:** idempotente; rieseguibile se nuove DEFINER senza `search_path`. Script gemello read-only: `sql/scripts/verify_security_definer_search_path.sql`.  
- **32:** non crea oggetti; emette `NOTICE`/`WARNING` — utile dopo ogni ondata DEFINER.

### 4.2 Sala QA / viste (33)

- Dopo hardening viste (`security_invoker`, moduli 27–28), SA senza membership sul tenant assistito non vedeva PV → UI cassa/operative vuote.  
- Vista ricreata con bypass esplicito `superadmin` / `super_admin` su `utenti_ruoli`.  
- `GRANT SELECT` a `authenticated` e `anon` (allineato al pattern PV storico; isolamento resta nel `WHERE`).

### 4.3 Grant anon / authenticated / service_role (34–35)

**P0 solo `service_role` (esempi):**  
`get_stripe_secret_for_tenant_edge`, webhook secret, `edge_stripe_*`, `claim_fiscal_outbox_batch`, `complete_fiscal_outbox_item`, …

**Trigger/helper interni:** revoke EXECUTE da PUBLIC/anon/authenticated (non devono essere RPC PostgREST).

**Admin/SA (mai anon):**  
`aggiungi_ruolo_pizzeria`, `save_tenant_stripe_*`, `sa_get/upsert_go_live_checklist`, `sa_list_support_presence`, …

**RPC login-only (35):** da `create_order_with_items` / `replace_order_items` a delivery, turni cassa, fidelity cliente, `upsert_support_presence`, ecc. — `anon` revocato, `authenticated` mantenuto. L’assert interno resta obbligatorio (grant ≠ autorizzazione).

**Rumore advisor residuo (intenzionale):** alcune DEFINER restano eseguibili da `anon` o `authenticated` perché servono **vetrina pubblica** o staff con check interno (commento modulo 38: ~5 anon DEFINER + ~37 authenticated DEFINER attesi).

### 4.4 Realtime (36)

- Publication `supabase_realtime` + tabella `core.ordini`.  
- `REPLICA IDENTITY FULL` per filtri su UPDATE/DELETE (es. `tenant_id`) più affidabili lato client.  
- Isolamento: le subscription client devono comunque rispettare **RLS**; non esporre `core` in Exposed schemas senza decisione esplicita (vedi §7).

### 4.5 Storage proof (37)

- Path convenzione: `{tenant_id}/{ordine_id}/{tipo}-{ts}.{ext}`.  
- Policy su primo segmento path = UUID tenant ∈ membership staff attiva, oppure SA.  
- Consumato da admin delivery (`CONSEGNA_PROVE_BUCKET` in `adminService.js`).

### 4.6 Residui advisor + turni (38)

- Chiude `function_search_path_mutable` su `pm_storage_path_tenant_id`.  
- Chiude `rls_enabled_no_policy` su `public.turni_operatori` con policy staff per tenant + SA ALL.  
- **Nessun GRANT table** a `authenticated`/`anon` su `turni_operatori`: accesso operativo resta via RPC `turni_cassa_*` (policy pronte se un giorno si espone la tabella).

### 4.7 Tenant pubblico anteprima (39)

- Dopo RLS stretta, `.from('tenants')` da `anon` non basta per `/preview` / negozio.  
- `get_public_tenant_by_id`: solo tenant **attivi** (`deleted_at IS NULL`), campi branding/orari/`parametri_operativi` — **nessun segreto**.  
- Usata in `publicService.js`.

---

## 5. RLS multi-tenant — modello vigente

### 5.1 Funzione centrale

`public.pm_core_tenant_access(p_tenant uuid)` (in coda a `schema_completo`, allineata allo upgrade storico):

| Condizione | Esito |
|------------|--------|
| `p_tenant` NULL | `false` |
| `utenti_ruoli` con ruolo `superadmin` attivo | `true` (tutti i tenant) |
| staff `utenti_ruoli.tenant_id = p_tenant` | `true` |
| `clienti.id = auth.uid()` e stesso tenant | `true` |
| `core.rider.auth_user_id = auth.uid()` attivo, non deleted, stesso tenant | `true` |
| altrimenti | `false` |

- `REVOKE` da PUBLIC; `GRANT EXECUTE` a **`authenticated`** (non a `anon`).  
- Policy tipiche `pm_core_*` su tabelle `core.*` con colonna `tenant_id` (o `id` su `core.tenants`).

### 5.2 Eccezioni pubbliche deliberate

- **Menu:** `anon_select_prodotti_menu_pubblico` su `core.prodotti` (attivo / visibile online / non deleted).  
- **Anteprima tenant:** RPC **39** (non SELECT aperta su `admin.tenants`).  
- **Legal / domain resolve:** moduli 09 (resolve pubblico) — fuori scope dettaglio 30–39 ma parte del perimetro vetrina.

### 5.3 Pattern consigliato per nuove tabelle

1. Colonna `tenant_id` (o join verificabile).  
2. `ENABLE ROW LEVEL SECURITY` (+ `FORCE` se scrittura solo via RPC).  
3. Policy `USING`/`WITH CHECK` su `pm_core_tenant_access(tenant_id)` **oppure** membership esplicita come in 30/37/38.  
4. Nessun “apri tutto” a `authenticated` senza filtro.  
5. Se esposta a PostgREST: documentare grant; se non esposta: preferire RPC DEFINER con assert.

Checklist umana: `sql/scripts/README_VERIFY_RLS.md`, smoke `sql/scripts/smoke_rls_cross_tenant.sql`, matrice `sql/scripts/matrice_ruoli_tenant_azioni.sql`.

---

## 6. SECURITY DEFINER e `search_path`

| Regola | Dettaglio |
|--------|-----------|
| Autorità | Ordini, righe, turni, presence, segreti Edge, fiscal claim → DEFINER con assert su `auth.uid()` / ruolo / tenant |
| `search_path` | Obbligatorio esplicito (`public, core[, admin], pg_temp`); modulo **31** + residui **34/38** |
| Helper migrazione | `_pm_revoke_exec_client_roles` non deve restare invocabile da client (revoke in 34/38) |
| Verifica | Modulo **32** + `verify_security_definer_search_path.sql` → conteggio **0** |

Nuove funzioni DEFINER: dichiarare subito `SET search_path = …` nella `CREATE`, non affidarsi solo al batch 31.

---

## 7. Cosa verificare in remoto (checklist 2026-08-04)

Progetto: **`flfhrwzlrftuhkrfwzse`**. Preferire MCP `execute_sql` / SQL Editor in **read-only** salvo apply deliberato.

### 7.1 Oggetti moduli 30–39

| Check | Atteso |
|-------|--------|
| `upsert_support_presence` ignora `p_tenant_id` (commento/corpo) | Presente; EXECUTE solo `authenticated` |
| `has_table_privilege('authenticated','public.support_presence','INSERT')` | `false` |
| DEFINER senza `search_path` in public/core/admin | **0** |
| Vista `public.punti_vendita` con bypass SA | Presente, `security_invoker` |
| EXECUTE su `get_stripe_secret_for_tenant_edge` (e family) da `anon`/`authenticated` | Assente; presente per `service_role` |
| EXECUTE `create_order_with_items` da `anon` | Assente |
| `pg_publication_tables`: `supabase_realtime` + `core.ordini` | Presente |
| `storage.buckets`: `consegna-prove`, `public = false` | Presente |
| Policy `consegna_prove_*` su `storage.objects` | Presenti |
| Policy `turni_operatori_staff_*` / `turni_operatori_sa_all` | Presenti |
| `get_public_tenant_by_id(uuid)` | Presente; EXECUTE `anon`+`authenticated` |

### 7.2 Dashboard / API

- **Exposed schemas:** `core` e `admin` **non** esposti a PostgREST salvo decisione scritta + test JWT.  
- JWT / smoke cross-tenant: utente tenant A non legge ordini/PV/storage path di tenant B.  
- Anteprima SaaS: RPC 39 restituisce branding per UUID attivo; tenant soft-deleted / inattivo → `null`.  
- Realtime: subscription cucina riceve change su ordini del proprio tenant (RLS).

### 7.3 Inventario e advisor

- Eseguire a chunk `sql/scripts/verify_database_inventory_readonly.sql`.  
- MCP `get_advisors` tipo `security`: confrontare con baseline **~43** WARN.  
- Performance advisors: fuori scope hardening agosto, da schedulare separatamente.

> **Nota sessione doc:** al momento della stesura l’MCP Supabase può richiedere re-auth (`Unauthorized` su `list_migrations`). La checklist resta valida; rieseguire verify dopo autenticazione.

---

## 8. Gap aperti

| Gap | Tipo | Azione |
|-----|------|--------|
| **HIBP leaked passwords** | Auth Dashboard / piano | Upgrade **Pro+** → abilitare “Leaked password protection”; **non** risolvibile con modulo SQL |
| **Advisor ~42 WARN residui** | Rumore atteso 0028/0029 | Documentare come intenzionali (vetrina + staff DEFINER); non “chiudere” con revoke ciechi che rompono menu/checkout |
| **Consolidamento schema_completo** | Processo | Accodare blocco `CONSOLIDAMENTO moduli 30–39 (2026-08-…)` quando il team lo richiede; allineare README moduli |
| **sql_upgrade corpo vuoto** | Processo | Ok come template; rischio: ambienti nuovi devono applicare **tutti** i `modules/15+` non ancora in baseline |
| **README `sql/modules`** | Docs | Aggiornare tabella fino a 39 |
| **Stripe live / vendor fiscal** | Non-SQL | Chiavi live e adapter RT-SDI fuori DB |
| **Smoke RLS automatizzato in CI** | Test | Ancora manuale/staging (`README_VERIFY_RLS.md`) |

---

## 9. Definition of Done — SQL / RLS / RPC

Una patch o feature che tocca il database è **chiusa** solo se:

1. **Modulo** in `sql/modules/NN_*.sql` idempotente e **additivo**.  
2. **Indice** aggiornato in `sql/sql_upgrade.sql`.  
3. **Applicata sul remoto** (`sql:apply` o `apply_migration`) nella stessa sessione di lavoro.  
4. **Verifica post-deploy** read-only: oggetti, grant, (se rilevante) notices modulo 32 / script verify.  
5. **Isolamento tenant:** nessuna policy/RPC che esponga altri tenant; cross-tenant smoke se si tocca RLS/RPC ordini o storage.  
6. **DEFINER:** `SET search_path` esplicito; grant minimi (`anon` solo se vetrina pubblica intenzionale).  
7. **Nessuna logica critica solo FE:** totali, permessi, soldi restano sul DB/RPC.  
8. **Consolidamento** in `schema_completo` se richiesto dal team; altrimenti gap esplicito in questo doc / backlog.  
9. **Advisor:** regressione rispetto alla baseline accettata (~43) giustificata o azzerata; HIBP tracciato come dipendenza piano.  
10. **No distruttivi** senza OK utente esplicito.

Allineamento product/engineering: `docs/BACKLOG_E_STATO_SVILUPPO.md` (principio *Database prima*), `docs/MACROFASI_SVILUPPO.md` (Fase 6), `docs/SICUREZZA_HARDENING.md`.

---

## 10. Riferimenti rapidi

| Percorso | Uso |
|----------|-----|
| `agents/database.md` | Ruolo agente DB / regole apply |
| `sql/schema_completo_pizzamanager.sql` | Baseline |
| `sql/sql_upgrade.sql` | Indice moduli pendenti/storici 15–39 |
| `sql/modules/30_*.sql` … `39_*.sql` | Patch hardening / Realtime / Storage / anteprima |
| `sql/scripts/verify_database_inventory_readonly.sql` | Inventario remota |
| `sql/scripts/verify_security_definer_search_path.sql` | DEFINER senza path |
| `sql/scripts/smoke_rls_cross_tenant.sql` | Smoke isolamento |
| `sql/scripts/README_VERIFY_RLS.md` | Checklist Exposed schemas + JWT |
| `docs/MACROFASI_SVILUPPO.md` | Advisor 106→43, HIBP, Fase 6 |
| `docs/BACKLOG_E_STATO_SVILUPPO.md` | Gap esterni (HIBP, Stripe live) |

---

*Documento generato per il punto situazione del 2026-08-04 — agente Database / SQL / RLS.*
