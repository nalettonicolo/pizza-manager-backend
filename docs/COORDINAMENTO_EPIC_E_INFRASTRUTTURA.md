# Coordinamento epic, migrazione dati e infrastruttura

Documento di **governance**: cosa fare **in ordine**, cosa è **fuori scope immediato**, come si collegano product, architettura, database, code, UI, test, security, copy, supervisor.

**Premessa realistica:** non è possibile “risolvere tutti i contro” e migrare da Supabase a MySQL in un singolo intervento. Questo file fissa **fasi** e **criteri di uscita** (Definition of Done).

---

## Supervisore — regole di coordinamento

1. Nessuna epic in parallelo se condivide gli stessi file critici (es. `CassaPage.jsx` + stesso RPC).
2. Ogni merge: **CI verde** (`npm run ci:frontend`) + note in `BACKLOG_E_STATO_SVILUPPO.md` se cambia stato epico.
3. **MySQL / stacco Supabase**: solo dopo fase di **repository layer** e doppia scrittura o freeze feature (vedi sotto).

---

## Epic 1 — Cassa mantenibile

**Obiettivo:** ridurre monolite senza cambiare comportamento.

| Step | Owner principale | Deliverable |
|------|------------------|-------------|
| 1.1 | code + ui | Estrarre helper ordine in `ordineFieldHelpers.js` + test Vitest. |
| 1.2 | code + ui | Estrarre `CassaModificaOrdineModal.jsx` (completato in repo). |
| 1.3 | code | Estrarre modale dettaglio ordine / planning bar a chunk dedicati. |
| 1.4 | test | Smoke checklist manuale + test su pure function estratte. |
| 1.5 | supervisor | Confronto pre/post (stessi flussi: checkout, modifica ordine, misto). |

**DoD:** stessi RPC e stessi stati; nessuna rimozione di feature.

---

## Epic 2 — Dati admin unificati (localStorage → Supabase)

**Obiettivo:** una sola fonte di verità per magazzino/contabilità.

| Step | Owner | Deliverable |
|------|-------|----------------|
| 2.1 | product + architecture | Ordine delle sottosezioni (es. DDT → movimenti → fatture). |
| 2.2 | database | Tabelle/RLS per prima sottosezione + migrazione dati opzionale script. |
| 2.3 | code | Adapter che legge da Supabase con fallback read-only a localStorage fino a cutover. |
| 2.4 | security | Policy per tenant; nessun `SELECT` globale. |
| 2.5 | test | Test integrazione su staging. |

**DoD:** una sottosezione alla volta in produzione con rollback documentato.

---

## Epic 3 — Qualità percepita

**Obiettivo:** pattern unificati empty / loading / error + glossario.

| Step | Owner | Deliverable |
|------|-------|-------------|
| 3.1 | ui | Componenti o classi CSS condivise (anche minimi). |
| 3.2 | copywriter | Glossario termini + revisione stringhe più visibili. |
| 3.3 | code | Applicazione progressiva per area (public → operative → admin). |

---

## Epic 4 — Sicurezza operativa

**Obiettivo:** processi ripetibili + verifiche staging.

Vedi **`docs/SICUREZZA_HARDENING.md`** e script / note in **`sql/scripts/README_VERIFY_RLS.md`**.

---

## Epic 5 — Ordini online / pagamenti

**Obiettivo:** Stripe/SumUp in produzione solo con account e webhook reali.

| Step | Owner | Deliverable |
|------|-------|-------------|
| 5.1 | product | Flusso felice + edge (pagamento fallito, timeout). |
| 5.2 | architecture | Mappa Edge ↔ DB ↔ client. |
| 5.3 | code + test | Test con chiavi test; niente chiavi live in repo. |
| 5.4 | security | Validazione importi, idempotenza, webhook signature. |

---

## Migrazione futura MySQL e backup (fuori Cursor “automatico”)

**Motivazione business:** controllo totale, backup pianificati, nessun vincolo piano Supabase.

**Implicazioni tecniche (non banali):**

- **Auth:** oggi `auth.users` / JWT Supabase → sostituire con provider (es. Keycloak, Auth0, o auth custom) + sessioni.
- **RLS:** Postgres RLS non esiste in MySQL allo stesso modo → **autorizzazione in applicazione** + viste/stored procedure + **disciplina ferrea** nei servizi.
- **Realtime / Storage:** sostituire con alternative (Socket, polling, S3/MinIO).
- **Edge Functions:** portare su worker (Node, Cloud Run, ecc.).
- **Costo:** mesi-uomo elevati; conviene **repository pattern** nel backend prima di cambiare motore.

**Fasi suggerite (alto livello):**

1. Introdurre **data access layer** nel backend (Nest o altro) usato dal frontend via API, mantenendo Supabase come DB primario per un periodo.
2. **Replicare read** su MySQL (CDC o batch) per backup analytics; verificare consistenza.
3. **Cutover** per modulo (es. solo report) poi core ordini.
4. **Spegnere** Supabase solo quando auth, pagamenti, RLS-equivalente e backup sono certificati.

Dettaglio dedicato: **`docs/STACCO_SUPABASE_TOTALE.md`** e **`docs/MIGRAZIONE_SUPABASE_A_POSTGRES.md`** (PostgreSQL dedicato, senza cambiare dialetto Prisma).

---

## Stato sintetico supervisore

- **Epic 1:** avviata (step 1.1–1.2 in codice).
- **Epic 2–5 e MySQL:** pianificate qui; esecuzione per sprint successivi.
