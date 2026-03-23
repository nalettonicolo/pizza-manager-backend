/**
 * Catalogo predefinito servizi PizzaManager (Super Admin).
 * Ogni servizio ha un costo base mensile modificabile in UI (localStorage).
 */

export const STORAGE_KEY_SERVICES_V2 = "pizzamanager_superadmin_services_v2";
export const STORAGE_KEY_SERVICES_V1 = "pizzamanager_superadmin_services_v1";

export const DEFAULT_SERVICES_CATALOG = [
  {
    id: "ordini_cassa",
    nome: "Ordini a cassa e incassi",
    categoria: "Operazioni sala",
    funzioni: [
      "Registrazione ordini al bancone / sala",
      "Incassi e chiusure cassa",
      "Gestione tavoli e comande base",
    ],
    prezzoMensile: 24,
  },
  {
    id: "stampa_comanda",
    nome: "Comanda (stampa riepilogo ordine)",
    categoria: "Operazioni sala",
    funzioni: [
      "Stampa comanda generica al momento della creazione ordine",
      "Riepilogo ordine stampabile anche senza tablet cucina",
      "Integrazione con flusso cassa / bancone",
    ],
    prezzoMensile: 9,
  },
  {
    id: "gestione_consegne",
    nome: "Gestione consegne",
    categoria: "Delivery",
    funzioni: [
      "Ordini in consegna e tracking base",
      "Assegnazione e stato consegna",
      "Integrazione con flusso ordini cassa",
    ],
    prezzoMensile: 14,
  },
  {
    id: "ordini_online",
    nome: "Ordini online (cliente finale)",
    categoria: "Canale vendita",
    funzioni: [
      "Menu pubblico e ordini dal sito / link",
      "Pagamento online (se abilitato)",
      "Notifiche nuovo ordine",
    ],
    prezzoMensile: 32,
  },
  {
    id: "tablet_ruoli",
    nome: "Schermate tablet per ruoli operativi",
    categoria: "Operativo",
    funzioni: [
      "Interfacce dedicate per cassa, bancone, cucina, delivery, pizzaiolo",
      "Flussi ottimizzati per dispositivo touch",
      "Ruoli interni (inclusi cucina e consegna) separati dall'amministrazione web",
    ],
    prezzoMensile: 38,
  },
  {
    id: "report_analisi",
    nome: "Report e analisi",
    categoria: "Business",
    funzioni: ["Statistiche vendite e andamento", "Export dati per decisioni operative"],
    prezzoMensile: 12,
  },
  {
    id: "multi_sede",
    nome: "Punti vendita multipli",
    categoria: "Business",
    funzioni: ["Gestione più sedi / punti vendita", "Parametri e menu per sede"],
    prezzoMensile: 18,
  },
  {
    id: "ruoli_avanzati",
    nome: "Ruoli e permessi avanzati",
    categoria: "Business",
    funzioni: ["Profili utente granulari", "Accesso per area applicativa"],
    prezzoMensile: 10,
  },
  {
    id: "menu_listini",
    nome: "Menu e listini avanzati",
    categoria: "Business",
    funzioni: ["Listini stagionali e varianti", "Gestione complessa categorie e prezzi"],
    prezzoMensile: 8,
  },
  {
    id: "supporto_prioritario",
    nome: "Supporto prioritario",
    categoria: "Assistenza",
    funzioni: ["Canale assistenza con priorità", "Tempi di risposta ridotti"],
    prezzoMensile: 15,
  },
  {
    id: "api_integrazioni",
    nome: "API e integrazioni",
    categoria: "Enterprise",
    funzioni: ["Endpoint per sistemi esterni", "Integrazione con POS, delivery partner, ecc."],
    prezzoMensile: 45,
  },
  {
    id: "account_manager",
    nome: "Account manager dedicato",
    categoria: "Enterprise",
    funzioni: ["Referente commerciale dedicato", "Revisione periodica setup e obiettivi"],
    prezzoMensile: 60,
  },
  {
    id: "sla_personalizzazioni",
    nome: "SLA e personalizzazioni",
    categoria: "Enterprise",
    funzioni: ["Accordi su tempi e disponibilità", "Sviluppi o personalizzazioni su misura"],
    prezzoMensile: 80,
  },
];

export const IDS_BASE = ["ordini_cassa", "stampa_comanda", "gestione_consegne"];
export const IDS_PRO = [...IDS_BASE, "ordini_online"];
export const IDS_ENTERPRISE = [...IDS_PRO, "tablet_ruoli"];
export const IDS_FULL = DEFAULT_SERVICES_CATALOG.map((s) => s.id);
