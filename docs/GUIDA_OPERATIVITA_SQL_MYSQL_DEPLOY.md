# Guida operativa — SQL, MySQL on‑prem, deploy (PizzaManager)

Questa guida raccoglie **tutti i passaggi** per lavorare in sicurezza su schema database, preparare un **server MySQL su PC industriale** (roadmap) ed eseguire un **deploy completo** del frontend. Per il solo stacco da Supabase vedi anche `docs/MIGRAZIONE_MYSQL_E_BACKUP.md`.

---

## Parte A — Workflow SQL (baseline progetto)

### A1. Ruoli dei file

| File | Ruolo |
|------|--------|
| `sql/schema_completo_pizzamanager.sql` | **Baseline unica**: snapshot Postgres/Supabase consolidato; va applicato su DB vuoto solo in contesti controllati (nuovo ambiente, disaster recovery). In coda può esserci un blocco **CONSOLIDAMENTO FASE N** con patch già integrate. |
| `sql/sql_upgrade.sql` | **Solo patch incremental** da applicare su DB **già esistenti** (staging/produzione). Dopo verifica, il contenuto va **copiato in** `schema_completo` e questo file torna al **template vuoto**. |
| `docs/sql/append_phase0_consolidamento_*.sql` | Copia di lavoro del blocco consolidato (opzionale); la fonte “ufficiale” resta la **coda** di `schema_completo`. |

### A2. Procedure consigliata (ogni modifica SQL)

1. Scrivere la patch in `sql/sql_upgrade.sql` (idempotente dove possibile: `IF NOT EXISTS`, `CREATE OR REPLACE`, ecc.).
2. Applicarla su **staging** (Supabase SQL editor o `psql`).
3. Testare i flussi toccati (cassa, ordini, vetrina, admin).
4. **Consolidare**: copiare la patch nella sezione appropriata di `schema_completo` **oppure** in coda come blocco datato, con commento `CONSOLIDAMENTO FASE …`.
5. **Svuotare** `sql_upgrade.sql` lasciando solo l’intestazione template.
6. Commit con messaggio chiaro (`sql: consolidamento …`).

### A3. Fase 0 (stato repository)

- È stato consolidato in coda a `schema_completo` il blocco **CONSOLIDAMENTO FASE 0 (2026-04-18)**: RPC `create_order_with_items` (hardening tenant + `web_cliente_user_id` + `p_telefono_ritiro`), `delivery_mark_consegnato`, vincolo/view/trigger `prodotto_ingrediente` (`posizione_cottura`).
- `sql/sql_upgrade.sql` è stato **ripulito** al template (nessuna patch pendente).

### A4. Cosa non fare

- Non duplicare la stessa patch sia nel mezzo dello `schema_completo` sia in `sql_upgrade` senza una transizione documentata.
- Non applicare in produzione patch non testate su staging.

---

## Parte B — Server MySQL su PC industriale (preparazione)

> Obiettivo: **operabilità massima** in sede (backup, controllo, assenza vincoli SaaS). Lo **svincolo da Supabase** non è solo “export MySQL”: servono **Auth**, **API**, sostituti di **RLS/Realtime/Storage**. Dettaglio in `docs/MIGRAZIONE_MYSQL_E_BACKUP.md`.

### B1. Hardware e sistema

1. PC industriale con RAM/SSD adeguati, rete cablata stabile.
2. **NTP** attivo (orologio corretto per ordini e log).
3. **UPS** consigliato se il locale è in produzione.
4. OS: Linux Server LTS **oppure** Windows Server se richiesto dall’integrazione locale.

### B2. Software base on‑prem

1. **MySQL 8** (utf8mb4), utenti DB con privilegi minimi.
2. **TLS** tra client e API; MySQL in ascolto solo su rete fidata o localhost (non esporre 3306 su Internet senza VPN).
3. Process manager per API (systemd, PM2, NSSM) + **reverse proxy** (nginx/Caddy/IIS) con HTTPS.
4. **Backup**: `mysqldump` pianificato + prova di **restore** trimestrale documentata.

### B3. Applicazione (roadmap tecnica)

1. Inventario chiamate dal frontend (`adminService`, `publicService`, `cassaService`, …) → contratti API.
2. Estendere backend (`server/pizzeria-backend`, Prisma oggi **PostgreSQL**) con piano di migrazione provider **MySQL** (non è solo cambio URL).
3. Convivenza staging: feature flag / `VITE_API_URL` per moduli migrati.
4. Cutover solo dopo test E2E e rollback documentato.

---

## Parte C — Deploy completo e “serio” (frontend produzione)

### C1. Qualità prima del deploy

Dalla root del progetto:

```powershell
cd D:\APP_PIZZERIA\PizzaManagerApp
npm ci
npm run ci:frontend
```

Comprende: **lint**, **test** (unit + promozioni), **build** Vite. Deve essere **verde** prima di pubblicare.

### C2. Variabili ambiente (build)

- Configurare `.env` / `.env.production` con chiavi **Supabase**, **Sentry** (se usato), URL API se presente, senza committare segreti.
- Verificare che il dominio di produzione punti al progetto Firebase corretto.

### C3. Firebase Hosting (deploy frontend)

Script tipici (da `package.json`):

```powershell
npm run deploy:hosting:ci
```

Usa `firebase deploy --only hosting` in modo non interattivo adatto a CI. In locale interattivo si può usare `npm run deploy:hosting`.

**Prerequisiti:** Firebase CLI loggata (`firebase login`), progetto selezionato (`firebase use`), regole hosting e rewrite coerenti con SPA React.

### C4. Dopo il deploy

1. Aprire il sito in finestra anonima e verificare login, cassa (se accessibile), vetrina.
2. Opzionale: `npm run check:live` se configurato per il dominio.
3. Monitorare console browser e (se presente) Sentry per errori nuovi.

### C5. Documentazione deploy aggiuntiva

- `DEPLOY.md` — flusso GitHub/Koyeb/Firebase dettagliato.
- `DEPLOY_COMANDI.md` — comandi rapidi.

---

## Parte D — Checklist stile supervisore (pre‑merge / pre‑deploy)

Allineata a `agents/supervisor.md` (senza sostituire il processo umano):

- [ ] **SQL**: patch consolidate; `sql_upgrade` solo template se la modifica è in baseline.
- [ ] **Sicurezza**: nessun bypass tenant; RPC sensibili coerenti con test staging.
- [ ] **Test**: `npm run ci:frontend` verde.
- [ ] **Deploy**: build produzione ok; smoke manuale su route critiche.
- [ ] **Rollback**: commit precedente noto o piano di ripristino Hosting.

---

## Riferimenti incrociati

| Documento | Contenuto |
|-----------|-----------|
| `docs/MIGRAZIONE_MYSQL_E_BACKUP.md` | Stack equivalente a Supabase, crittografia, piano migrazione |
| `docs/COORDINAMENTO_EPIC_E_INFRASTRUTTURA.md` | Ordine epic, MySQL vs Supabase |
| `agents/README.md` | Ciclo agenti (product → … → supervisor) |
| `procedere da qui.txt` | Backlog prodotto + roadmap fasi |

---

*Ultimo aggiornamento: consolidamento Fase 0 SQL e guida unificata deploy/on‑prem.*
