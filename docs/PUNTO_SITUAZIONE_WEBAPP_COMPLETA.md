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

### Ordini online / pagamenti

- Percorso **Stripe** (migration, Edge create-intent, webhook, integrazione frontend) per pagamenti online; **SumUp** come percorso/stub dove previsto. In produzione servono account, chiavi e ambiente allineati.

### Consegne / rider

- Schema e migration **rider / consegna enterprise** nel repo; completamento UI/app rider e SLA restano backlog di ampiezza maggiore.

### UX e stabilità (recenti)

- Vetrina: nav su `/negozio` e `/preview`, tenant da query string.
- Account test **4 reparti** (`pizzaioli@pizzamanager.it`): griglia iframe, permessi/servizi, login/PV coerenti.
- **Google Maps**: caricamento singleton (niente script API duplicati in Area consegna).

### Documentazione

- Architettura, backlog, roadmap cassa/offline/fiscale, questionari, guide, QA, comandi deploy (`DEPLOY_COMANDI.md`).

---

## 3. Cosa manca o è parziale

### Prodotto / UX

- Admin: nessuna **home KPI** dedicata; **lista ordini admin** dedicata assente; report ≠ ordini live.
- Magazzino / contabilità: molto ancora su **localStorage** → migrazione Supabase dove deciso.
- Super Admin: MRR/billing/fatture PDF, monitor tecnico, **piani persistenti su server** (listino anche in browser oggi).
- Landing: piani **senza prezzi** in UI (scelta prodotto documentata).
- Pubblicazione go-live cliente: flusso da Super Admin, non form completo in admin tenant.

### Sicurezza e piattaforma

- **RLS / produzione**: allineare migration su Supabase remoto (es. **403** su `prodotti_menu_pubblico` se schema/GRANT non allineati).
- **Billing** abbonamenti Stripe completo (subscription, blocco accesso) ancora da chiudere come prodotto.
- Chiave **Google Maps** da restringere per referrer in produzione.

### Roadmap enterprise

| Blocco | Stato tipico |
|--------|----------------|
| **A – Cassa** | Avanzato; osservabilità (Sentry/OTel), hardening RLS, accessibilità, multi-PV/report gruppo |
| **B – Offline** | Non iniziato |
| **C – Fiscale IT** | Quadro in doc; serve fornitore e consulenza |

### Dipendenze esterne

- Registratore telematico / SDI, POS certificati, penetration test, SLA commerciali.

### Decisione architetturale

- **Tutto nell’app vs siti clienti su GitHub**: vedi `BACKLOG_E_STATO_SVILUPPO.md` sezione 6.

---

## 4. In una frase

Webapp **ampia e coerente** (tenant, operativo, pubblico, superadmin, traccia enterprise nel repo), con perimetro enterprise **ancora in evoluzione** (offline, fiscale, persistenza admin, billing pieno, DB produzione allineato) e gap di prodotto su KPI/ordini admin e magazzino-contabilità su DB.

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

*Ultima revisione: 2026-04-05*
