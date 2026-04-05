/**
 * Registro servizi vendibili — lista allineata ai moduli presenti in app.
 *
 * Manutenzione obbligatoria: quando aggiungi un nuovo modulo / canale / funzione
 * commerciale, aggiungi o aggiorna qui la voce corrispondente (id stabile, testi,
 * prezzo di default). Il Super Admin può poi modificare nome, funzioni e prezzo
 * in UI; "Ripristina catalogo predefinito" riallinea ai valori di questo file.
 *
 * Campi:
 * - prezzoDefaultEuro: canone mensile suggerito (modificabile in Catalogo servizi).
 * - avanzamentoDefaultPercentuale: stima 0–100% per Sviluppo / CSV (ripristino catalogo).
 * - codiceRiferimento: hint opzionale su dove sta l’implementazione (per chi aggiorna il registro).
 */

/**
 * @typedef {{
 *   id: string,
 *   nome: string,
 *   categoria: string,
 *   funzioni: string[],
 *   prezzoDefaultEuro: number,
 *   codiceRiferimento?: string,
 *   avanzamentoDefaultPercentuale: number,
 * }} ServizioAppRegistrato
 */

/** @type {ServizioAppRegistrato[]} */
export const SERVIZI_APP = [
  {
    id: "ordini_cassa",
    nome: "Ordini a cassa e incassi",
    categoria: "Operazioni sala",
    funzioni: [
      "Crea gli ordini in cassa; alla conferma stampa la ricevuta",
      "Incassi e gestione del flusso ordini al banco",
    ],
    prezzoDefaultEuro: 24,
    avanzamentoDefaultPercentuale: 95,
    codiceRiferimento: "operative/cassa, flusso ordini area operativa",
  },
  {
    id: "stampa_comanda",
    nome: "Comanda (stampa riepilogo ordine in più reparti)",
    categoria: "Operazioni sala",
    funzioni: [
      "Stampa della comanda in base ai reparti coinvolti dall’ordine",
      "Integrazione con flusso cassa e reparti (cucina, bancone, ecc.)",
    ],
    prezzoDefaultEuro: 9,
    avanzamentoDefaultPercentuale: 90,
    codiceRiferimento: "flusso cassa / bancone",
  },
  {
    id: "gestione_consegne",
    nome: "Gestione consegne",
    categoria: "Delivery",
    funzioni: [
      "Gestione consegne con geolocalizzazione dei rider",
      "Ottimizzazione tempi di consegna e gestione ritardi",
    ],
    prezzoDefaultEuro: 14,
    avanzamentoDefaultPercentuale: 88,
    codiceRiferimento: "operative/delivery",
  },
  {
    id: "ordini_online",
    nome: "Ordini online (cliente finale)",
    categoria: "Canale vendita",
    funzioni: [
      "Il cliente crea l’ordine da casa: pizze, orario di consegna o ritiro",
      "Pagamento online quando abilitato",
      "Notifiche nuovo ordine in pizzeria",
    ],
    prezzoDefaultEuro: 32,
    avanzamentoDefaultPercentuale: 82,
    codiceRiferimento: "PublicStore, OrdinePage, pubblicazione sito",
  },
  {
    id: "tablet_ruoli",
    nome: "Schermate tablet per ruoli operativi",
    categoria: "Operativo",
    funzioni: [
      "Ambiente senza carta: pizzaioli, bancone, cucina e delivery con aree collegate",
      "Il pizzaiolo prende in carico la comanda e lavora in base all’orario segnato",
      "La cucina vede cosa preparare in anticipo, sincronizzata con il forno",
      "Il bancone ha visione coordinata del flusso; interfacce touch per reparto",
    ],
    prezzoDefaultEuro: 38,
    avanzamentoDefaultPercentuale: 92,
    codiceRiferimento: "AppRouter operative/*, permessiAree",
  },
  {
    id: "report_analisi",
    nome: "Report e analisi",
    categoria: "Business",
    funzioni: [
      "Prodotto più venduto, clienti che ordinano più spesso",
      "Totali incassi; pizze, fritti e bibite vendute nella giornata",
      "Statistiche per prendere decisioni operative",
    ],
    prezzoDefaultEuro: 12,
    avanzamentoDefaultPercentuale: 88,
    codiceRiferimento: "admin/report",
  },
  {
    id: "multi_sede",
    nome: "Punti vendita multipli",
    categoria: "Business",
    funzioni: [
      "Con più punti vendita monitori tutto da una postazione",
      "Parametri e menu per sede dove previsto",
    ],
    prezzoDefaultEuro: 18,
    avanzamentoDefaultPercentuale: 85,
    codiceRiferimento: "SelectPuntoVendita, tenant multi-PV",
  },
  {
    id: "ruoli_avanzati",
    nome: "Ruoli e permessi avanzati",
    categoria: "Business",
    funzioni: [
      "Abilitazione degli utenti di default creati con la pizzeria",
      "Possibilità di richiedere utenti aggiuntivi su misura",
    ],
    prezzoDefaultEuro: 10,
    avanzamentoDefaultPercentuale: 90,
    codiceRiferimento: "admin/ruoli, permessi aree operative",
  },
  {
    id: "menu_listini",
    nome: "Menu e listini avanzati",
    categoria: "Business",
    funzioni: [
      "Crea i tuoi listini e personalizzarli al massimo",
      "Categorie, prezzi e varianti come da esigenza del locale",
    ],
    prezzoDefaultEuro: 8,
    avanzamentoDefaultPercentuale: 92,
    codiceRiferimento: "admin/menu/*",
  },
  {
    id: "magazzino_gestione",
    nome: "Magazzino (fornitori e DDT)",
    categoria: "Amministrazione",
    funzioni: [
      "Anagrafica fornitori, listino e soglie di riordino",
      "Registro documenti di trasporto in entrata (DDT)",
      "Dati per tenant salvati nel browser fino a integrazione database",
    ],
    prezzoDefaultEuro: 11,
    avanzamentoDefaultPercentuale: 78,
    codiceRiferimento: "admin/magazzino/*, useTenantLocalJson",
  },
  {
    id: "contabilita_locale",
    nome: "Contabilità locale",
    categoria: "Amministrazione",
    funzioni: [
      "Fatture passive e pagamenti, food cost, spese locale e personale",
      "Gestione incassi registrati manualmente",
      "Collegamento logico ai DDT di magazzino",
    ],
    prezzoDefaultEuro: 11,
    avanzamentoDefaultPercentuale: 75,
    codiceRiferimento: "admin/contabilita/*, useTenantLocalJson",
  },
  {
    id: "supporto_prioritario",
    nome: "Supporto prioritario",
    categoria: "Assistenza",
    funzioni: ["Assistenza in 24 ore"],
    prezzoDefaultEuro: 15,
    avanzamentoDefaultPercentuale: 0,
    codiceRiferimento: "offerta commerciale (nessun gate in app)",
  },
  {
    id: "gestione_tavoli",
    nome: "Gestione tavoli (sala)",
    categoria: "Roadmap",
    funzioni: [
      "Gestionale per servizio al tavolo in pizzeria: mappa sale, tavoli e coperti",
      "Comande legate al tavolo, stato ordine e conto (in sviluppo)",
    ],
    prezzoDefaultEuro: 22,
    avanzamentoDefaultPercentuale: 12,
    codiceRiferimento: "roadmap: non ancora in produzione",
  },
  {
    id: "api_integrazioni",
    nome: "API e integrazioni",
    categoria: "Enterprise",
    funzioni: ["Endpoint per sistemi esterni", "Integrazione con POS, delivery partner, ecc."],
    prezzoDefaultEuro: 45,
    avanzamentoDefaultPercentuale: 42,
    codiceRiferimento: "server/pizzeria-backend, API turni / integrazioni parziali",
  },
  {
    id: "account_manager",
    nome: "Account manager dedicato",
    categoria: "Enterprise",
    funzioni: ["Referente commerciale dedicato", "Revisione periodica setup e obiettivi"],
    prezzoDefaultEuro: 60,
    avanzamentoDefaultPercentuale: 0,
    codiceRiferimento: "offerta commerciale (nessun gate in app)",
  },
  {
    id: "sla_personalizzazioni",
    nome: "SLA e personalizzazioni",
    categoria: "Enterprise",
    funzioni: ["Accordi su tempi e disponibilità", "Sviluppi o personalizzazioni su misura"],
    prezzoDefaultEuro: 80,
    avanzamentoDefaultPercentuale: 0,
    codiceRiferimento: "offerta commerciale / progetti su misura",
  },
];

/**
 * Formato atteso da `servicesStorage` e pagina Piani (campo `prezzoMensile`).
 * @returns {Array<{ id: string, nome: string, categoria: string, funzioni: string[], prezzoMensile: number }>}
 */
export function catalogoDefaultDaRegistro() {
  return SERVIZI_APP.map((s) => ({
    id: s.id,
    nome: s.nome,
    categoria: s.categoria,
    funzioni: [...s.funzioni],
    prezzoMensile: s.prezzoDefaultEuro,
    avanzamentoPercentuale: s.avanzamentoDefaultPercentuale,
  }));
}

/**
 * Piano minimo operativo: cassa, comanda (la comanda è coperta anche da `ordini_cassa`, vedi useTenantServizi),
 * delivery/pony in app se nei permessi, magazzino e contabilità locale (dati browser).
 * I tre id operativi possono restare da soli su listini personalizzati; magazzino/contabilità si possono togliere con servizi personalizzati.
 */
export const IDS_BASE = [
  "ordini_cassa",
  "stampa_comanda",
  "gestione_consegne",
  "magazzino_gestione",
  "contabilita_locale",
];
/** Pro e Trial: include Base + ordini online cliente. */
export const IDS_PRO = [...IDS_BASE, "ordini_online"];
export const IDS_ENTERPRISE = [...IDS_PRO, "tablet_ruoli"];
/** Tutti gli id presenti in `SERVIZI_APP` (si aggiorna automaticamente con il registro). */
export const IDS_FULL = SERVIZI_APP.map((s) => s.id);
