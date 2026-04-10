# Gestionale completo: analisi di perimetro e questionario per lo sviluppo

**Ruolo del documento:** strumento da **dev manager / product owner / engineering** per definire **cosa significa “gestionale completo”** in Pizza Manager, **priorità**, **dipendenze** e **criteri di completamento** — senza lasciare ambiguità tra “già in codice”, “parziale”, “solo locale” e “da costruire”.

**Come usarlo:** compila il **template in fondo** (sezione 12) man mano che rispondi; il team userà le risposte per **roadmap**, **stima** e **architettura dati** (Supabase vs `localStorage`, RPC, permessi).

**Collegamenti obbligatori nel repo:**

| File | Contenuto |
|------|-----------|
| `docs/ARCHITETTURA_E_STATO.md` | Route reali vs visione; gap noti. |
| `docs/ROADMAP_CASSA_ENTERPRISE.md` | Cassa → offline → fiscale IT. |
| `docs/BACKLOG_E_STATO_SVILUPPO.md` | Cosa è realistico in codice vs dipendenze esterne. |
| `docs/ANALISI_PERIMETRO_FISCALE_E_QUESTIONARIO_SVILUPPO.md` | Perimetro RT/corrispettivi (separato da questo documento). |

---

## 1. Perché serve un perimetro sul “gestionale completo”

Senza definizione condivisa, “completare il gestionale” può significare:

- **A)** Chiudere i **gap** elencati in `ARCHITETTURA_E_STATO.md` (es. KPI dedicati, lista ordini admin).  
- **B)** Portare su **database server** ciò che oggi è in **`localStorage`** (magazzino, contabilità moduli locali).  
- **C)** Aggiungere **moduli nuovi** (MRR, billing, monitor, app rider, ecc.).  
- **D)** Raggiungere **parità** con un competitor o con un capitolato cliente.

Queste opzioni hanno **ordini di magnitudine** diversi. Questo documento forza una **scelta esplicita** e una **sequenza** (MVP gestionale → release N → visione 18–36 mesi).

---

## 2. Glossario prodotto / tecnico (Pizza Manager)

| Termine | Significato nel progetto |
|---------|---------------------------|
| **Tenant** | Pizzeria / account cliente isolato (`tenant_id`, RLS Supabase). |
| **Area Admin** | Back-office: menu, report, magazzino, contabilità, dipendenti, ruoli, impostazioni (`/admin/...`). |
| **Area operativa** | Cassa, cucina, bancone, delivery, turni, prodotti esauriti (`/operative/...`). |
| **Super Admin** | Console piattaforma: tenant, piani, servizi, deploy (`/superadmin/...`). |
| **Gate servizi** | Opzionale: `VITE_ENFORCE_SERVIZI_PLAN` + `parametri_operativi.servizi_abilitati` — moduli visibili per piano. |
| **Dati “locali tenant”** | Persistenza in **browser** (`useTenantLocalJson`, chiavi `pm_admin_*`): **non** sono backup centralizzato né multi-dispositivo. |
| **Dati “di sistema”** | Tabelle Supabase (ordini, prodotti, utenti, turni, audit cassa, ecc.) con RLS. |
| **Ordine** | Entità centrale: nasce da cassa/web; stati, righe, PV, turno cassa dove previsto. |
| **Omnicanalità** | Stesso motore ordine per più canali (cassa, web, kiosk futuro): vincolo architetturale in roadmap cassa. |

---

## 3. Stato attuale (fotografia ingegneristica)

Sintesi allineata a `ARCHITETTURA_E_STATO.md` (aggiornare se cambia il codice):

| Macro-area | Implementazione tipica oggi | Nota |
|------------|----------------------------|------|
| **Menu / listino** | Supabase: categorie, prodotti, ingredienti, formati, allergeni, ecc. | Cuore maturo. |
| **Cassa & turni** | Supabase: ordini, RPC, `turno_operatori_id`, audit cassa (migration dedicate). | Enterprise in evoluzione; vedi roadmap cassa. |
| **Report admin** | Vendite aggregate | **Non** lista ordini live tipo operativo. |
| **Magazzino / Contabilità (hub)** | UI presente; **molti flussi su `localStorage`** per tenant | Gap: sync, multi-device, audit centralizzato. |
| **Super Admin** | Tenant, catalogo servizi, deploy, UI enterprise | Piani ancora in **localStorage** lato listino; MRR/billing non come schermate dedicate. |
| **Sito pubblico / clienti** | Landing, contatti, piani da listino senza prezzi in UI | Perimetro commerciale da definire. |
| **Sicurezza** | Auth Supabase, RLS, ruoli SPA | API Node opzionale. |

**Implicazione:** “Completare il gestionale” può voler dire **(1)** consolidare ciò che è già server-side, **(2)** migrare i moduli locali, **(3)** aggiungere piattaforma e commerciale — non necessariamente nello stesso rilascio.

---

## 4. Ambiti di analisi (indice dei temi)

Per ogni ambito sotto: **obiettivo business**, **stato codice**, **domande da decidere**, **rischi se rimandato**.

---

### 4.1 Visione prodotto e release

| # | Domanda | Perché serve |
|---|---------|--------------|
| 4.1.1 | Qual è la **definizione di “gestionale completo”** per il prossimo anno (3–5 bullet)? | Scope contract / roadmap. |
| 4.1.2 | **Chi sono gli utenti primari** (titolare, cassiere, magazziniere, contabile esterno)? | UX e permessi. |
| 4.1.3 | Esiste un **capitolato**, **investitore** o **cliente pilota** con requisiti scritti? | Priorità vincolanti. |
| 4.1.4 | **Cosa è esplicitamente fuori scope** (es. app nativa rider, POS hardware)? | Evita scope creep. |

---

### 4.2 Multi-tenant, piani SaaS e monetizzazione

| # | Domanda | Perché serve |
|---|---------|--------------|
| 4.2.1 | Modello ricavi atteso: **abbonamento fisso**, **per sede**, **per ordine**, **moduli optional**? | Schema `subscriptions`, feature flags. |
| 4.2.2 | I **piani** devono essere **persistiti su server** (oggi listino anche in localStorage)? | Migrazione dati + Super Admin. |
| 4.2.3 | Serve **fatturazione SaaS** al tenant (PDF, SDI verso cliente pizzeria)? | Modulo billing + legale. |
| 4.2.4 | **Trial**, **grace period**, **sospensione** tenant per mancato pagamento? | Job automatici + UX login. |

---

### 4.3 Amministrazione tenant (Admin): menu, listino, contenuti

| # | Domanda | Perché serve |
|---|---------|--------------|
| 4.3.1 | **Listini multipli** (stagionali, eventi): oltre al flag attuale, serve **attivazione data-driven**? | Tabelle e CRON. |
| 4.3.2 | **Import/export** massivo (CSV ingredienti già documentato): estendere a **prodotti**, **prezzi**? | Pipeline e validazione. |
| 4.3.3 | **Allergeni e tracciabilità** per lotto / HACCP: livello richiesto? | Campi e report. |
| 4.3.4 | **Ricette / food cost** collegato a magazzino reale vs solo calcolo teorico? | Integrazione moduli. |

---

### 4.4 Report, BI e lista ordini “da ufficio”

| # | Domanda | Perché serve |
|---|---------|--------------|
| 4.4.1 | Serve una **lista ordini in Admin** (filtri, stati, export) **separata** dall’area operativa? | Nuova route + permessi. |
| 4.4.2 | **KPI dashboard** dedicata: quali metriche (incasso, scontrino medio, tempi, sprechi)? | Aggregazioni SQL/materialized views. |
| 4.4.3 | **Export** (Excel, CSV, PDF) e **frequenza** (giornaliero, chiusura)? | Job e limiti performance. |
| 4.4.4 | Integrazione **BI esterna** (Metabase, Looker, BigQuery)? | ETL o API read-only. |

---

### 4.5 Magazzino: da locale a sistema

| # | Domanda | Perché serve |
|---|---------|--------------|
| 4.5.1 | Il magazzino deve essere **ufficiale** (inventario, valorizzazione) o **operativo leggero**? | Complessità DB. |
| 4.5.2 | **Giacenza** per punto vendita o unica sede? | Modello `tenant_id` + `punto_vendita_id`. |
| 4.5.3 | **Movimenti** collegati a ordini fornitori e DDT: **obbligo** di numerazione e stampa? | Workflow e audit. |
| 4.5.4 | Migrazione dati da **localStorage** → Supabase: **cutover** e formazione utenti? | Piano release. |

---

### 4.6 Contabilità hub (fatture, pagamenti, spese, incassi)

| # | Domanda | Perché serve |
|---|---------|--------------|
| 4.6.1 | Obiettivo: **sostituire** il software contabile del commercialista o **affiancarlo**? | Profondità integrazione. |
| 4.6.2 | **Collegamento** a incassi cassa reali (già in DB) vs inserimento manuale? | Riconciliazione automatica. |
| 4.6.3 | **Esportazione** verso Zucchetti, TeamSystem, CSV standard? | Formati e mapping IVA. |
| 4.6.4 | Dati sensibili: **chi** può vedere **P&L** e **stipendi**? | Ruoli granulari. |

---

### 4.7 Risorse umane e organizzazione

| # | Domanda | Perché serve |
|---|---------|--------------|
| 4.7.1 | Oltre a **utenti e ruoli**, servono **turni lavoro dipendenti**, **presenze**, **costo orario** in report? | Moduli HR. |
| 4.7.2 | Integrazione con **buste paga** esterne? | Export ore. |

---

### 4.8 Area operativa (oltre la cassa)

| # | Domanda | Perché serve |
|---|---------|--------------|
| 4.8.1 | **Cucina / bancone / pizzaioli**: workflow mancanti (priorità code, tempi SLA)? | Stati ordine e notifiche. |
| 4.8.2 | **Delivery**: proprio vs aggregatori; **tracking** rider in app? | Integrazioni API terze. |
| 4.8.3 | **Notifiche** push/email/SMS per ordini web: chi le paga e configura? | Edge functions, costi. |

---

### 4.9 Sito pubblico e canale clienti

| # | Domanda | Perché serve |
|---|---------|--------------|
| 4.9.1 | **Ordine online** end-to-end: pagamento in app (Stripe/SumUp) è **must** o fase 2? | Dipendenze gateway (vedi backlog). |
| 4.9.2 | **Dominio** e pubblicazione: un solo flusso Super Admin o self-service cliente? | Già parzialmente in `ARCHITETTURA_E_STATO`. |
| 4.9.3 | **SEO**, **multilingua** sito vetrina? | i18n pubblico. |

---

### 4.10 Super Admin (piattaforma)

| # | Domanda | Perché serve |
|---|---------|--------------|
| 4.10.1 | **Monitor** (log errori, performance, uso feature): requisito per go-live multi-tenant? | Observability. |
| 4.10.2 | **Supporto L1**: strumenti interni (impersonate tenant, reset dati sandbox)? | Sicurezza e audit. |
| 4.10.3 | **Catalogo servizi** vs roadmap commerciale: chi aggiorna le `nota`/`resto` in UI? | Processo prodotto. |

---

### 4.11 Non funzionali: performance, affidabilità, accessibilità

| # | Domanda | Perché serve |
|---|---------|--------------|
| 4.11.1 | **SLO** accettabili (uptime, latenza cassa, timeout RPC)? | Infra Supabase e caching. |
| 4.11.2 | **Offline cassa** (coda locale): priorità vs modulo fiscale — vedi `ROADMAP_CASSA_ENTERPRISE`. | Sequenza Blocco B. |
| 4.11.3 | **WCAG** su flussi critici (già citato in roadmap enterprise)? | QA accessibilità. |
| 4.11.4 | **i18n** completo (IT + EN minimo) per Admin e operativo? | Costo traduzione. |

---

### 4.12 Sicurezza, privacy, conformità

| # | Domanda | Perché serve |
|---|---------|--------------|
| 4.12.1 | **GDPR**: DPIA, retention log, export/cancellazione cliente? | Policy e implementazione. |
| 4.12.2 | **Ruoli**: granularità (solo lettura report, solo cassa, ecc.) sufficiente o serve **ABAC**? | Modello permessi. |
| 4.12.3 | **Audit log** amministrativi (chi ha modificato listino/prezzi): obbligo interno? | Tabelle append-only. |

---

### 4.13 DevOps, ambienti, qualità

| # | Domanda | Perché serve |
|---|---------|--------------|
| 4.13.1 | Ambienti: **dev / staging / prod** Supabase allineati? | `DEPLOY_COMANDI.md` e migrations. |
| 4.13.2 | **CI**: test automatici (E2E cassa, RLS), lint, build su ogni PR? | Definition of Done. |
| 4.13.3 | **Feature flags** per rilasci graduali (Kill Switch modulo)? | Config remota o env. |

---

### 4.14 Integrazioni esterne (oltre il fiscale)

| # | Domanda | Perché serve |
|---|---------|--------------|
| 4.14.1 | **Pagamenti online** (Stripe, SumUp): priorità e paesi. | Backlog dipendenze. |
| 4.14.2 | **Delivery** (Just Eat, Glovo, Uber Eats): API ufficiali vs scraping vietato. | Partner legali. |
| 4.14.3 | **Email** (SendGrid, SES), **SMS**, **WhatsApp** business. | Costi e template. |
| 4.14.4 | **Contabilità / SDI** come modulo gestionale: vedi anche documento fiscale separato. | Non duplicare qui il dettaglio RT. |

---

### 4.15 Migrazione dati e continuità operativa

| # | Domanda | Perché serve |
|---|---------|--------------|
| 4.15.1 | Tenant esistenti con **dati solo in localStorage**: piano di **import** al passaggio server? | Script one-off. |
| 4.15.2 | **Backup e disaster recovery** percepiti dal cliente: cosa promettere in SLA? | RPO/RTO. |

---

## 5. Matrice “ambito → impatto sviluppo”

| Risposta tipica | Effetto |
|-----------------|--------|
| “Magazzino deve essere ufficiale multi-PV” | Schema DB nuovo, RPC, UI, migrazione da locale. |
| “Contabilità resta leggera, export verso commercialista” | Meno logica in-app; più **export standard** e mapping IVA. |
| “Serve billing SaaS completo” | Modulo fatturazione piattaforma, legale, impaginazione SDI. |
| “Lista ordini in Admin + KPI” | Nuove viste, query aggregate, permessi. |
| “Offline subito” | Blocco B roadmap; vincoli con fiscale e conflitti sync. |

---

## 6. Ordine di lavoro consigliato (dev manager)

1. **Congelare** la definizione di “completo” (sezione 4.1) e **escludere** esplicitamente ciò che non entra.  
2. **Allineare DB** (migrations) per ogni modulo che esce da `localStorage`.  
3. **Completare cassa enterprise** stabile (vedi `ROADMAP_CASSA_ENTERPRISE` Blocco A) prima di carichi massivi su altri moduli se gli ordini sono la spina dorsale.  
4. **Magazzino / contabilità**: decidere **persistenza server** e solo dopo **UI avanzata**.  
5. **Super Admin monetizzazione**: persistenza piani e metriche quando il go-to-market lo richiede.  
6. **Integrazioni pesanti** (pagamenti, delivery, fiscale) dopo perimetro e vendor.

---

## 7. Criteri di “Definition of Done” per modulo gestionale

Per dichiarare un modulo **completato** in senso enterprise (adattare al modulo):

- [ ] Dati **persistiti lato server** (o motivazione documentata se locale).  
- [ ] **RLS** e permessi ruolo verificati su casi d’uso.  
- [ ] **SQL** su Supabase: baseline `sql/schema_completo_pizzamanager.sql` e/o patch `sql/sql_upgrade.sql` se applicabile.  
- [ ] **Manuale utente** o help in-app aggiornato (`manualeUtente` / sezioni admin).  
- [ ] **Test** manuali o automatici su flusso critico; build verde.  
- [ ] **Rollback** o feature flag documentato per la release.

---

## 8. Rischi trasversali (da monitorare)

| Rischio | Mitigazione |
|---------|-------------|
| Doppia fonte di verità (locale + DB) per lo stesso concetto | Piano di migrazione e cutover. |
| Scope “completo” senza priorità | Questo questionario + roadmap trimestrale. |
| Integrazioni senza sandbox vendor | Ambiente di test obbligatorio prima della prod. |
| Debito su permessi | Revisione `RoleLayout` / servizi per nuove schermate. |

---

## 9. Collegamento con il perimetro fiscale

Il **gestionale completo** non coincide con **conformità corrispettivi**. Le decisioni fiscali (RT, SDI ordini vs fatture) influenzano **come** costruire ordini, totali e documenti — ma hanno **documento dedicato**:  
`docs/ANALISI_PERIMETRO_FISCALE_E_QUESTIONARIO_SVILUPPO.md`.

---

## 10. Domande da portare in workshop interno / stakeholder

1. Quali **3 risultati misurabili** nel prossimo anno (es. “100% ordini su DB”, “magazzino su server”, “KPI live”)?  
2. Quali moduli possono restare **MVP** ancora per 12 mesi?  
3. Chi **approva** le priorità quando commerce vs operativo entrano in conflitto?  
4. Budget **infra** (Supabase tier, email, SMS, monitoring)?  
5. **Cliente pilota** disponibile per UAT su magazzino/contabilità server-side?

---

## 11. Riferimenti nel repository (dettaglio)

- Router e layout: `src/app/` (router, `AdminLayout`, `SuperAdminLayout`, operative).  
- Servizi tenant e piani: `useTenantServizi.js`, `serviziRoadmapSteps.js`.  
- SQL: `sql/schema_completo_pizzamanager.sql`, `sql/sql_upgrade.sql`.  
- Deploy: `DEPLOY_COMANDI.md`.

---

## 12. Template risposte (compila progressivamente)

### 12.1 Visione e scope

- Definizione di “gestionale completo” (bullet):  
- Fuori scope esplicito:  
- Cliente pilota / capitolato (sì/no, note):  

### 12.2 SaaS e monetizzazione

- Modello ricavi target:  
- Piani su server (priorità): sì / no / quando:  
- Fatturazione SaaS al tenant: sì / no:  

### 12.3 Admin: report e ordini

- Lista ordini in Admin: necessità (1–5):  
- KPI desiderati (elenco):  

### 12.4 Magazzino

- Ufficiale vs operativo:  
- Multi-PV: sì / no:  
- Migrazione da localStorage: priorità:  

### 12.5 Contabilità

- Affiancare commercialista vs sostituire:  
- Export verso (software):  

### 12.6 Operativo e canali

- Delivery / aggregatori: priorità:  
- Notifiche ordini web: canali richiesti:  

### 12.7 Super Admin e piattaforma

- Monitor e support L1: sì / no:  
- Osservabilità (Sentry, log):  

### 12.8 Non funzionali

- Offline cassa priorità:  
- i18n: lingue:  
- SLO desiderati (uptime / latenza):  

### 12.9 Note libere

-  

---

## 13. Prossimi passi

1. Compilare **12.1–12.3** come minimo.  
2. Incrociare con **`ARCHITETTURA_E_STATO.md`** (aggiornare i gap dopo decisioni).  
3. Trasformare le risposte in **epic** con owner e dipendenze DB.  
4. Rivedere **trimestralmente** questo documento.

---

*Ultima revisione documento: 2026-04-06.*
