/**
 * Roadmap lavorazione **servizio per servizio**.
 *
 * Regole:
 * - Un solo servizio con `stato: "wip"` = focus corrente (prossimo da portare avanti / collaudare).
 * - `ok` = considerato chiuso per il rilascio attuale (puoi riaprire se serve).
 * - `todo` = da fare / non iniziato.
 *
 * Quando chiudi uno step: metti `ok`, sposta `wip` sul successivo.
 */

/** @typedef {"ok" | "wip" | "todo"} StatoServizioStep */

/**
 * Ordine = sequenza consigliata (dipendenze operative: prima cassa/comanda, poi canali, poi admin avanzato).
 * @type {Array<{ id: string, titolo: string, stato: StatoServizioStep, nota: string }>}
 */
export const SERVIZI_ROADMAP_STEPS = [
  {
    id: "ordini_cassa",
    titolo: "Ordini a cassa e incassi",
    stato: "ok",
    nota: "Route cassa, prodotti esauriti, turni; gate `ordini_cassa`; incluso in piano Base.",
  },
  {
    id: "stampa_comanda",
    titolo: "Stampa comanda (reparti)",
    stato: "wip",
    nota: "Flusso in Cassa; parametri comanda; con `ordini_cassa` vale anche senza id `stampa_comanda` separato (useTenantServizi).",
  },
  {
    id: "gestione_consegne",
    titolo: "Gestione consegne",
    stato: "todo",
    nota: "Delivery dashboard; `/operative/pony` → delivery. Da arricchire: rider, mappe, notifiche.",
  },
  {
    id: "ordini_online",
    titolo: "Ordini online (cliente)",
    stato: "todo",
    nota: "Store pubblico, ordine, pubblicazione sito; pagamenti e notifiche end-to-end da consolidare.",
  },
  {
    id: "tablet_ruoli",
    titolo: "Schermate tablet / ruoli operativi",
    stato: "todo",
    nota: "Cucina, bancone, pizzaioli; permessi aree; affinare stati ordine e resilienza.",
  },
  {
    id: "report_analisi",
    titolo: "Report e analisi",
    stato: "todo",
    nota: "Report admin; export e confronti periodo; eventuale collegamento magazzino/costi.",
  },
  {
    id: "multi_sede",
    titolo: "Punti vendita multipli",
    stato: "todo",
    nota: "Select PV, PvContext; allineare menu/parametri per PV dove manca.",
  },
  {
    id: "ruoli_avanzati",
    titolo: "Ruoli e permessi avanzati",
    stato: "todo",
    nota: "Pagina Ruoli; matrice permessi più fine e audit.",
  },
  {
    id: "menu_listini",
    titolo: "Menu e listini",
    stato: "todo",
    nota: "Admin menu oggi senza gate catalogo (serve al listino cassa); valutare gate `menu_listini` vs listino minimo.",
  },
  {
    id: "magazzino_gestione",
    titolo: "Magazzino (fornitori / DDT)",
    stato: "todo",
    nota: "Dati localStorage; persistenza Supabase + RLS è il salto successivo.",
  },
  {
    id: "contabilita_locale",
    titolo: "Contabilità locale",
    stato: "todo",
    nota: "Dati localStorage; integrazione DB e fatturazione elettronica fuori scope attuale.",
  },
  {
    id: "supporto_prioritario",
    titolo: "Supporto prioritario",
    stato: "todo",
    nota: "Offerta commerciale; nessun gate app.",
  },
  {
    id: "gestione_tavoli",
    titolo: "Gestione tavoli (sala)",
    stato: "todo",
    nota: "Roadmap: mappa sale, tavoli, comande.",
  },
  {
    id: "api_integrazioni",
    titolo: "API e integrazioni",
    stato: "todo",
    nota: "Backend Nest parziale; API stabili, auth, webhook.",
  },
  {
    id: "account_manager",
    titolo: "Account manager dedicato",
    stato: "todo",
    nota: "Solo commerciale.",
  },
  {
    id: "sla_personalizzazioni",
    titolo: "SLA e personalizzazioni",
    stato: "todo",
    nota: "Solo commerciale / progetti.",
  },
];

export function servizioRoadmapInCorso() {
  return SERVIZI_ROADMAP_STEPS.find((s) => s.stato === "wip") ?? null;
}

export function prossimoServizioRoadmapTodo() {
  return SERVIZI_ROADMAP_STEPS.find((s) => s.stato === "todo") ?? null;
}
