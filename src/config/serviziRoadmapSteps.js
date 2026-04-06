/**
 * Roadmap lavorazione **servizio per servizio** (target ultra‑enterprise).
 *
 * `percentuale` è la fonte di verità mostrata anche nel catalogo servizi (registro) e in
 * Super Admin → Statistiche di sviluppo (tabella dettaglio allineata).
 *
 * `resto` = gap verso livello enterprise (SLO, sicurezza, osservabilità, multi‑tenant, compliance).
 */

/** @typedef {"ok" | "wip" | "todo"} StatoServizioStep */

/**
 * @type {Array<{
 *   id: string,
 *   titolo: string,
 *   stato: StatoServizioStep,
 *   percentuale: number,
 *   resto: string,
 *   nota: string
 * }>}
 */
export const SERVIZI_ROADMAP_STEPS = [
  {
    id: "ordini_cassa",
    titolo: "Ordini a cassa e incassi",
    stato: "ok",
    percentuale: 94,
    resto:
      "Turno cassa obbligatorio con apertura/chiusura vincolata e riconciliazione incassi.\nRegistratore telematico / compliance fiscale (XML, chiusure, annulli certificati).\nIntegrazione POS certificati (PAX, Ingenico, protocolli proprietari) + fallback manuale.\nPagamento misto: split illimitato, arrotondamenti, sconti riga e sconto globale con audit.\nOmnicanalità: stesso motore ordine per cassa, kiosk, QR tavolo senza divergenze di totale.\nOsservabilità: metriche latency checkout, errori RPC, tracing distribuito.\nDisaster recovery: coda offline locale con sync idempotente e risoluzione conflitti.\nMulti‑PV: ogni ordine, listino e chiusura legata al PV con report consolidato gruppo.\nPenetration test periodici su RLS e RPC; segregazione dati tra tenant verificata.\nAccessibilità WCAG 2.2 su flussi cassa critici; i18n completa (date, valute, IVA).",
    nota: "Cassa, planning, annulli, ricevuta, strip incassi, JSON giornata, PV su ordine, pagamento misto (DB+UI); core indipendente dai gate servizio.",
  },
  {
    id: "stampa_comanda",
    titolo: "Stampa comanda (reparti)",
    stato: "ok",
    percentuale: 90,
    resto:
      "Driver stampa nativi (ESC/POS via bridge) oltre al dialogo browser.\nCode di stampa per reparto con retry, dead letter e alert se stampante offline.\nTemplate versionati (A/B) e anteprima pixel‑perfect per ogni larghezza rotolo.\nTest automatici snapshot HTML comanda/ricevuta su CI.\nTelemetria: tempo stampa, copie per ordine, errori per IP/reparto.\nIntegrazione con bilance / etichettatrici per peso variabile.\nConformità HACCP: tracciamento lotto su stampa ove richiesto.",
    nota: "Parametri comanda, reparti IP, stampa per reparto; stampa non bloccata se modulo catalogo disattivo. Con stampa comanda automatica in sala, le notifiche email/push su nuovo ordine web non sono prioritarie (flusso alternativo).",
  },
  {
    id: "gestione_consegne",
    titolo: "Gestione consegne",
    stato: "todo",
    percentuale: 63,
    resto:
      "Assegnazione rider con ottimizzazione percorso (VRP leggero) e SLA stimato lato cliente.\nStati consegna granulari (assegnato, in ritiro, in viaggio, consegnato, problema) + `stato_consegna` in DB.\nNotifiche multicanale (SMS, email, push) con template e preferenze opt‑in.\nApp rider dedicata o PWA con geolocalizzazione e proof of delivery (firma/foto).\nMappa live per sala comando; heatmap ritardi.\nIntegrazione aggregator (Glovo, Uber Eats) tramite API normalizzate.\nContratti di servizio: timeout, rimborsi automatici, escalation.\nMetriche NPS post‑consegna e analisi causa ritardo.",
    nota: "Poligono server-side, coordinate su ordine, dashboard delivery; UX rider e notifiche multicanale ancora da completare.",
  },
  {
    id: "ordini_online",
    titolo: "Ordini online (cliente)",
    stato: "wip",
    percentuale: 63,
    resto:
      "Account obbligatorio + conferma email; checkout con poligono PV, promozioni, fidelity+promo, `create_order_with_items`.\nPagamenti online (Stripe/SumUp): sviluppo end-to-end solo quando sarà disponibile un gateway reale collegabile (Edge Function, webhook, 3DS, rimborsi).\nAnti‑frode: velocity limits, CAPTCHA, lista blocchi indirizzi.\nSEO + Core Web Vitals; PWA.\nNotifiche nuovo ordine al locale: non prioritarie se attiva stampa comanda automatica; altrimenti email/Edge.\nVincolo operativo slot: ordine non accettabile per il quarto d’ora immediatamente successivo alla fascia/orario di inserimento (da applicare in checkout).\nWebhook ordine con firma HMAC; rate limit API pubblica.\nLoad test weekend.",
    nota: "Carrello, checkout, PV/poligoni, promozioni, blocco ordini cassa, policy HTML; pagamenti carta in attesa gateway reale; notifiche sostituibili da stampa comanda automatica.",
  },
  {
    id: "tablet_ruoli",
    titolo: "Schermate tablet / ruoli operativi",
    stato: "todo",
    percentuale: 52,
    resto:
      "Matrice permessi per schermata e azione (non solo area).\nStati ordine con macchina a stati validata server‑side e UI sincrona (Realtime).\nModalità kiosk con logout automatico e sessione corta.\nResilienza: Service Worker, coda azioni offline, risoluzione conflitti.\nAccessibilità touch target 48dp, contrasto, lettura distanza.\nLog strutturati per audit operativo (chi ha cambiato stato e quando).\nDark mode e temi per ambiente cucina/bancone.",
    nota: "Cucina, bancone, pizzaiolo, delivery; permessi aree; da rafforzare Realtime e audit.",
  },
  {
    id: "report_analisi",
    titolo: "Report e analisi",
    stato: "todo",
    percentuale: 61,
    resto:
      "Export CSV/PDF/XLSX schedulati con consegna email sicura.\nFiltri periodo, confronto YoY, drill‑down fino a riga ordine.\nEsclusione coerente ordini annullati e notte fiscale.\nDashboard executive: margini, mix prodotti, ore di picco, forecast base ML.\nRow‑level security su dataset export; watermark PDF con tenant e utente.\nAPI read‑only per BI esterno (Snowflake, Looker) con OAuth.\nConsolidamento multi‑PV e multi‑brand in un’unica vista gruppo.",
    nota: "Report 30gg e top prodotti; export CSV; esclusione annullati in pipeline dati.",
  },
  {
    id: "multi_sede",
    titolo: "Punti vendita multipli",
    stato: "todo",
    percentuale: 72,
    resto:
      "Propagazione menu/listino con promozione staging→prod per PV.\nPermessi: utente legato a uno o più PV; admin gruppo con vista aggregata.\nInventario e DDT per sede; trasferimenti inter‑deposito con documento.\nChiusura cassa e fiscale per PV + consolidato.\nBranding (logo, colori) per PV sul canale cliente.\nDisaster: fail‑over DNS per sede isolata.\nTest E2E su switch PV durante sessione ordine.",
    nota: "PvContext, ordini con `punto_vendita_id`, poligoni consegna per PV, checkout cliente legato al PV, home gruppo; listino per PV + versioning solo se requisito commerciale.",
  },
  {
    id: "ruoli_avanzati",
    titolo: "Ruoli e permessi avanzati",
    stato: "todo",
    percentuale: 43,
    resto:
      "RBAC fine: risorsa + azione + condizione (es. solo propri ordini).\nDeleghe temporanee e approvazioni a due mani per azioni sensibili.\nAudit log immutabile (append‑only) con export e retention legale.\nSSO SAML/OIDC per gruppi multi‑locale.\nReview accessi trimestrale e report utenti inattivi.\nSeparazione compiti SoD (chi crea fattura non può approvare pagamento).\nIntegrazione SCIM per provisioning utenti da HR.",
    nota: "Ruoli pizzeria e aree operative; manca matrice fine. Backlog hardening: audit ordini sensibili, allineamento RLS, test E2E critici.",
  },
  {
    id: "menu_listini",
    titolo: "Menu e listini",
    stato: "todo",
    percentuale: 68,
    resto:
      "Versioning listino con data effetto e rollback.\nListino dinamico (happy hour, canale delivery vs sala).\nAllergeni e nutrizione con fonte normativa aggiornabile.\nGate `menu_listini` vs listino minimo cassa documentato e testato.\nImport massivo da CSV/Excel con validazione e dry‑run.\nSincronizzazione verso canali esterni (aggregator) da un’unica sorgente.\nBlocco modifiche in finestra di chiusura inventario.",
    nota: "Admin menu, promozioni calendario, listini backup, export PDF; listino per PV con versioning se richiesto commercialmente.",
  },
  {
    id: "magazzino_gestione",
    titolo: "Magazzino (fornitori / DDT)",
    stato: "todo",
    percentuale: 48,
    resto:
      "Migrazione completa dati localStorage → Supabase con job una tantum.\nGiacenza valorizzata (FIFO/medio); inventari ciclici e rettifiche firmate.\nOrdini fornitore con conferma, ricezione parziale, fattura abbinata.\nDDT elettronici e integrazione SDI dove applicabile.\nAlert scadenze e lotti; traceability verso piatto venduto.\nIntegrazione bilancia e lettura EAN.\nKPI: fill rate, giorni di copertura, ABC analysis.",
    nota: "Tabella `magazzino_movimenti` + UI base; fornitori/DDT ancora prevalentemente locale.",
  },
  {
    id: "contabilita_locale",
    titolo: "Contabilità locale",
    stato: "todo",
    percentuale: 64,
    resto:
      "Piano dei conti minimo; prima nota con causali e IVA.\nRiconciliazione bancaria import estratti CSV/MT940.\nCollegamento incassi POS vs movimenti cassa e vs ordini.\nChiusura esercizio e report per commercialista (FEC / normativa locale).\nWorkflow approvazione spese con allegati e policy limite.\nBackup cifrato e right to erasure documentato.\nIntegrazione fatturazione elettronica attiva/passiva completa.",
    nota: "Incassi manuali su DB + hint ordini; spese/fatture ancora da consolidare su DB.",
  },
  {
    id: "fidelity_card",
    titolo: "Fidelity Card",
    stato: "todo",
    percentuale: 65,
    resto:
      "Regole premio complesse (multi‑livello, partner, scadenze punti).\nCampagne push segmentate; A/B test offerte.\nQR dinamici firmati e anti‑replay.\nFraud detection su accumuli anomali.\nPortale cliente self‑service saldo e storico.\nIntegrazione wallet Apple/Google.\nGDPR: export e cancellazione dati programma.",
    nota: "Accredito automatico post‑ordine cassa (euro/pizza); iscrizioni e movimenti in DB.",
  },
  {
    id: "supporto_prioritario",
    titolo: "Supporto prioritario",
    stato: "todo",
    percentuale: 0,
    resto:
      "SLA misurati (tempo prima risposta, tempo risoluzione) con ticketing integrato.\nRunbook incident e comunicazione stato (status page).\nHealth check tenant e alert proattivi.\nCanale dedicato enterprise (Slack/Teams) con escalation 24/7.\nQuarterly Business Review con roadmap condivisa.",
    nota: "Offerta commerciale; nessun gate in app.",
  },
  {
    id: "gestione_tavoli",
    titolo: "Gestione tavoli (sala)",
    stato: "todo",
    percentuale: 14,
    resto:
      "Modello sale/tavoli/comande con stati (libero, occupato, conto).\nSplit bill, coperto, servizio, note sala.\nIntegrazione stampanti scontrino al tavolo.\nPrenotazioni con capienza e no‑show.\nMappe SVG interattive e drag‑drop tavoli.\nCoordinamento con cucina per priorità tavolo.\nAnalytics tempo medio occupazione e turni.",
    nota: "Roadmap; MVP modello dati e UI sala da progettare.",
  },
  {
    id: "api_integrazioni",
    titolo: "API e integrazioni",
    stato: "todo",
    percentuale: 36,
    resto:
      "OpenAPI 3.1 pubblicata, semver, changelog e deprecation policy.\nOAuth2 client credentials + scope per tenant.\nRate limit, quota, burst e header Retry‑After.\nWebhooks firmati (HMAC) con delivery garantita e dead letter.\nSandbox isolata e dati sintetici.\nSDK ufficiali (Node, .NET).\nCertificazione SOC2 Type II per layer API.",
    nota: "Nest parziale; serve piattaforma integrazioni documentata e osservabile.",
  },
  {
    id: "account_manager",
    titolo: "Account manager dedicato",
    stato: "todo",
    percentuale: 0,
    resto:
      "Processo CRM condiviso, success plan annuale, health score tenant.\nReview trimestrale utilizzo moduli e adozione.\nRoadmap personalizzata e priorità in backlog condiviso.\nTraining on‑site opzionale.",
    nota: "Solo commerciale / organizzazione.",
  },
  {
    id: "sla_personalizzazioni",
    titolo: "SLA e personalizzazioni",
    stato: "todo",
    percentuale: 0,
    resto:
      "Contratti con penali/sconti legati a SLA sviluppo e uptime.\nAmbiente staging dedicato per custom.\nFeature flags per rollout graduale personalizzazioni.\nDocumentazione as‑built per ogni custom (handover interno).",
    nota: "Commerciale / legali / progetti su misura.",
  },
];

/** Allinea la colonna «Dettaglio per servizio» alla tabella roadmap (stesso id). */
export const ROADMAP_PERCENT_BY_ID = Object.fromEntries(SERVIZI_ROADMAP_STEPS.map((s) => [s.id, s.percentuale]));

export function percentualeEffettivaServizio(servizioId, fallbackDaCatalogo) {
  const r = ROADMAP_PERCENT_BY_ID[servizioId]
  if (r != null && Number.isFinite(r)) return Math.min(100, Math.max(0, r))
  return Math.min(100, Math.max(0, Number(fallbackDaCatalogo) || 0))
}

export function servizioRoadmapInCorso() {
  return SERVIZI_ROADMAP_STEPS.find((s) => s.stato === "wip") ?? null;
}

export function prossimoServizioRoadmapTodo() {
  return SERVIZI_ROADMAP_STEPS.find((s) => s.stato === "todo") ?? null;
}
