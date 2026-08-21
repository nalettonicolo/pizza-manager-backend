# Migrazione da Supabase (hosted) a PostgreSQL dedicato

Obiettivo: usare **PostgreSQL sotto il tuo controllo** (es. server casa `ServerCasaNaletto`, porta 5432 in LAN) mantenendo **schema e dati** compatibili con quanto oggi gira su **Supabase Postgres**.  
Questo percorso mantiene **PostgreSQL** (Prisma `postgresql`); non prevede migrazione a MySQL.

Per **eliminare del tutto** Supabase (hosted e client in SPA), roadmap e fasi: **`docs/STACCO_SUPABASE_TOTALE.md`**.

**Supabase** = Postgres + **Auth** (`auth.*`) + **PostgREST** + **RLS** + **Realtime** + **Storage** + **Edge Functions**.  
Spostare solo il **database** su un Postgres “vanilla” **non** sostuisce automaticamente Auth, Realtime e Storage: vanno pianificati per fasi (o usare **Supabase self‑hosted** come ponte).

---

## 1. Due strategie possibili

| Strategia | Descrizione | Pro | Contro |
|-----------|-------------|-----|--------|
| **A — Postgres vanilla** | `pg_dump` dal progetto Supabase → `pg_restore` sul tuo Postgres; Nest con `DATABASE_URL` verso il nuovo host; la SPA può restare con `@supabase/supabase-js` **solo** se reindirizzi il client a un endpoint compatibile (in pratica serve ancora stack API tipo PostgREST + JWT — oggi **non** incluso “batterie incluse” nel repo). | Controllo totale sul DB, backup `pg_dump` tuoi, nessun vendor lock sul **motore** SQL. | Devi sostituire **Auth**, **Realtime**, chiamate dirette PostgREST dalla SPA, **Storage**, Edge: lavoro applicativo grande. |
| **B — Supabase self‑hosted** | Esegui lo stack open source Supabase sul tuo server (Docker), collegato al tuo volume Postgres. | La SPA e molte RLS/RPC restano **molto** simili all’hosted; migrazione meno traumatica. | Complessità operativa (container, aggiornamenti, monitoring); resti sul “modello” Supabase. |

Per **PizzaManager** oggi (React + Supabase JS + RPC + Nest parziale), la strada **incrementale** più realistica è spesso: **Nest + `DATABASE_URL` sul nuovo Postgres** (dati letti/scritti via API dove già predisposto) e **convivenza** con Supabase hosted per il resto, fino a parity — allineato a `docs/COORDINAMENTO_EPIC_E_INFRASTRUTTURA.md`.

---

## 2. Migrazione dati e schema (logico) verso Postgres dedicato

### 2.1 Prerequisiti

- Postgres **versione compatibile** con il progetto (es. 15+; sul server hai già 18 — verifica con `SELECT version();` dopo restore).
- Estensioni usate dal progetto (es. `uuid-ossp`, `pgcrypto`): installale sul target **prima** del restore (`CREATE EXTENSION IF NOT EXISTS ...`).
- Spazio disco sufficiente per dump + restore (circa **2×** la dimensione del DB compresso in fase di restore).

### 2.2 Export da Supabase (hosted)

1. In **Supabase Dashboard** → **Database** → stringa di connessione (**Direct** per dump grandi; **Pooler** solo se documentato per `pg_dump` — spesso si preferisce **direct** per consistenza logica).
2. Da una macchina fidata (non committare password):

```bash
# Esempio: formato custom, include schema + dati (adatta URI e path)
pg_dump "postgresql://USER:PASSWORD@HOST:5432/postgres" \
  -Fc -f pizzamanager_supabase.dump
```

3. Per ridurre sorpresa ruoli/owner in ambiente nuovo, spesso si usa restore con mapping (vedi sotto).

### 2.3 Import sul Postgres “casa”

1. Crea un database vuoto, es. `pizzamanager`, e un ruolo applicativo (es. `pizzamanager_app`) con password forte.
2. Restore (esempio — **adatta** ruoli e path):

```bash
pg_restore -h 127.0.0.1 -p 5432 -U postgres -d pizzamanager \
  --no-owner --no-acl \
  pizzamanager_supabase.dump
```

`--no-owner --no-acl` evita di dipendere dai ruoli proprietari Supabase (`supabase_admin`, ecc.) sul nuovo server. Dopo il restore, **riassegna owner** delle tabelle/viste al ruolo applicativo e verifica **GRANT** minimi per Nest/Prisma.

3. Esegui eventuali patch non nel dump: **`sql/sql_upgrade.sql`** (idempotente) se il target è stato creato da baseline diverso.

### 2.4 Alternative al dump completo

- **Nuovo ambiente vuoto:** applica **`sql/schema_completo_pizzamanager.sql`** (solo contesti controllati), poi migrazione dati selettiva per tabelle (ETL custom). Utile per ridurre schema `auth`/`storage` se non ti servono sul target.

---

## 3. Collegare il backend Nest al nuovo Postgres

1. Sul server (o su Koyeb), imposta **`DATABASE_URL`** verso il nuovo host (es. `postgresql://pizzamanager_app:PASSWORD@127.0.0.1:5432/pizzamanager`).
2. `cd server/pizzeria-backend && npx prisma migrate deploy` **solo** se usi migrazioni Prisma versionate; nel repo storico molte modifiche passano da SQL manuale — in quel caso verifica **`prisma db pull`** / allineamento `schema.prisma` in un branch dedicato.
3. `npm run build` e smoke test API (`/api/auth/login` se usi Nest auth, endpoint operativi già cablati).

**Multi-tenant:** ogni query Nest deve continuare a filtrare per `tenant_id` coerente con il JWT/sessione — nessun bypass solo perché il DB è “tuo”.

---

## 4. Frontend e Supabase JS dopo lo spostamento del DB

- Se il **solo** DB è migrato ma **Auth e URL** restano il progetto **hosted**, la SPA continua a puntare a `VITE_SUPABASE_URL` hosted: i dati **non** saranno quelli del Postgres casa, a meno di replica/logical sync (non trattato qui).
- Per usare **un unico Postgres** come fonte di verità con la SPA **senza** riscrivere tutto subito, le opzioni sono in pratica: **Supabase self‑hosted** con stesso progetto logico, oppure **espandere Nest** + ridurre gradualmente `supabase.from(...)` nel client (`docs/ARCHITETTURA_API_E_RUOLI.md`).

---

## 5. Rete e sicurezza (allineamento con le guide già in repo)

- **Non** esporre Postgres (5432) su Internet: vedi **`docs/FASE_0_RETE_SELFHOST.md`**.
- API pubblica solo dietro **HTTPS** (Caddy/Nginx) verso Nest: **`docs/FASE_1_AUTH_E_API_SELFHOST.md`** e `infra/selfhost/`.

---

## 6. Checklist sintetica (Definition of Done parziale “solo DB”)

- [ ] Dump/restore verificati; estensioni presenti; owner/grant coerenti con ruolo Nest.
- [ ] `DATABASE_URL` aggiornato; backend parte; smoke ordini/letture via Prisma.
- [ ] Piano esplicito per **Auth** (Nest JWT vs `auth.users`), **Realtime**, **Storage** (anche “restiamo hosted per X mesi”).
- [ ] Backup automatici sul nuovo Postgres (`pg_dump` schedulato + prova restore).
- [ ] Rollback documentato (come tornare al pooler Supabase precedente).

---

## 7. Riferimenti incrociati

| Documento | Contenuto |
|-----------|-----------|
| `sql/schema_completo_pizzamanager.sql` / `sql/sql_upgrade.sql` | Baseline e indice patch incrementali (`sql/modules/18–38`). |
| `docs/FASE_0_RETE_SELFHOST.md` / `docs/FASE_1_AUTH_E_API_SELFHOST.md` | Rete sicura + API Nest in produzione. |
| `docs/COORDINAMENTO_EPIC_E_INFRASTRUTTURA.md` | Ordine epic e criteri di cutover. |

*Documento operativo: aggiornare in sede con URI, nomi ruoli e procedure backup reali del vostro ambiente.*
