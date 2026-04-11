# Punto della situazione — webapp PizzaManager (visione completa)

Documento di sintesi: **cosa vuoi come prodotto**, **cosa c’è nel repo**, **cosa manca**. Allineato a `ARCHITETTURA_E_STATO.md`, `BACKLOG_E_STATO_SVILUPPO.md`, `ROADMAP_CASSA_ENTERPRISE.md`, `PUNTO_SITUAZIONE_ENTERPRISE.md`, aggiornato con sviluppi recenti (cassa enterprise, pagamenti online, rider, UX pubblico/operativo).

---

## 1. Visione: webapp completa

Piattaforma **SaaS multi-tenant** per pizzerie con un **solo motore** (ordini, menu, tenant) e interfacce per ruolo.

| Area | Ruolo |
|------|--------|
| **Marketing / acquisizione** | Landing, contatti, piani (listino), registrazione, supporto |
| **Tenant (pizzeria)** | Admin: menu, listini, dipendenti, ruoli, impostazioni (dati, orari, parametri, area consegna, segreti pagamento), report; magazzino e contabilità (oggi in parte **dati locali** nel browser) |
| **Operativo** | Cassa (turni, audit), cucina, bancone, pizzaiolo, delivery/pony, prodotti esauriti, turni; permessi per area e gate sui **servizi del piano** |
| **Clienti finali** | Menu online / vetrina, carrello, ordine e checkout (pagamento online dove abilitato) |
| **Piattaforma** | Super Admin: tenant, piani/servizi, deploy, guide, pubblicazione dominio, strumenti di test |
| **Enterprise (roadmap)** | Cassa solida → **offline/DR** → **allineamento fiscale IT** (registratore, corrispettivi, hardware) |
| **Infrastruttura** | Frontend (es. Firebase), DB Supabase (RLS, RPC, viste), API Nest dove usata, Edge Functions (es. pagamenti), integrazioni (Stripe, mappe) |

Obiettivo implicito: **non** siti clienti scollegati dal gestionale, ma un perimetro unico governabile.

---

## 2. Cosa è già stato fatto (stato realistico)

### Prodotto core

- Routing SaaS vs dominio pizzeria: landing, home, negozio/preview, login, admin, operativo, superadmin, area cliente.
- **Menu pubblico** da vista `prodotti_menu_pubblico`, info tenant pubblico, branding vetrina; RPC per dominio dove previsto.
- **Area operativa** per reparto con permessi e, se attivo, vincolo ai servizi del tenant.
- **Super Admin**: dashboard tenant, catalogo servizi, UI enterprise, guide, flussi deploy/pubblicazione.

### Cassa / enterprise (blocco A, in avanzamento)

- Turni cassa (RPC/tabelle), ordine legato al turno, parametri obbligatorietà turno.
- **Audit cassa** (`cassa_ordine_audit`, logging checkout), pagamento misto esteso, arrotondamenti, sconti, telemetria opzionale.
- **Allineamento perimetro fiscale (ingegneria)**: tabelle `fiscal_outbox` / `payment_link_intents` e integrazione client in cassa (`src/integrations/fiscal/`); **nessuna** sostituzione di RT/SDI certificati senza fornitore.

### Ordini online / pagamenti

- Percorso **Stripe** (migration, Edge create-intent, webhook, integrazione frontend) per pagamenti online; **SumUp** come percorso/stub dove previsto. In produzione servono account, chiavi e ambiente allineati.

### Consegne / rider

- Schema e migration **rider / consegna enterprise** nel repo; completamento UI/app rider e SLA restano backlog di ampiezza maggiore.

### UX e stabilità (recenti)

- **Super Admin**: menu orizzontale **compatto** con dropdown al hover per le sottovoci; stesso modello nel menu hamburger su mobile (`SuperAdminLayout`, `superadmin-enterprise.css`).
- **Layout**: aree principali sfruttano **larghezza piena** del viewport (Super Admin, admin, operativo, pubblico dove applicato).
- **Performance**: chunk Vite separati (React, markdown, Stripe, Sentry, ecc.), lazy load di route pubbliche, analisi bundle con `npm run build:analyze`.
- Vetrina: con **ordini online disattivati**, hero e percorsi CTA coerenti; menù pubblico con ricerca / tab categorie / griglia prodotti allineata alla cassa dove implementato.
- Vetrina: nav su `/negozio` e `/preview`, tenant da query string (`getPublicTenantInfo({ search })`).
- Account test **4 reparti** (`pizzaioli@pizzamanager.it`): dopo login **`/operative/pizzaiolo-ingresso`** con due pulsanti (schermata Pizzaiolo full / Test 4 pannelli); griglia **senza iframe** (`MemoryRouter`); permessi/servizi; `getOperativeHomePathForStaff` punta all’ingresso.
- **Google Maps**: caricamento singleton (niente script API duplicati in Area consegna).
- **DB menu pubblico**: policy `anon` su `core.prodotti` per lettura righe da menù (`anon_select_prodotti_menu_pubblico`) — inclusa nel baseline `sql/schema_completo_pizzamanager.sql`; eventuali fix in `sql/sql_upgrade.sql`.

### Documentazione

- Architettura, backlog, roadmap cassa/offline/fiscale, questionari, guide, QA, comandi deploy (`DEPLOY_COMANDI.md`). In Super Admin → Guide: scheda **punto-situazione-webapp**.

---

## 2.1 Checklist implementazione (sintesi repo)

| Tema | Dove |
|------|------|
| Header vetrina SaaS | `PublicLayout.jsx`, `public-layout.css` (`public-layout-nav-vetrina`) |
| Tenant da query | `PublicStore.jsx`, `publicService.js` |
| Login → scelta Pizzaiolo / Test | `PIZZAIOLO_TEST_INGRESSO_PATH`, `getOperativeHomePathForStaff` in `operativeRoutes.js`; `PizzaioloIngressoPage.jsx`; `Login.jsx`, `SelectPuntoVendita.jsx` |
| Layout operativo test | `OperativeLayout.jsx` (permessi tutte le aree + servizio OK per email test) |
| Pizzaiolo full | Nessun redirect forzato da `/operative/pizzaioli` per l’account test |
| Griglia 4 pannelli | `RepartiQuadTestPage.jsx` (`MemoryRouter`, no iframe) |
| Maps una tantum | `lib/googleMapsLoader.js` |
| Policy anon prodotti | `sql/schema_completo_pizzamanager.sql` (blocco policy anon); patch in `sql/sql_upgrade.sql` |
| Risoluzione tenant SaaS | `resolveSaaSPublicTenant` in `publicService.js` (try/catch sulla query menu) |
| Nav Super Admin compatta | `SuperAdminLayout.jsx`, `superadmin-enterprise.css` (dropdown desktop, drawer mobile) |
| Fiscal outbox / link | `sql/modules/12_fiscal_outbox_payment_links.sql`, `sql/sql_upgrade.sql`, `src/integrations/fiscal/` |
| Chunk / lazy / analyze | `vite.config.js`, `AppRouter.jsx`, `main.jsx`, script `build:analyze` |

---

## 3. Cosa manca o è parziale

### Prodotto / UX

- Admin: nessuna **home KPI** dedicata; **lista ordini admin** dedicata assente; report ≠ ordini live.
- Magazzino / contabilità: molto ancora su **localStorage** → migrazione Supabase dove deciso.
- Super Admin: MRR/billing/fatture PDF, monitor tecnico, **piani persistenti su server** (listino anche in browser oggi).
- Landing: piani **senza prezzi** in UI (scelta prodotto documentata).
- Pubblicazione go-live cliente: flusso da Super Admin, non form completo in admin tenant.

### Sicurezza e piattaforma

- **RLS / produzione**: applicare su Supabase remoto la migration policy anon (dopo il merge: niente **403** su `prodotti_menu_pubblico` per `anon` se la policy è presente).
- **Billing** abbonamenti Stripe completo (subscription, blocco accesso) ancora da chiudere come prodotto.
- Chiave **Google Maps** da restringere per referrer in produzione.

### Roadmap enterprise

| Blocco | Stato tipico |
|--------|----------------|
| **A – Cassa** | Avanzato; osservabilità (Sentry/OTel), hardening RLS, accessibilità, multi-PV/report gruppo |
| **B – Offline** | Non iniziato |
| **C – Fiscale IT** | Scheletro DB + hook client in cassa; emissione reale e SDI → fornitore + consulenza |

### Dipendenze esterne

- Registratore telematico / SDI, POS certificati, penetration test, SLA commerciali.

### Decisione architetturale

- **Tutto nell’app vs siti clienti su GitHub**: vedi `BACKLOG_E_STATO_SVILUPPO.md` sezione 6.

---

## 4. In una frase

Webapp **ampia e coerente** (tenant, operativo, pubblico, superadmin, traccia enterprise nel repo), con UX piattaforma e bundle **in miglioramento attivo**, perimetro fiscale **avviato a livello dati e client**, e ancora da chiudere: **offline**, **emissione fiscale con vendor**, persistenza admin, billing pieno, DB produzione allineato alle migration; gap prodotto su KPI/ordini admin e magazzino-contabilità su DB.

---

## 5. Riferimenti

| File | Contenuto |
|------|-----------|
| `docs/ARCHITETTURA_E_STATO.md` | Route vs implementazione |
| `docs/BACKLOG_E_STATO_SVILUPPO.md` | Backlog e ordine di lavoro |
| `docs/ROADMAP_CASSA_ENTERPRISE.md` | Cassa → offline → fiscale |
| `PUNTO_SITUAZIONE_ENTERPRISE.md` | Deploy, stack, correzioni note |
| `DEPLOY_COMANDI.md` | Comandi per andare online |

---

*Ultima revisione: 2026-04-10 — checklist implementazione §2.1*
