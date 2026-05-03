# Stacco totale da Supabase — indipendenza operativa

Obiettivo: **nessuna dipendenza runtime** dal progetto **Supabase hosted** (niente `VITE_SUPABASE_URL` / anon key in produzione, niente `supabase.co`, niente Edge Functions su quella piattaforma).  
Il database resta **PostgreSQL** (già compatibile con Prisma in `server/pizzeria-backend`).

**Realtà del repo (2026):** la SPA usa `@supabase/supabase-js` in modo esteso (`adminService`, `cassaService`, `publicService`, `superadminService`, auth cliente, contesti, pagamenti, fiscal outbox, ecc.) e ci sono **Edge Functions** in `supabase/functions/`. Lo stacco totale è un **re‑platforming** in più release, non un singolo commit.

---

## 1. Cosa intendiamo per “indipendente”

| Livello | Indipendente quando… |
|---------|------------------------|
| **Dati** | Postgres gira **sul tuo hardware** (o VPS); backup e restore sono **tuoi**. Vedi `docs/MIGRAZIONE_SUPABASE_A_POSTGRES.md`. |
| **Accesso dal browser** | La SPA **non** chiama più PostgREST/Realtime/Storage Supabase: solo **HTTPS verso la tua API** (Nest). |
| **Auth** | Login, sessione, refresh, reset password, email verify: **tutti** su Nest (o IdP esterno **tuo**), JWT emessi da te. Oggi esiste già il percorso `VITE_USE_NEST_AUTH` + `core.users` — va **completato** e allineato a `auth.users` / `utenti_ruoli`. |
| **RPC e logica sensibile** | Già linea guida repo: **RPC `SECURITY DEFINER`** in SQL + chiamate tramite backend dove serve; allo stacco, le chiamate RPC dalla SPA diventano **endpoint Nest** che eseguono SQL/RPC lato server con `service_role` / utente DB dedicato. |
| **Realtime** | Sostituito con **WebSocket/SSE** Nest, **polling**, o `LISTEN/NOTIFY` dietro API — da progettare per cassa/cucina. |
| **File / immagini** | **Object storage** (MinIO, S3, NFS) + upload firmato da Nest; niente Supabase Storage. |
| **Pagamenti / job** | Funzioni in `supabase/functions/*` migrate su **Nest** (webhook Stripe, refund, ecc.) + code/worker se serve. |

**Nota su RLS:** le policy **RLS sono PostgreSQL native**; puoi mantenerle sul tuo Postgres **se** il client non si collega più direttamente al DB. In architettura “solo Nest parla al DB”, spesso si usa un ruolo DB **ristretto** + controlli tenant in applicazione; oppure session variables + RLS — va scelto e documentato per tenant.

---

## 2. Architettura obiettivo (sintesi)

```
Browser (SPA)  →  HTTPS  →  Caddy/Nginx  →  Nest (API + Auth + Webhook)
                                    ↓
                          PostgreSQL (tuo)
```

- Nessun `createClient(supabaseUrl, anonKey)` in bundle produzione.  
- Variabili: `VITE_API_URL` (obbligatoria); eventuali chiavi solo per mappe/Sentry, **non** Supabase.

---

## 3. Inventario “a caldo” (da dove partire in codice)

| Area | File / cartelle tipici |
|------|-------------------------|
| Admin tenant | `src/features/admin/services/adminService.js` (volume elevato) |
| Cassa / operativo | `src/features/operative/cassa/services/cassaService.js`, `operativeApi.js`, pagine operative |
| Pubblico / vetrina | `src/features/services/publicService.js`, `deliveryService.js`, checkout |
| Superadmin | `src/features/superadmin/services/superadminService.js` |
| Auth | `src/app/contexts/AuthContext.jsx`, `src/features/public/services/clienteAuthService.js` |
| Client Supabase | `src/lib/supabaseClient.js` — **da eliminare in produzione** a fine stacco |
| Edge | `supabase/functions/payment-*`, placeholder SumUp — **equivalenti Nest** |
| Fiscal / pagamenti | `src/integrations/fiscal/*`, `onlinePaymentService.js`, `CheckoutButton.jsx` |

Strumento utile per pianificare: grep `supabase` / `\.from\(` / `\.rpc\(` nel repo e assegnare ogni cluster a un’epica.

---

## 4. Fasi consigliate (ordine di rischio crescente)

1. **Postgres sotto controllo** — Dump/restore o baseline; Nest in produzione con `DATABASE_URL` sul nuovo cluster (**senza** ancora spegnere Supabase: convivenza read‑only o replica logica se sai operarla).  
2. **Auth unificata Nest** — Password reset, inviti, allineamento ID `core.users` vs profili staff; `VITE_USE_NEST_AUTH=true` in staging con test E2E.  
3. **Strato API per modulo** — Sostituire gruppi di chiamate in `adminService` / `cassaService` con `apiClient` verso Nest; **una feature alla volta** (allineato `docs/COORDINAMENTO_EPIC_E_INFRASTRUTTURA.md`).  
4. **Realtime** — Progetto dedicato per flussi che oggi usano channel Supabase.  
5. **Storage + Edge** — Migrazione file e webworker/pagamenti su Nest.  
6. **Cutover DNS e build** — Rimuovere `VITE_SUPABASE_*` dalla build produzione; disattivare progetto hosted solo dopo **rollback testato** (snapshot DB + revert deploy frontend).

Ogni fase: **CI verde**, smoke manuale, backup.

---

## 5. Cosa **non** fare

- **Big bang** (spegnere Supabase in un weekend): rischio blocco operatività pizzerie.  
- **Sostituire RLS solo nel frontend**: viola le regole di sicurezza del progetto; autorità su tenant e soldi resta **DB + API server**.  
- **Committare segreti** del nuovo ambiente in chiaro.

---

## 6. “Indipendenza” vs Supabase **self‑hosted**

Supabase open source sul tuo server ti dà **indipendenza dal vendor hosted**, ma **non** dall’ecosistema (GoTrue, Kong, Studio, ecc.). Se l’obiettivo è **zero stack Supabase**, l’architettura del §2 è quella corretta; se accetti ancora i componenti OSS, valuta solo come **ponte temporaneo**.

---

## 7. Documenti collegati

- `docs/MIGRAZIONE_SUPABASE_A_POSTGRES.md` — spostamento dati.  
- `docs/FASE_0_RETE_SELFHOST.md` / `docs/FASE_1_AUTH_E_API_SELFHOST.md` — rete e API.  
- `docs/ARCHITETTURA_API_E_RUOLI.md` — mappa attuale Supabase vs Nest.  
- `docs/COORDINAMENTO_EPIC_E_INFRASTRUTTURA.md` — governance e merge.  
- `@agents/supervisor.md` — validazione prima di cutover produzione.

---

*Prossimo passo consigliato in sede: decisione formale su **fase 1–2** (DB + auth Nest) e assegnazione owner per **adminService** vs **cassa** come primi blocchi API.*
