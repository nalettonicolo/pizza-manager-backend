# Piano milestone — stacco Supabase verso Nest (a blocchi)

**Premessa:** `supabase.auth` resta finché non avete un auth Nest/IdP dedicato. Questo piano copre **dati e funzioni** oggi su PostgREST / RPC / Realtime / Storage / Edge.

**Già in codice:** M1 (tenant vetrina), M2 (menu/categorie/ingredienti vetrina) — vedi `docs/STACCO_SUPABASE_TOTALE.md` e variabili `VITE_PUBLIC_*`.

---

## 1. Inventario rapido (ordine di lavoro consigliato)

| Blocco | File principale | Note | Dipendenze | Fase suggerita |
|--------|-----------------|------|------------|----------------|
| **Delivery token** | `deliveryService.js` | 1 RPC; oggi **nessun import** nel resto del repo (candidato a rimozione o API staff) | — | **M3** (piccolo) |
| **Cassa insert ordine legacy** | `cassaService.js` | Solo `Ordine` / `ordini_items` insert (legacy); il checkout web usa **`adminService.createOrder`**) | RPC `create_order_with_items` già lato DB | **M4** — allineare a Nest/RPC unica |
| **Ordini pubblici / checkout** | `PublicOrdineCheckoutPage.jsx`, `adminService.createOrder`, `onlinePaymentService.js` | Stripe intent, SumUp stub | Edge `payment-*` | **M5** |
| **Edge Functions** | `supabase/functions/*` | Stripe create-intent, webhook, refund, SumUp placeholder | M5 ordini/pagamenti | **M6** |
| **adminService — ordini & dashboard** | `adminService.js` (prima metà export) | `getOrders`, `createOrder`, KPI, `updateOrder*` | JWT staff (Supabase o Nest) | **M7a** |
| **adminService — anagrafica / fidelity** | idem | Clienti, punti, movimenti | M7a | **M7b** |
| **adminService — staff / HR / storage firme** | idem | `uploadStaffHrFile`, signed URL → **Storage** | Storage S3/MinIO | **M7c** + **M11** |
| **adminService — catalogo** | idem | categorie, ingredienti, prodotti, allergeni, foodcost | Prisma esistente parziale | **M8** |
| **adminService — contabilità / magazzino** | idem | tabelle opzionali, reachability | — | **M9** |
| **adminService — report / turni** | idem | report, `turniCassaAperto`, ecc. | RPC cassa | **M10** |
| **superadminService** | `superadminService.js` | tenant SaaS, subscription, registratore | Ruolo superadmin | **M12** |
| **Operative + Realtime** | `operative/*`, `operativeApi.js`, sottoscrizioni | Canali ordini/cassa/cucina | WebSocket Nest o polling | **M13** |
| **Storage generico** | upload immagini listino, HR, ecc. | Sostituto S3/MinIO + URL firmati Nest | M7c | **M11** |
| **Cliente area** | `clienteAuthService.js`, pagine `cliente/*` | Leggono ordini/profilo | **Auth** — fuori piano finché non c’è login Nest | **M14** (dopo auth) |

Le fasi **M7a–M10** possono essere riordinate se il prodotto richiede prima catalogo o prima cassa.

---

## 2. Dettaglio per macro-area

### A) `deliveryService.js`

- Una RPC `genera_delivery_token`. Se non è referenziata, valutare **rimozione** o esporre `POST /api/operative/...` con **JwtAuthGuard** (non pubblico anon).

### B) `cassaService.js`

- Due insert diretti: rischio RLS e duplicazione con `create_order_with_items`. Obiettivo: **solo** RPC o endpoint Nest già validati tenant.

### C) Ordini pubblici

- Flusso: carrello → `createOrder` in `adminService` (RPC/insert complessi) → pagamenti → notifiche.
- Accoppiare con **M6 Edge** (intent Stripe lato server).

### D) `adminService.js` (~120 punti Supabase)

Spezzare per **PR piccole** (una o poche funzioni export per volta), con flag tipo `VITE_ADMIN_MODULE_X_VIA_NEST` solo se serve rollback; spesso basta feature branch + test.

Gruppi logici utili:

1. Ordini lettura/scrittura e stati  
2. Dashboard / KPI  
3. Utenti staff / ruoli (attenzione: overlap con **auth** — solo letture profilo se auth resta Supabase)  
4. Catalogo completo  
5. Contabilità / magazzino  
6. Report e turni

### E) `superadminService.js`

- Tabelle `admin.*`, SaaS: conviene modulo Nest `PlatformModule` esteso con guard superadmin (JWT Nest futuro o header service finché auth è misto).

### F) Realtime

- Sostituire `supabase.channel` con: **polling** incrementale, **SSE**, o **WebSocket** Nest + tabella `notifiche` / `LISTEN/NOTIFY` Postgres. Dipende da latenza accettabile in cassa.

### G) Storage

- Migrazione bucket Supabase → **MinIO/S3**; Nest emette **presigned PUT/GET**; aggiornare `uploadStaffHrFile` e simili.

### H) Edge Functions

- Portare logica in **Nest controllers** + stessi secret da env; webhook con verifica firma; idempotenza.

---

## 3. Definition of Done (per ogni milestone)

- [ ] Nessuna regressione multi-tenant (test manuale su 2 tenant).  
- [ ] CI verde (`npm run ci:frontend` + build backend).  
- [ ] Documentato in `STACCO_SUPABASE_TOTALE.md` o in questo file (riga “completato”).  
- [ ] Rollback: flag env o revert commit documentato.

---

## 4. Cosa non fare in parallelo

- Non migrare **Realtime** e **riscrittura massiccia adminService** nello stesso sprint (stessi file UI cassa).  
- Non esporre RPC **sensibili** come endpoint **pubblici** senza JWT dove oggi richiedono `authenticated`.

---

## 5. Riferimenti

- `docs/STACCO_SUPABASE_TOTALE.md` — visione e M1–M2.  
- `docs/ARCHITETTURA_API_E_RUOLI.md` — chi chiama cosa.  
- `docs/COORDINAMENTO_EPIC_E_INFRASTRUTTURA.md` — merge e priorità.  
- `server/pizzeria-backend/src/operative/*` — pattern Nest + JWT già usato per letture operative.

---

*Aggiornare questo file quando una milestone viene chiusa (data + commit di riferimento).*
