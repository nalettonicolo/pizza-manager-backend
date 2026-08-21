/**
 * Moduli agenti collegati alle **aree di sviluppo ancora aperte**.
 * Ogni area elenca gli agenti coinvolti e le richieste/deliverable per ciascuno.
 *
 * Fonti: docs/punto-situazione, BACKLOG, SERVIZI_ROADMAP_STEPS, GO_LIVE_FRANCY.
 */

import { SERVIZI_ROADMAP_STEPS } from "@/config/serviziRoadmapSteps"

/** @typedef {'product'|'architecture'|'database'|'dataflows'|'code'|'ui'|'copywriter'|'test'|'security'|'supervisor'} AgenteId */

/** @type {ReadonlyArray<{ id: AgenteId, titolo: string, agenteFile: string, guidaSlug: string, ordine: number }>} */
export const AGENTI_CATALOGO = Object.freeze([
  { id: "product", titolo: "Prodotto", agenteFile: "agents/product.md", guidaSlug: "punto-situazione-prodotto", ordine: 1 },
  { id: "architecture", titolo: "Architettura", agenteFile: "agents/architecture.md", guidaSlug: "punto-situazione-architettura", ordine: 2 },
  { id: "database", titolo: "Database", agenteFile: "agents/database.md", guidaSlug: "punto-situazione-database", ordine: 3 },
  { id: "dataflows", titolo: "Dataflows", agenteFile: "agents/dataflows.md", guidaSlug: "punto-situazione-dataflows", ordine: 4 },
  { id: "code", titolo: "Code", agenteFile: "agents/code.md", guidaSlug: "punto-situazione-code", ordine: 5 },
  { id: "ui", titolo: "UI", agenteFile: "agents/ui.md", guidaSlug: "punto-situazione-ui", ordine: 6 },
  { id: "copywriter", titolo: "Copywriter", agenteFile: "agents/copywriter.md", guidaSlug: "punto-situazione-copywriter", ordine: 7 },
  { id: "test", titolo: "Test", agenteFile: "agents/test.md", guidaSlug: "punto-situazione-test", ordine: 8 },
  { id: "security", titolo: "Security", agenteFile: "agents/security.md", guidaSlug: "punto-situazione-security", ordine: 9 },
  { id: "supervisor", titolo: "Supervisore", agenteFile: "agents/supervisor.md", guidaSlug: "punto-situazione-supervisor", ordine: 10 },
])

/**
 * @typedef {{
 *   agenteId: AgenteId,
 *   ruolo: string,
 *   richieste: string[],
 *   deliverable: string[],
 * }} AgenteSuArea
 *
 * @typedef {{
 *   id: string,
 *   titolo: string,
 *   priorita: 'P2'|'P3'|'P4'|'P5',
 *   stato: 'aperto'|'parziale'|'blocco_esterno'|'in_corso',
 *   servizioId: string|null,
 *   sintesi: string,
 *   fattoOggi: string,
 *   manca: string[],
 *   bloccoEsterno: string|null,
 *   dodSala: string[],
 *   guidaSlug: string|null,
 *   runbook: string|null,
 *   agenti: AgenteSuArea[],
 *   promptCursor: string,
 * }} AreaSviluppoMancante
 */

/** @type {readonly AreaSviluppoMancante[]} */
export const AREE_SVILUPPO_MANCANTI = Object.freeze([
  {
    id: "stripe-live-francy",
    titolo: "Stripe live — Francy (pagamenti web veri)",
    priorita: "P2",
    stato: "blocco_esterno",
    servizioId: "ordini_online",
    sintesi:
      "Il canale online non chiude la serata finché i pagamenti restano in modalità test: il cliente non paga «soldi veri».",
    fattoOggi:
      "Checkout Stripe, ordini IN_ATTESA→preparazione, capacity forno, antifraud, stampa comanda web ON, runbook go-live.",
    manca: [
      "Chiavi pk_live / sk_live / webhook produzione sul tenant",
      "Smoke serata: paga → stampa → cucina vede ordine",
      "Rimborsi e gestione abbandono checkout (regola prodotto)",
    ],
    bloccoEsterno: "Account Stripe live + secrets tenant (non solo codice).",
    dodSala: [
      "Cliente completa pagamento carta live",
      "Ordine passa in preparazione senza intervento SA",
      "Comanda stampata in sala (parametro già ON)",
    ],
    guidaSlug: "go-live-francy-runbook",
    runbook: "docs/GO_LIVE_FRANCY_RUNBOOK.md",
    agenti: [
      {
        agenteId: "product",
        ruolo: "Definire DoD serata e eccezioni (abbandono Stripe, rimborso)",
        richieste: ["Conferma che stampa comanda resta percorso primario", "Messaggi cliente se pagamento fallisce"],
        deliverable: ["Flusso felice + eccezioni", "DoD sala in 3 frasi"],
      },
      {
        agenteId: "architecture",
        ruolo: "Confermare confini Edge webhook vs SPA",
        richieste: ["Nessun secret in client", "Webhook unico multi-tenant"],
        deliverable: ["Nota layer (Edge + parametri tenant)"],
      },
      {
        agenteId: "security",
        ruolo: "Review chiavi e webhook",
        richieste: ["Dove vivono sk_live / whsec", "Isolation tenant su webhook"],
        deliverable: ["Checklist segreti + minacce"],
      },
      {
        agenteId: "test",
        ruolo: "Smoke pagamento live",
        richieste: ["Tenant Francy", "Carta test live mode se prevista"],
        deliverable: ["Checklist smoke + esito"],
      },
      {
        agenteId: "supervisor",
        ruolo: "Gate go-live",
        richieste: ["Esito smoke", "Runbook aggiornato"],
        deliverable: ["APPROVATO o BLOCCATO"],
      },
    ],
    promptCursor:
      "@agents/product.md @agents/security.md @agents/test.md Area: Stripe live Francy. Aggiorna DoD sala, checklist secrets e smoke. Non inventare chiavi.",
  },
  {
    id: "dominio-menu-francy",
    titolo: "Dominio menu Francy (URL marca)",
    priorita: "P2",
    stato: "blocco_esterno",
    servizioId: "ordini_online",
    sintesi: "Senza dominio proprio la vetrina resta su URL piattaforma: fiducia e link social deboli.",
    fattoOggi: "Guide DNS, CTA go-live, runbook cutover, Auth redirects documentati.",
    manca: [
      "DNS / hostname reale",
      "Firebase custom domain",
      "Redirect Auth reset password sul dominio cliente",
      "Smoke: registrazione / reset / ordine sul dominio",
    ],
    bloccoEsterno: "Registrar + DNS + cutover Firebase (azioni fuori repo).",
    dodSala: [
      "Cliente apre il menu sull’URL comunicato dal locale",
      "Reset password funziona su quel dominio",
      "Ordine web arriva in sala",
    ],
    guidaSlug: "go-live-francy-runbook",
    runbook: "docs/GO_LIVE_FRANCY_RUNBOOK.md",
    agenti: [
      {
        agenteId: "product",
        ruolo: "URL e messaggi onboarding titolare",
        richieste: ["Hostname desiderato", "Cosa dire ai clienti"],
        deliverable: ["Copy link social / Google"],
      },
      {
        agenteId: "architecture",
        ruolo: "Host SaaS vs tenant domain",
        richieste: ["Mappa redirect Auth"],
        deliverable: ["Checklist cutover"],
      },
      {
        agenteId: "copywriter",
        ruolo: "Microcopy errore dominio / manutenzione",
        richieste: ["Pagine errore tipiche"],
        deliverable: ["Stringhe italiane senza gergo"],
      },
      {
        agenteId: "test",
        ruolo: "Smoke dominio",
        richieste: ["Hostname staging/prod"],
        deliverable: ["Pass/fail reset + checkout"],
      },
      {
        agenteId: "supervisor",
        ruolo: "Chiusura cutover",
        richieste: ["DNS verde + Auth ok"],
        deliverable: ["APPROVATO / BLOCCATO"],
      },
    ],
    promptCursor:
      "@agents/product.md @agents/architecture.md @agents/copywriter.md Area: dominio menu Francy. Checklist cutover + copy. Nessun codice se blocco DNS.",
  },
  {
    id: "notifiche-adapter-live",
    titolo: "Notifiche cliente (SMTP / SMS / WhatsApp) live",
    priorita: "P3",
    stato: "blocco_esterno",
    servizioId: "ordini_online",
    sintesi:
      "Codice adapter pronto; in sala oggi conta la stampa. Attivare messaggi solo se il titolare li vuole e ci sono credenziali.",
    fattoOggi: "Adapter Edge email/SMS/WA + outbox; stampa comanda web come percorso primario.",
    manca: [
      "Credenziali SMTP / provider SMS / WA Business",
      "Scelta prodotto: messaggi vs solo stampa",
      "Template e opt-in",
      "Smoke invio su tenant reale",
    ],
    bloccoEsterno: "Secrets provider + decisione commerciale del locale.",
    dodSala: [
      "O il titolare accetta esplicitamente «solo stampa + area account»",
      "Oppure il cliente riceve messaggio su stato ordine senza spam",
    ],
    guidaSlug: "punto-situazione-prodotto",
    runbook: "docs/GO_LIVE_ORDINI_WEB.md",
    agenti: [
      {
        agenteId: "product",
        ruolo: "Decisione canale",
        richieste: ["Cosa vuole Francy: stampa only o messaggi"],
        deliverable: ["Regola se/allora + anti-spam"],
      },
      {
        agenteId: "dataflows",
        ruolo: "Outbox → adapter → provider",
        richieste: ["Eventi che generano messaggio"],
        deliverable: ["Sequenza fallimenti/retry"],
      },
      {
        agenteId: "code",
        ruolo: "Wiring secrets / feature flag tenant",
        richieste: ["Parametri già presenti"],
        deliverable: ["Patch minima se serve"],
      },
      {
        agenteId: "copywriter",
        ruolo: "Template SMS/email",
        richieste: ["Lingua e tono"],
        deliverable: ["Testi finali"],
      },
      {
        agenteId: "security",
        ruolo: "Segreti e PII",
        richieste: ["Dove stanno API key"],
        deliverable: ["Review"],
      },
      {
        agenteId: "test",
        ruolo: "Smoke invio",
        richieste: ["Numero/email di test"],
        deliverable: ["Esito"],
      },
    ],
    promptCursor:
      "@agents/product.md @agents/dataflows.md @agents/copywriter.md Area: notifiche live. Decidere stampa-only vs messaggi; template; niente secrets in chat.",
  },
  {
    id: "fiscale-rt-sdi",
    titolo: "Registratore telematico / SDI",
    priorita: "P3",
    stato: "blocco_esterno",
    servizioId: "ordini_cassa",
    sintesi: "L’app è gestionale: senza vendor RT non emette corrispettivi certificati.",
    fattoOggi: "Adapter stub RT-SDI + outbox fiscale; questionario fiscale in guide.",
    manca: [
      "Scelta vendor + commercialista",
      "Completare adapter reale",
      "Chiusure / annulli certificati",
      "Formazione esercente (non confondere cortesia con scontrino fiscale)",
    ],
    bloccoEsterno: "Vendor RT + commercialista + spesso hardware.",
    dodSala: [
      "Corrispettivi emessi secondo obblighi del locale",
      "Cassiere sa cosa è fiscale vs ricevuta di cortesia",
    ],
    guidaSlug: "analisi-fiscale-questionario",
    runbook: null,
    agenti: [
      {
        agenteId: "product",
        ruolo: "Separare fiscale da cortesia/stampa",
        richieste: ["Cosa fa oggi il locale (RT fisico?)"],
        deliverable: ["Regole sala + messaggi blocco"],
      },
      {
        agenteId: "architecture",
        ruolo: "Confini Edge fiscale vs cassa",
        richieste: ["Outbox esistente"],
        deliverable: ["Decisione integrazione"],
      },
      {
        agenteId: "database",
        ruolo: "Persistenza esiti fiscali",
        richieste: ["Tabelle outbox"],
        deliverable: ["Gap schema se serve"],
      },
      {
        agenteId: "security",
        ruolo: "Credenziali RT / audit",
        richieste: ["Chi può emettere"],
        deliverable: ["Threat model breve"],
      },
      {
        agenteId: "supervisor",
        ruolo: "Non dichiarare «fiscale live» senza vendor",
        richieste: ["Stato adapter"],
        deliverable: ["BLOCCATO finché stub"],
      },
    ],
    promptCursor:
      "@agents/product.md @agents/architecture.md @agents/security.md Area: RT/SDI. Solo requisiti e confini; non fingere compliance senza vendor.",
  },
  {
    id: "stampa-enterprise",
    titolo: "Stampa comanda — gap enterprise (bridge ESC/POS, code, telemetria)",
    priorita: "P4",
    stato: "parziale",
    servizioId: "stampa_comanda",
    sintesi:
      "Flusso sala (solo cassa / tablet / cortesia) c’è. Manca il pezzo «fabbrica»: bridge nativo, code retry, telemetria.",
    fattoOggi:
      "Parametri rotolo, stampa browser, stampanti reparto, flusso stampa operativa (modalità + cortesia per reparto).",
    manca: [
      "Bridge ESC/POS oltre dialogo browser",
      "Code stampa per reparto con retry / alert offline",
      "Snapshot test HTML comanda/ricevuta in CI",
      "Telemetria errori stampa",
    ],
    bloccoEsterno: null,
    dodSala: [
      "Stampa affidabile anche con stampante che «si stacca»",
      "Cortesia delivery sempre disponibile dal reparto giusto",
    ],
    guidaSlug: "punto-situazione-prodotto",
    runbook: null,
    agenti: [
      {
        agenteId: "product",
        ruolo: "Priorità: bridge vs basta browser",
        richieste: ["Hardware in sala (POS-58 USB?)"],
        deliverable: ["Scope MVP vs enterprise"],
      },
      {
        agenteId: "architecture",
        ruolo: "Bridge locale vs cloud print",
        richieste: ["Vincoli rete locale"],
        deliverable: ["Scelta tecnica"],
      },
      {
        agenteId: "code",
        ruolo: "Implementazione bridge / code",
        richieste: ["File printComanda / printRicevuta"],
        deliverable: ["Patch + test"],
      },
      {
        agenteId: "ui",
        ruolo: "Stati stampante offline in cassa",
        richieste: ["Messaggi errore"],
        deliverable: ["Wire empty/error"],
      },
      {
        agenteId: "test",
        ruolo: "Snapshot HTML + smoke stampa",
        richieste: ["Fixture comanda"],
        deliverable: ["Test CI"],
      },
    ],
    promptCursor:
      "@agents/product.md @agents/architecture.md @agents/code.md Area: stampa enterprise. Separare MVP sala (già fatto) da bridge/code retry.",
  },
  {
    id: "tablet-audit-kiosk",
    titolo: "Tablet reparti — audit azioni e modalità kiosk",
    priorita: "P4",
    stato: "aperto",
    servizioId: "tablet_ruoli",
    sintesi: "Realtime c’è; manca sapere chi ha cambiato stato e sessioni tablet sicure in cucina.",
    fattoOggi: "Cucina/bancone/pizzaiolo/delivery + Realtime + polling; aree di lavoro.",
    manca: [
      "Log «chi / quando / quale stato»",
      "Kiosk: logout automatico, sessione corta",
      "Matrice permesso per azione (oltre area)",
      "Touch target / tema cucina",
    ],
    bloccoEsterno: null,
    dodSala: [
      "Titolare può ricostruire chi ha segnato pronto",
      "Tablet non resta loggato a fine turno",
    ],
    guidaSlug: "punto-situazione-ui",
    runbook: null,
    agenti: [
      {
        agenteId: "product",
        ruolo: "Quali azioni auditarle",
        richieste: ["Eventi critici sala"],
        deliverable: ["Elenco eventi"],
      },
      {
        agenteId: "database",
        ruolo: "Tabella audit append-only",
        richieste: ["tenant_id, user, ordine, azione"],
        deliverable: ["Modulo SQL bozza"],
      },
      {
        agenteId: "dataflows",
        ruolo: "Quando scrivere audit",
        richieste: ["RPC update stato"],
        deliverable: ["Flusso"],
      },
      {
        agenteId: "code",
        ruolo: "UI kiosk + scrittura audit",
        richieste: ["Layout operativo"],
        deliverable: ["Implementazione"],
      },
      {
        agenteId: "ui",
        ruolo: "Timer sessione / conferma logout",
        richieste: ["Viewport tablet"],
        deliverable: ["Spec UI"],
      },
      {
        agenteId: "security",
        ruolo: "Tamper-evident audit",
        richieste: ["Chi può leggere log"],
        deliverable: ["Policy"],
      },
      {
        agenteId: "test",
        ruolo: "Casi sessione scaduta",
        richieste: ["Timeout"],
        deliverable: ["Checklist"],
      },
    ],
    promptCursor:
      "@agents/product.md @agents/database.md @agents/code.md @agents/security.md Area: audit + kiosk tablet. Una feature alla volta (prima audit o prima kiosk).",
  },
  {
    id: "delivery-vrp-sla",
    titolo: "Delivery avanzato — VRP, SLA, notifiche ritardo",
    priorita: "P4",
    stato: "parziale",
    servizioId: "gestione_consegne",
    sintesi: "Desk + rider + proof + mappa ok; manca ottimizzazione uscite e comunicazione ritardi.",
    fattoOggi: "Poligono, stati, PWA rider, proof Storage, nearest-neighbor, mappa live.",
    manca: [
      "VRP / sequenza uscite più ricca",
      "SLA stimato lato cliente",
      "Heatmap ritardi",
      "Notifiche ritardo (dipende anche da adapter live)",
      "Retention prove Storage",
    ],
    bloccoEsterno: "Notifiche ritardo → dipende da credenziali messaggistica.",
    dodSala: [
      "Desk ordina uscite con meno km/tempo",
      "Cliente informato se ritardo oltre soglia (se canale attivo)",
    ],
    guidaSlug: "punto-situazione-prodotto",
    runbook: null,
    agenti: [
      {
        agenteId: "product",
        ruolo: "Soglie SLA e cosa dire al cliente",
        richieste: ["Tempi tipici Francy"],
        deliverable: ["Regole ritardo"],
      },
      {
        agenteId: "architecture",
        ruolo: "Calcolo VRP: client vs Nest",
        richieste: ["Volumi ordini"],
        deliverable: ["Layer"],
      },
      {
        agenteId: "code",
        ruolo: "Algoritmo / UI desk",
        richieste: ["deliveryRouteUtils"],
        deliverable: ["Patch"],
      },
      {
        agenteId: "ui",
        ruolo: "Mappa + lista priorità",
        richieste: ["Desk delivery"],
        deliverable: ["Spec"],
      },
      {
        agenteId: "test",
        ruolo: "Fixture percorsi",
        richieste: ["Ordini demo GPS"],
        deliverable: ["Unit route"],
      },
    ],
    promptCursor:
      "@agents/product.md @agents/architecture.md @agents/code.md Area: delivery VRP/SLA. Scope MVP (solo sort migliore) vs enterprise.",
  },
  {
    id: "magazzino-valorizzato",
    titolo: "Magazzino — giacenza valorizzata e inventari",
    priorita: "P4",
    stato: "parziale",
    servizioId: "magazzino_gestione",
    sintesi: "Hub fornitori/DDT su DB c’è; manca il magazzino «da gestore» (valore, inventari, scadenze).",
    fattoOggi: "Fornitori, DDT, movimenti hybrid Supabase.",
    manca: [
      "Giacenza valorizzata (FIFO/medio)",
      "Inventari ciclici e rettifiche",
      "Alert scadenze/lotti",
      "KPI copertura / ABC",
    ],
    bloccoEsterno: null,
    dodSala: [
      "Titolare sa quanto ha in magazzino in €",
      "Inventario di fine mese chiudibile in app",
    ],
    guidaSlug: "punto-situazione-database",
    runbook: null,
    agenti: [
      {
        agenteId: "product",
        ruolo: "Processo inventario reale",
        richieste: ["Come contano oggi"],
        deliverable: ["Flusso inventario"],
      },
      {
        agenteId: "database",
        ruolo: "Modello lotti / valorizzazione",
        richieste: ["Tabelle movimenti"],
        deliverable: ["Modulo SQL"],
      },
      {
        agenteId: "architecture",
        ruolo: "Hybrid localStorage → solo DB",
        richieste: ["DEBT_MONOLITH / magazzino"],
        deliverable: ["Piano migrazione dati"],
      },
      {
        agenteId: "code",
        ruolo: "UI hub inventari",
        richieste: ["Pagine magazzino admin"],
        deliverable: ["Implementazione a slice"],
      },
      {
        agenteId: "ui",
        ruolo: "Schermate conteggio",
        richieste: ["Tablet magazzino?"],
        deliverable: ["Wire"],
      },
      {
        agenteId: "test",
        ruolo: "Casi rettifica",
        richieste: ["Fixture movimenti"],
        deliverable: ["Unit"],
      },
    ],
    promptCursor:
      "@agents/product.md @agents/database.md @agents/architecture.md Area: magazzino valorizzato. Una slice (inventario) per volta.",
  },
  {
    id: "rbac-fine",
    titolo: "Ruoli avanzati — RBAC fine e SoD",
    priorita: "P4",
    stato: "aperto",
    servizioId: "ruoli_avanzati",
    sintesi: "Aree operative ok; manca permesso per azione e segregazione compiti.",
    fattoOggi: "Ruoli pizzeria, aree, grant RPC hardening, policy turni.",
    manca: [
      "Matrice risorsa + azione",
      "Approvazioni a due mani su azioni sensibili",
      "Audit accessi",
      "SoD (es. chi crea non approva pagamento)",
    ],
    bloccoEsterno: null,
    dodSala: [
      "Operatore vede solo ciò che deve",
      "Azioni critiche richiedono conferma idonea",
    ],
    guidaSlug: "punto-situazione-security",
    runbook: null,
    agenti: [
      {
        agenteId: "product",
        ruolo: "Elenco azioni sensibili sala/admin",
        richieste: ["Cosa può fare un pony vs cassa"],
        deliverable: ["Matrice funzionale"],
      },
      {
        agenteId: "security",
        ruolo: "Threat + SoD",
        richieste: ["Azioni su soldi/ordini"],
        deliverable: ["Requisiti sicurezza"],
      },
      {
        agenteId: "database",
        ruolo: "Persistenza permessi",
        richieste: ["utenti_ruoli oggi"],
        deliverable: ["Schema gap"],
      },
      {
        agenteId: "code",
        ruolo: "Gate UI + RPC",
        richieste: ["RuoliPage"],
        deliverable: ["Implementazione"],
      },
      {
        agenteId: "test",
        ruolo: "Casi negati",
        richieste: ["Utenti demo"],
        deliverable: ["Checklist"],
      },
      {
        agenteId: "supervisor",
        ruolo: "Review pre-merge",
        richieste: ["Diff permessi"],
        deliverable: ["APPROVATO/BLOCCATO"],
      },
    ],
    promptCursor:
      "@agents/product.md @agents/security.md @agents/database.md Area: RBAC fine. Prima matrice funzionale, poi SQL/UI.",
  },
  {
    id: "report-executive",
    titolo: "Report e analisi — executive / export schedulati",
    priorita: "P5",
    stato: "aperto",
    servizioId: "report_analisi",
    sintesi: "Report 30gg base c’è; manca il cruscotto titolare e export automatici.",
    fattoOggi: "Report periodo, top prodotti, CSV, esclusione annullati.",
    manca: [
      "Dashboard margini / mix / picchi",
      "Export schedulati email",
      "Confronto YoY",
      "Vista multi-PV consolidata",
    ],
    bloccoEsterno: null,
    dodSala: ["Titolare apre un cruscotto e capisce la settimana senza Excel."],
    guidaSlug: "punto-situazione-prodotto",
    runbook: null,
    agenti: [
      {
        agenteId: "product",
        ruolo: "KPI minimi utili in pizzeria",
        richieste: ["Cosa guarda oggi il titolare"],
        deliverable: ["Lista KPI MVP"],
      },
      {
        agenteId: "architecture",
        ruolo: "Query vs materializzazione",
        richieste: ["Volumi ordini"],
        deliverable: ["Approccio"],
      },
      {
        agenteId: "database",
        ruolo: "Viste aggregate tenant-safe",
        richieste: ["Report attuale"],
        deliverable: ["SQL"],
      },
      {
        agenteId: "code",
        ruolo: "UI report",
        richieste: ["Report page"],
        deliverable: ["Patch"],
      },
      {
        agenteId: "ui",
        ruolo: "Layout cruscotto",
        richieste: ["Desktop admin"],
        deliverable: ["Spec"],
      },
      {
        agenteId: "security",
        ruolo: "Export e watermark",
        richieste: ["Chi esporta"],
        deliverable: ["Regole"],
      },
    ],
    promptCursor:
      "@agents/product.md @agents/database.md @agents/ui.md Area: report executive MVP (3 KPI). No BI Snowflake in questo slice.",
  },
  {
    id: "debito-monolite-cassa",
    titolo: "Debito tecnico — split CassaPage / adminService",
    priorita: "P4",
    stato: "in_corso",
    servizioId: "ordini_cassa",
    sintesi: "Velocità di sviluppo: file troppo grandi rallentano ogni feature cassa.",
    fattoOggi: "Facade display/hook, parametriService, onlinePaymentsAdminService, stampa utils.",
    manca: [
      "Ulteriori slice da CassaPage",
      "Altri pezzi da adminService",
      "Test unit accanto alle slice",
    ],
    bloccoEsterno: null,
    dodSala: ["Nessun cambiamento comportamento sala; solo manutenibilità."],
    guidaSlug: "punto-situazione-code",
    runbook: "docs/DEBT_MONOLITH_PLAN.md",
    agenti: [
      {
        agenteId: "architecture",
        ruolo: "Ordine delle slice",
        richieste: ["DEBT_MONOLITH_PLAN"],
        deliverable: ["Prossima slice nominata"],
      },
      {
        agenteId: "code",
        ruolo: "Estrazione senza regressione",
        richieste: ["File target"],
        deliverable: ["PR piccola"],
      },
      {
        agenteId: "test",
        ruolo: "Regressione unit",
        richieste: ["Comportamento invariato"],
        deliverable: ["Test verdi"],
      },
      {
        agenteId: "supervisor",
        ruolo: "Gate «nessuna feature mista»",
        richieste: ["Diff solo refactor"],
        deliverable: ["APPROVATO/BLOCCATO"],
      },
    ],
    promptCursor:
      "@agents/architecture.md @agents/code.md @agents/test.md Area: debito monolite cassa. Solo refactor slice X; no feature nuova.",
  },
  {
    id: "rls-ci-e2e",
    titolo: "Qualità — RLS CI JWT A/B + E2E auth",
    priorita: "P4",
    stato: "parziale",
    servizioId: null,
    sintesi: "Smoke pubblico e script RLS ci sono; manca automazione cross-tenant e login e2e in CI.",
    fattoOggi: "E2E pubblico, verify RLS inventory, script JWT A/B, whitelist PO.",
    manca: [
      "Secret CI per JWT tenant A/B",
      "E2E auth in CI (non solo skip)",
      "Gate pre-merge documentato",
    ],
    bloccoEsterno: "Secrets GitHub / utenti test dedicati.",
    dodSala: ["Nessun impatto sala diretto; riduce regressioni multi-tenant."],
    guidaSlug: "punto-situazione-test",
    runbook: "sql/scripts/README_VERIFY_RLS.md",
    agenti: [
      {
        agenteId: "security",
        ruolo: "Casi cross-tenant obbligatori",
        richieste: ["Tabelle sensibili"],
        deliverable: ["Lista assert"],
      },
      {
        agenteId: "test",
        ruolo: "CI wiring",
        richieste: ["Workflow esistenti"],
        deliverable: ["Job verde con secret"],
      },
      {
        agenteId: "database",
        ruolo: "Query verify allineate",
        richieste: ["README_VERIFY_RLS"],
        deliverable: ["Script aggiornati"],
      },
      {
        agenteId: "supervisor",
        ruolo: "Policy «no merge senza smoke»",
        richieste: ["ROADMAP_VELOCITA"],
        deliverable: ["Regola team"],
      },
    ],
    promptCursor:
      "@agents/security.md @agents/test.md @agents/database.md Area: RLS CI + e2e auth. Solo tooling/CI; no feature prodotto.",
  },
])

/** Compat: vecchio export usato da eventuali import — ora derivato dalle aree. */
export const AGENTI_MODULI_SVILUPPO = AGENTI_CATALOGO

export function getAgenteById(id) {
  return AGENTI_CATALOGO.find((a) => a.id === id) || null
}

export function getAreaById(id) {
  return AREE_SVILUPPO_MANCANTI.find((a) => a.id === id) || null
}

/** Aree in cui compare un agente. */
export function getAreePerAgente(agenteId) {
  return AREE_SVILUPPO_MANCANTI.filter((area) => area.agenti.some((x) => x.agenteId === agenteId))
}

export function enrichAreaConRoadmap(area) {
  if (!area?.servizioId) return { ...area, percentuale: null, roadmapTitolo: null, roadmapNota: null }
  const step = SERVIZI_ROADMAP_STEPS.find((s) => s.id === area.servizioId)
  if (!step) return { ...area, percentuale: null, roadmapTitolo: null, roadmapNota: null }
  return {
    ...area,
    percentuale: step.percentuale,
    roadmapTitolo: step.titolo,
    roadmapNota: step.nota,
    roadmapRestoPreview: String(step.resto || "")
      .split("\n")
      .filter(Boolean)
      .slice(0, 4),
  }
}

export function listAreeEnriched() {
  return AREE_SVILUPPO_MANCANTI.map(enrichAreaConRoadmap)
}
