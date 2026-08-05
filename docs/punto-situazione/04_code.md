# Punto situazione — Code (React / frontend)

**Agente:** Code (sviluppatore React)  
**Repo:** `D:/APP_PIZZERIA/PizzaManagerApp`  
**Data:** 2026-08-05  
**Stack:** React + Vite (JSX), Supabase client, eventuale Nest (`VITE_API_URL` / auth Nest opzionale)

> Aggiornamento 2026-08-05: facade cassa (`cassaOrdiniService`, `useCassaModificaOrdine`, display delivery), `parametriService`, `onlinePaymentsAdminService`. Vedi `docs/DEBT_MONOLITH_PLAN.md`.

---

## 1. Struttura features

L’app è organizzata per **feature folder** sotto `src/features/`, con layout e router centrali.

| Area | Path tipico | Ruolo |
|------|-------------|--------|
| **public** | `src/features/public/` (~32 file) | Landing SaaS, vetrina (`PublicStore`), checkout online, login, area cliente |
| **admin** | `src/features/admin/` (~63 file) | Gestione tenant: menu, settings, magazzino, contabilità, dipendenti, ruoli, report, fidelity |
| **operative** | `src/features/operative/` (~54 file) | Cassa, cucina, bancone, pizzaioli, delivery/pony, turni, test «4 schermate» |
| **superadmin** | `src/features/superadmin/` (~41 file) | Piattaforma: tenant, piani, go-live, Sala QA, gate ingresso, guide |
| **shared / services** | `src/features/shared/`, `src/features/services/` | Utilità e servizi trasversali (es. `publicService.js`) |
| **pubblicazione** | `src/features/pubblicazione/` | Workspace pubblicazione sito (principalmente SA) |

**Shell e routing**

- Layout: `PublicLayout`, `AdminLayout`, `OperativeLayout`, `SuperAdminLayout` in `src/layouts/`.
- Router lazy: `src/router/AppRouter.jsx` (Suspense + chunk per pagina).
- Contesti app: `AuthContext`, `TenantContext`, `PvContext`, `PublicCartContext`, `CassaHeaderContext`.
- Guard: `ProtectedRoute`, `RoleGuard`, `AuthGuard`, route cliente dedicate.

**Operativo — sotto-moduli**

- `cassa/` — `CassaPage` monolitica + componenti (grid prodotti, carrello, riepilogo, fidelty, stampanti).
- `cucina/`, `bancone/`, `pizzaiolo/`, `delivery/` — dashboard di reparto.
- Hook condiviso: `useOperativeOrdersLiveRefresh` (Realtime + polling).

---

## 2. Pattern di codice

### 2.1 `adminService.js` come facade dati

File: `src/features/admin/services/adminService.js` (~146 export async).

- **Pattern dominante:** ogni operazione riceve `tenantId` (o id risorsa) e parla a PostgREST / RPC; le pagine non costruiscono query ad hoc se esiste già un metodo.
- **Scritture critiche via RPC** `SECURITY DEFINER`, non update client “ciechi” su totali/righe:
  - `create_order_with_items` ← `createOrder`
  - `replace_order_items`
  - `chiudi_giornata`, turni cassa (`turni_cassa_*`), `cassa_audit_log`
  - delivery: `delivery_mark_consegnato`, `delivery_mark_consegnato_with_proof`, `delivery_update_stato_consegna`
  - vetrina capacity: `vetrina_slot_carico_oggi`
  - notifiche/fiscale outbox, Stripe secret helpers
- **Letture** su viste/tabelle esposte (`Ordine`, `RigaOrdine`, `Prodotto`, magazzino/contabilità, fidelity, …) sempre filtrate per `tenant_id` dove applicabile.
- **Reachability helpers** (`*TableReachable`) per degradare UI se migration non applicata.
- **Nest optional:** se `nestOperativeWritesEnabled()`, `createOrder` prova Nest e fa fallback Supabase.

Stesso file è riusato anche da **vetrina/checkout pubblico** e da moduli operativi: non esiste un secondo “orderService” parallelo per il happy path.

### 2.2 Contesti auth / tenant / PV

**`AuthContext`**

- Sessione Supabase (`getSession` + timeout/failsafe) oppure profilo Nest JWT.
- Carica staff da `utenti_ruoli` (permessi `accesso_*`) oppure cliente da `clienti`.
- Espone `tenantId` **effettivo**: per Super Admin, se c’è override supporto, sostituisce il tenant del profilo.
- Campi chiave: `authTenantId`, `supportTenantOverride`, `isSupportTenantMode`, `permessiAree`, `nestTenantNome`.

**Support tenant override** (`src/utils/supportTenantOverride.js`)

- Query `support_tenant` (+ legacy `tenant`), storage `pm_sa_support_tenant`.
- Marker QA: `_qa_console`; navigazione preservata con `withPreservedSupportSearch`.
- Usato da Sala QA, Demo live, iframe/popup di supporto.

**`TenantContext` / `PvContext`**

- Tenant row da `public.tenants` (o Nest `/api/tenant/me`, o riga sintetica).
- PV: vista `punti_vendita`; in modalità supporto SA fa **auto-pick** del primo PV (modulo SQL 33: SA vede tutti i PV).
- `set_app_context` RPC per contesto PV lato DB quando disponibile.

### 2.3 Demo live

- Helper: `src/utils/demoGiro.js` (`_demo_giro`, `_demo_step`, step Cassa → Pizzaioli → Cucina → Bancone → Delivery).
- Ingresso: `SuperadminGatePage` → `setSupportTenantOverride` + navigate `withDemoGiroQuery` (tenant da `VITE_PUBLIC_DEMO_TENANT_ID` o primo tenant attivo).
- `OperativeLayout`: titolo sidebar «Demo live», hint navigazione, link «4 schermate», «Esci demo» → `/superadmin/ingresso`; **sidebar sempre visibile** (no full-bleed pizzaiolo).

### 2.4 Fix cassa nome / indirizzo

In `CassaPage.jsx`:

- Helper `splitNomeDaIndirizzoConsegna`: molti delivery storici hanno solo `indirizzo_consegna = "Nome – Via …"` senza `nome_cliente`.
- Split su trattini Unicode/ASCII; non splitta se il primo segmento sembra già un indirizzo (`Via|Viale|Piazza|…`) o è troppo lungo.
- `OrdineCardTitleRows` / `deliveryIndirizzoRiga`: titolo = nome (DB o parte sinistra); seconda riga = solo indirizzo formattato.
- Matching anagrafica: `indirizzoConsegnaMatchAnagrafica` + normalizzazione italiana.
- `ordineFieldHelpers.js` unifica snake/camel (`nome_cliente` / `nomeCliente`, ecc.).

### 2.5 `RouteErrorBoundary`

- Classe React in `src/components/RouteErrorBoundary.jsx`.
- Evita schermo beige vuoto se una pagina operativa crasha in render.
- UI: messaggio IT + `error.message` + bottone Ricarica.
- Oggi wrappa in router soprattutto **`/operative/cassa`** (`AppRouter.jsx`). Estendibile ad altri reparti.

### 2.6 Altri pattern ricorrenti

- **Lazy route + idle prefetch** nei layout.
- **Permessi aree** + gate servizi (`useTenantServizi`) senza bloccare troppo aggressivamente in admin.
- **Theme tenant** via `parametri_operativi` → CSS variables layout.
- Storage locale tenant (`useTenantLocalJson`) ancora usato in pezzi di magazzino/contabilità affiancati a tabelle DB.

---

## 3. Integrazioni

| Integrazione | Dove | Note |
|--------------|------|------|
| **Supabase Auth + PostgREST + RPC** | Default | Autorità su ordini, turni, proof, chiavi Stripe tenant |
| **Supabase Realtime** | `useOperativeOrdersLiveRefresh`, mappe delivery, pagine legacy | Schema `core.ordini`, filtro `tenant_id` + poll fallback |
| **Storage** | bucket `consegna-prove` | Upload firma/foto prima di RPC proof |
| **Nest backend** | `src/app/api/*`, flag Nest auth/writes | Opzionale; auth e create order con fallback |
| **Stripe (online)** | `onlinePaymentService`, RPC secret/status | Intent + finalize; live dipende da chiavi tenant |
| **POS / fiscale / notifiche** | adapter stub + outbox | Monitor admin; claim fiscal service_role |
| **Sentry** | `initSentry` | Telemetria errori |
| **Offline queue** | `src/offline/syncQueue.js` | Replay verso `create_order_with_items` |

---

## 4. Debito tecnico

1. **`CassaPage.jsx` ancora grande** — Fase 1 avviata (display, modifica ordine, facade ordini); restano checkout/planning/fidelity nello stesso file.
2. **`adminService.js` monolite** — Stripe + settings estratti; restano magazzino/contabilità/fidelity.
3. **Doppio percorso dati** — magazzino/contabilità: DB + `localStorage` tenant.
4. **`RouteErrorBoundary` ristretto** — soprattutto cassa; estendere ad altri reparti.
5. **Naming tabelle miste** — `Ordine` / `RigaOrdine` vs `core.*`.
6. **Auth Nest vs Supabase** — due modalità opzionali.
7. **Piani SA in localStorage** — listino commerciale non sempre allineato al server.

---

## 5. Prossimi passi (code)

1. ~~Estrarre modifica ordine / facade ordini~~ → **fatto** (`useCassaModificaOrdine`, `cassaOrdiniService`).
2. Estrarre `useCassaCheckout` / planning bar senza cambiare RPC.
3. Wrappare `RouteErrorBoundary` su `/operative/*` critiche.
4. Continuare slice `adminService` (magazzino / delivery) con re-export.
5. Completare migrazione magazzino/contabilità “DB first”.
6. E2E auth in CI quando disponibili `E2E_STAFF_*`.

---

## Riferimenti codice

- `src/features/admin/services/adminService.js`, `parametriService.js`, `onlinePaymentsAdminService.js`
- `src/features/operative/cassa/services/cassaOrdiniService.js`
- `src/features/operative/cassa/hooks/useCassaModificaOrdine.js`
- `src/app/contexts/AuthContext.jsx`, `TenantContext.jsx`, `PvContext.jsx`
- `src/utils/supportTenantOverride.js`, `src/utils/demoGiro.js`
- `src/features/operative/cassa/pages/CassaPage.jsx`
- `src/components/RouteErrorBoundary.jsx`
- `src/layouts/OperativeLayout.jsx`, `src/router/AppRouter.jsx`
- `src/features/superadmin/pages/SuperadminGatePage.jsx`
- `docs/DEBT_MONOLITH_PLAN.md`
