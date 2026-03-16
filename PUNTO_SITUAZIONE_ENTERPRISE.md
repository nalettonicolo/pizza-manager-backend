# PizzaManager – Punto della situazione (enterprise)

## Cosa è stato fatto in questa sessione

### 1. Schema Prisma enterprise
- **Tenants**: aggiunti `slug` (unique), `piano` (FREE/PRO/ENTERPRISE), `updatedAt`, `deletedAt`.
- **Users**: aggiunti `attivo`, `last_login`, `updatedAt`, `deletedAt`; email univoca globale.
- **Subscriptions**: nuova tabella (Stripe-ready: `stripeCustomerId`, `stripeSubscriptionId`, `piano`, `stato`, `rinnovoIl`).
- **AuditLog**: nuova tabella (`tenantId`, `userId`, `azione`, `entita`, `entitaId`, `meta` JSON).
- **Soft delete**: `deletedAt` su Tenant, User, ConfigurazioneCosti, Ingrediente, Prodotto, Ordine.
- **Indici**: su `tenantId`, `slug`, `stato`, `createdAt`, `email` dove serve.

### 2. Backend NestJS
- **Auth**: `AuthService` aggiornato per usare il modello `User` (non più `utente`/`userTenant`), con `argon2`, `lastLogin`, controllo tenant attivo.
- **Tenant**: decorator `@TenantId()` e `TenantGuard` per leggere/integrare il `tenantId` dal JWT nelle route protette.
- **Audit**: `AuditService` per scrivere in `audit_logs` (da iniettare dove serve).

### 3. Sicurezza e DB
- **SQL**: file `supabase/migrations/20250211000000_rls_and_indexes_enterprise.sql` con indici consigliati e esempio RLS (da adattare ai nomi reali delle tabelle).
- **Middleware tenant**: uso obbligatorio di `tenantId` dalle route protette (decorator + guard); ogni query deve filtrare per `tenantId`.

### 4. Documentazione
- **Migrazioni**: `server/pizzeria-backend/prisma/migrations/README_MIGRATION.md`.
- **Installazione**: `INSTALLAZIONE_PACCHETTI.md` con i comandi da eseguire in Cursor.

---

## Cosa resta da fare (ordine suggerito)

1. **Middleware tenant “blindato”**  
   Applicare `TenantGuard` e `@TenantId()` a tutte le route protette e passare sempre `tenantId` ai servizi (findMany/create/update con `where: { tenantId }`).

2. **RLS su Supabase**  
   Decidere se isolare per tenant anche lato DB con RLS; in caso positivo, adattare le policy in `20250211000000_rls_and_indexes_enterprise.sql` ai nomi reali delle tabelle/schema.

3. **Onboarding SaaS**  
   Flusso: registrazione → creazione Tenant + User OWNER → trial (opzionale) → redirect in dashboard.

4. **Billing Stripe**  
   Integrazione Stripe, webhook, blocco accesso se subscription scaduta/sospesa.

5. **Audit log**  
   Chiamare `AuditService.log()` in create/update/delete sensibili (ordini, utenti, prodotti, ecc.).

6. **Soft delete**  
   Nelle query leggere usare `where: { deletedAt: null }` (o middleware Prisma per applicarlo in automatico).

7. **Dashboard KPI**  
   Fatturato, ticket medio, coperti, performance operatori (query su `ordini`/righe per tenant).

8. **Sicurezza chiave API Google Maps**  
   La chiave `VITE_GOOGLE_MAPS_API_KEY` è usata per Places Autocomplete nella pagina **Dati pizzeria** (Impostazioni). In **Google Cloud Console**: restringere la chiave per **referrer HTTP** (solo i domini dell’app, es. `https://tuodominio.com/*`) e limitare le API a **Maps JavaScript API** e **Places API**. Valutare la **rotazione della chiave** se è stata esposta in chat o in repository pubblici.

---

## Comandi da eseguire (Cursor)

Vedi **`INSTALLAZIONE_PACCHETTI.md`**. In sintesi:

```bash
# Root (frontend)
cd d:\APP_PIZZERIA\PizzaManagerApp
npm install

# Backend Nest + Prisma
cd d:\APP_PIZZERIA\PizzaManagerApp\server\pizzeria-backend
npm install
npx prisma generate
npx prisma migrate dev --name enterprise_saas
npx prisma db seed
```

Poi configurare `.env` con `DATABASE_URL` e `JWT_SECRET` e andare online (build + deploy).

---

## Cassa, Homepage, Ruoli e Piani (aggiornamento)

### Cassa operativa
- **Cerca pizza**: barra di ricerca sopra la griglia prodotti (filtro per nome).
- **Modifica pizza**: modale con per ogni ingrediente **Poco / Abbondante / Senza** e **In cottura / A fine cottura**; **Aggiungi ingrediente** con barra di ricerca sotto la pizza (stesse opzioni).
- **Checkout**: **Note ordine** (textarea), **Tipo pagamento** (Contanti, Carta, Altro). Lato cassa **nessun limite** sulla selezione orario (slot illimitati).
- **Creazione ordine**: `adminService.createOrder(tenantId, { totale, stato, items, note, tipoPagamento })` chiama la RPC `create_order_with_items`.

### SQL da eseguire su Supabase (ordine)
1. **`prisma/ordini_note_tipo_pagamento.sql`** – Aggiunge colonne `note`, `tipo_pagamento` a `core.ordini` e aggiorna la vista `public."Ordine"` per esporle.
2. **`prisma/create_order_with_items_rpc.sql`** – Crea la funzione `create_order_with_items(p_tenant_id, p_totale, p_stato, p_items, p_note, p_tipo_pagamento)` che inserisce in `core.ordini` e `core.riga_ordine`.

### Homepage pizzeria (`/home`)
- Mostra **Pizzeria** (da tenantData) e **Piano** (Free/Pro/Enterprise) se diverso da Free.
- Link rapidi: **Scegli punto vendita**, **Anteprima store**.
- Se l’utente è **admin**: card **Dashboard**, **Impostazioni**, **Ruoli**.

### Piani e feature (enterprise)
- **`src/app/hooks/usePlan.js`**: hook `usePlan()` che espone `plan`, `level`, `canUseFeature(nome)`, `isFree`, `isPro`, `isEnterprise`.
- **Piano** letto da `tenantData.piano` (FREE | PRO | ENTERPRISE).
- Feature esempi: `slot_illimitati_cliente` (PRO+), `report_avanzati` (PRO), `multi_punto_vendita` / `white_label` (ENTERPRISE). Utilizzabili con `canUseFeature('nome_feature')` per abilitare/disabilitare funzioni in base all’abbonamento.

### Pagine operative per ruolo
- **Cucina**: elenco ordini in stato **IN_PREPARAZIONE**; pulsante **Segna come pronto** → stato **PRONTO**.
- **Bancone**: elenco ordini **PRONTO**; pulsante **Ritirato** → **CONSEGNATO**.
- **Pony / Delivery**: elenco ordini **PRONTO**; pulsante **Segna consegnato** → **CONSEGNATO** (identificativo operatore da email, es. pony1, pony2).
- **Cassa**: vedi sopra (ricerca, modale modifica pizza, note, tipo pagamento, conferma ordine).

### Test rapidi
1. **Cassa**: login come cassa → aggiungi prodotto con ingredienti → modifica varianti/cottura e/o aggiungi ingrediente → note e tipo pagamento → Conferma ordine (dopo aver eseguito i due SQL sopra).
2. **Cucina**: ordine creato da cassa (stato IN_PREPARAZIONE) → login cucina → vedi ordine → Segna come pronto.
3. **Bancone**: ordine in PRONTO → login bancone → Ritirato.
4. **Pony/Delivery**: ordine in PRONTO → login pony/delivery → Segna consegnato.
5. **Home**: login admin → `/home` → vedi card Punto vendita, Anteprima, Dashboard, Impostazioni, Ruoli; piano mostrato se Pro/Enterprise.
