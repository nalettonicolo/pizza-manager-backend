# PizzaManager – Punto della situazione (enterprise)

**Ultimo aggiornamento:** stato di sviluppo dell’applicazione rispetto a quanto richiesto.

---

## Comportamento richiesto e stato attuale

- **pizzamanager.it (root):** deve mostrare la **landing page** (marketing SaaS). ✅ Implementato: su dominio `pizzamanager.it`, `app.*` e localhost la route `/` mostra la Landing (hero, piani, CTA).
- **Home della pizzeria:** si raggiunge **cliccando un pulsante nella landing**. ✅ Implementato: in Landing i link **«Prova gratuita»** (nav) e **«Inizia gratis» / «Prova Pro»** (pricing) puntano a **`/home`**, che è la home della pizzeria (benvenuto, Scegli punto vendita, Anteprima, area admin se loggato come admin).
- **Menu pubblico (negozio):** disponibile su **`/negozio`** quando si è su pizzamanager.it (o localhost). Su domini diverso da pizzamanager.it/app/localhost, la root `/` mostra direttamente il PublicStore (storefront pizzeria).

---

## Architettura attuale

- **Frontend:** Vite + React, deploy su **Firebase Hosting** (https://pizzamanager.it).
- **Backend:** NestJS + Prisma, deploy su **Koyeb** (Docker, branch main da GitHub).
- **Database:** Postgres su **Supabase** (schema `core` + tabelle/viste `public`, RLS dove previsto).
- **Auth:** JWT lato backend; Supabase Auth per utenti frontend (utenti_ruoli, clienti) dove richiesto.

Un solo backend in uso: **NestJS** in `server/pizzeria-backend`. Il frontend chiama l’API Nest (base URL in `VITE_API_URL`) e Supabase per auth/dati condivisi (tenant, menu pubblico, ordini dove previsto).

---

## Cosa è stato fatto

### Backend NestJS
- Auth (login/register), JWT, TenantGuard e decorator `@TenantId()`.
- Moduli: auth, users, platform, prisma. Schema Prisma multi-tenant (tenants, users, ordini, prodotti, ingredienti, audit_logs, subscriptions, configurazione_costi, riga_ordine).
- Deploy: Dockerfile multi-stage (`Dockerfile.koyeb`), entry `dist/src/main.js`, porta 8000. Build e deploy su Koyeb da GitHub.

### Frontend
- App React con contesti (Auth, Tenant, User, Operative). Aree: public, admin, operative (cassa, cucina, bancone, delivery, pizzaiolo, pony), superadmin.
- **Routing (AppRouter):** dominio SaaS = `pizzamanager.it` oppure `app.*` oppure localhost. Su SaaS: `/` = Landing, `/home` = Home pizzeria, `/negozio` = PublicStore (menu pubblico), `/login`, `/contatti`, `/select-pv`, `/preview`. Su altri domini (es. storefront dedicato): `/` = PublicStore.
- Variabili build: `VITE_API_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_GOOGLE_MAPS_API_KEY`. Build con `npm run build`, deploy con `firebase deploy --only hosting`.
- **Menu pubblico:** lettura da vista `prodotti_menu_pubblico` (servizio `publicService.getPublicMenu()`). Info tenant pubblico con `getPublicTenantInfo()` (id, nome, logo_url, indirizzo, orari_settimana).
- **Hero store / branding:** PublicStore passa `branding` a HeroStore (da tenant pubblico); HeroStore, StoreFooter e MenuPreview gestiscono `branding` undefined con oggetto sicuro (`branding ?? {}`).
- **Realtime Ordine:** subscription su `table: "Ordine"` (non "ordini") in `OrdinePage.jsx`.
- **Supabase in produzione:** messaggio in console se `VITE_SUPABASE_URL` o `VITE_SUPABASE_ANON_KEY` mancano nel build.

### Database (Supabase)
- **Schema completo:** `sql/schema_completo_pizzamanager.sql` (compattato). Include: core + public, vista `Prodotto` con `visibile_online`, vista **`prodotti_menu_pubblico`** per menu anonimo, **GRANT anon** su schema public e su tenants, Prodotto, punti_vendita, prodotti_menu_pubblico.
- **Colonna:** `core.prodotti.visibile_online` (BOOLEAN DEFAULT true).
- **Script incrementale unificato:** `sql/PM_UNIFIED_INCREMENTAL.sql` (visibile_online, viste `Prodotto` / `prodotti_menu_pubblico` con categoria, colonne accesso aree, `ruoli_pizzeria`, GRANT anon). Integrazioni backend in `server/pizzeria-backend/prisma/schema_integrazioni.sql`.
- Supabase: core + public (utenti_ruoli, clienti, anagrafica_clienti, viste, trigger, RPC `create_order_with_items`, ruoli_pizzeria, tenant_admins, chiusure_giornata).

### Deploy e documentazione
- **DEPLOY_COMANDI.md:** comandi da incollare in VS Code (backend + frontend) e spiegazione.
- **DEPLOY.md:** guida dettagliata Koyeb e Firebase. Script `deploy-firebase.ps1` per build + deploy frontend.

---

## Correzioni applicate (riferimento)

| Problema | Soluzione |
|----------|-----------|
| 404 su `ordini?select=...` | Realtime in OrdinePage: `table: "Ordine"` invece di "ordini". |
| 42501 permission denied for schema public | Script `sql/PM_UNIFIED_INCREMENTAL.sql` (sezione GRANT anon). |
| 401 Unauthorized su Prodotto/tenants | Build con `.env.production` (VITE_SUPABASE_*); messaggio in console se chiavi mancanti in prod. |
| 42703 column Prodotto.visibile_online does not exist | Colonna `visibile_online` su core.prodotti; vista `prodotti_menu_pubblico`; frontend usa `prodotti_menu_pubblico` per getPublicMenu(). |
| TypeError reading 'logo_url' (branding undefined) | PublicStore passa `branding` da tenant a HeroStore; HeroStore/StoreFooter/MenuPreview usano `branding ?? {}` e optional display. |
| getPublicTenantInfo senza logo/indirizzo | Select estesa a `id, nome, logo_url, indirizzo, orari_settimana`. |
| pizzamanager.it mostrava store invece della landing | AppRouter: `isSaaS` include `pizzamanager.it`; `/` = Landing, `/home` = Home pizzeria (link da Landing «Prova gratuita» / «Inizia gratis»); `/negozio` = PublicStore. |

---

## Cosa fare dopo (ordine suggerito)

1. **Tenant e route:** applicare TenantGuard e `@TenantId()` a tutte le route protette; filtrare sempre per `tenantId` nelle query.
2. **Audit:** chiamare AuditService in create/update/delete sensibili (ordini, utenti, prodotti).
3. **Soft delete:** usare `deletedAt` nelle query di lettura dove previsto.
4. **RLS Supabase:** verificare policy su tabelle core/public e allineare a `app.current_tenant_id` se si usa RLS lato DB.
5. **Billing Stripe:** integrazione subscription, webhook, blocco accesso se scaduta/sospesa.
6. **Sicurezza chiave Google Maps:** in Google Cloud Console restringere la chiave a referrer (es. https://pizzamanager.it/*) e alle sole API necessarie (Maps, Places).

---

## Comandi di riferimento

- **Deploy dopo modifiche:** vedi **DEPLOY_COMANDI.md** (backend git push, frontend build + firebase deploy, SQL su Supabase).
- **Installazione locale:** root `npm install`; in `server/pizzeria-backend`: `npm install`, `npx prisma generate`, `npx prisma db seed`. Variabili in `.env` e `.env.production` come da DEPLOY.md.
- **SQL Supabase:** reset completo → `sql/schema_completo_pizzamanager.sql`; solo integrazioni → `sql/PM_UNIFIED_INCREMENTAL.sql`; altre integrazioni → `server/pizzeria-backend/prisma/schema_integrazioni.sql`.
