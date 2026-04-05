/**
 * Roadmap lavorazione **servizio per servizio**.
 *
 * Regole:
 * - Un solo servizio con `stato: "wip"` = focus corrente (prossimo da portare avanti / collaudare).
 * - `ok` = considerato chiuso per il rilascio attuale (puoi riaprire se serve).
 * - `todo` = da fare / non iniziato.
 * - `percentuale` = stima completamento funzionale 0–100 (indipendente dal CSV catalogo servizi).
 * - `resto` = cosa manca ancora (una riga per voce; `\n` per elenco).
 *
 * Quando chiudi uno step: metti `ok`, sposta `wip` sul successivo.
 */

/** @typedef {"ok" | "wip" | "todo"} StatoServizioStep */

/**
 * Ordine = sequenza consigliata (dipendenze operative: prima cassa/comanda, poi canali, poi admin avanzato).
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
    percentuale: 88,
    resto:
      "Pagamento misto (schema + UI).\nRegistratore telematico / adempimenti fiscali.\nIntegrazione POS hardware.\nTurno cassa obbligatorio e chiusura legata al turno.\nAllineamento completo multi-PV (PvContext ovunque).\nOgni pezzo resta opzionale: il core cassa non deve dipendere da servizi disabilitati.",
    nota: "Cassa, planning, annulli, ricevuta cliente, strip incassi, JSON giornata; gate `ordini_cassa`; piano Base.",
  },
  {
    id: "stampa_comanda",
    titolo: "Stampa comanda (reparti)",
    stato: "wip",
    percentuale: 72,
    resto:
      "QA end-to-end su dispositivo reale (stampa + PDF).\nVerifica permessi e parametri su più tenant.\nEventuale affinamento template comanda/ricevuta in impostazioni.\nCon `ordini_cassa` attivo la stampa resta utilizzabile anche senza id catalogo `stampa_comanda` separato.",
    nota: "Parametri comanda, reparti con IP, stampa per reparto; `useTenantServizi` non deve bloccare il flusso se il modulo catalogo è off.",
  },
  {
    id: "gestione_consegne",
    titolo: "Gestione consegne",
    stato: "todo",
    percentuale: 52,
    resto:
      "Rider / assegnazione e stato consegna.\nNotifiche (SMS/push/email) dove previsto.\nMappa operativa consegna in dashboard.\nAffinare dashboard `/operative/delivery` e pony.\nArea poligono già lato server + cassa; resta UX cliente e rider.",
    nota: "Delivery dashboard; percorso operativo consegne.",
  },
  {
    id: "ordini_online",
    titolo: "Ordini online (cliente)",
    stato: "todo",
    percentuale: 38,
    resto:
      "Carrello e checkout pubblico stabili.\nPagamenti online e conferme.\nNotifiche ordine al locale e al cliente.\nCoerenza con area consegna e geocoding.\nTest smoke su dominio/preview.",
    nota: "Store pubblico, pubblicazione sito; canale cliente.",
  },
  {
    id: "tablet_ruoli",
    titolo: "Schermate tablet / ruoli operativi",
    stato: "todo",
    percentuale: 42,
    resto:
      "Cucina, bancone, pizzaiolo, delivery: permessi per area.\nAffinare stati ordine e transizioni.\nResilienza (reconnect, errori rete).\nCoerenza con annulli e planning.",
    nota: "Tablet operativi; ruoli pizzeria.",
  },
  {
    id: "report_analisi",
    titolo: "Report e analisi",
    stato: "todo",
    percentuale: 48,
    resto:
      "Export CSV/PDF.\nFiltri periodo e confronti.\nKPI allineati agli ordini reali (escludere annullati dove serve).\nEventuale collegamento a magazzino / food cost.",
    nota: "Report admin vendite e analisi.",
  },
  {
    id: "multi_sede",
    titolo: "Punti vendita multipli",
    stato: "todo",
    percentuale: 40,
    resto:
      "Select PV e PvContext su tutte le viste sensibili.\nMenu, parametri, ordini legati al PV corretto.\nReport e cassa per sede.",
    nota: "Multi-PV; allineamento dati per punto vendita.",
  },
  {
    id: "ruoli_avanzati",
    titolo: "Ruoli e permessi avanzati",
    stato: "todo",
    percentuale: 32,
    resto:
      "Matrice permessi più fine (per pagina/azione).\nEventuale audit log modifiche.\nAllineo con `RuoliPage` e ruoli pizzeria.",
    nota: "Permessi granulari; audit.",
  },
  {
    id: "menu_listini",
    titolo: "Menu e listini",
    stato: "todo",
    percentuale: 58,
    resto:
      "Definire gate `menu_listini` vs listino minimo cassa.\nDocumentazione `useTenantServizi` e piani.\nEvitare che disattivare il modulo rompa la cassa (listino minimo).",
    nota: "Admin menu; listini e prezzi.",
  },
  {
    id: "magazzino_gestione",
    titolo: "Magazzino (fornitori / DDT)",
    stato: "todo",
    percentuale: 28,
    resto:
      "Migrazione dati da localStorage a Supabase.\nRLS e permessi.\nFlussi fornitori, ordini, DDT collegati dove serve alla contabilità.",
    nota: "Oggi molto in locale; persistenza cloud è il salto principale.",
  },
  {
    id: "contabilita_locale",
    titolo: "Contabilità locale",
    stato: "todo",
    percentuale: 34,
    resto:
      "Persistenza incassi/spese/fatture su DB (non solo local JSON).\nRiconciliazione con ordini cassa opzionale ma utile.\nFatturazione elettronica fuori scope immediato.\nLa cassa e i totali ordine restano utilizzabili senza questo modulo.",
    nota: "Registro manuale incassi in app; hint da ordini già letti da Supabase.",
  },
  {
    id: "fidelity_card",
    titolo: "Fidelity Card",
    stato: "todo",
    percentuale: 44,
    resto:
      "Accredito punti da ordine cassa end-to-end.\nQR tessera e lettura rapida.\nTest movimenti e storico.\nGate servizio: se disattivo, cassa senza blocco (già orientato così).",
    nota: "Iscrizioni; migration Supabase; integrazione ordine.",
  },
  {
    id: "supporto_prioritario",
    titolo: "Supporto prioritario",
    stato: "todo",
    percentuale: 0,
    resto:
      "Definizione offerta commerciale e SLA.\nNessun gate applicativo richiesto.",
    nota: "Offerta commerciale; nessun gate app.",
  },
  {
    id: "gestione_tavoli",
    titolo: "Gestione tavoli (sala)",
    stato: "todo",
    percentuale: 10,
    resto:
      "Modello sale / tavoli / comande.\nUI sala e collegamento a cassa.\nMVP da progettare.",
    nota: "Roadmap: mappa sale, tavoli, comande.",
  },
  {
    id: "api_integrazioni",
    titolo: "API e integrazioni",
    stato: "todo",
    percentuale: 26,
    resto:
      "Backend Nest: endpoint stabili, versionamento.\nAuth e rate limit.\nWebhook documentati e test.\nIntegrazioni terze (delivery aggregator, ecc.) valutate per fasi.",
    nota: "Nest parziale; API pubbliche stabili.",
  },
  {
    id: "account_manager",
    titolo: "Account manager dedicato",
    stato: "todo",
    percentuale: 0,
    resto:
      "Processo commerciale e assegnazione clienti.\nNessun sviluppo prodotto obbligatorio.",
    nota: "Solo commerciale.",
  },
  {
    id: "sla_personalizzazioni",
    titolo: "SLA e personalizzazioni",
    stato: "todo",
    percentuale: 0,
    resto:
      "Accordi su tempi e custom per tenant.\nProgetti su misura fuori roadmap standard.",
    nota: "Commerciale / progetti.",
  },
];

export function servizioRoadmapInCorso() {
  return SERVIZI_ROADMAP_STEPS.find((s) => s.stato === "wip") ?? null;
}

export function prossimoServizioRoadmapTodo() {
  return SERVIZI_ROADMAP_STEPS.find((s) => s.stato === "todo") ?? null;
}
