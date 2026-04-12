/**
 * Mappa servizio (id catalogo) ↔ aree implementate in app.
 * Usata dalla scheda Super Admin e dal gate servizi (VITE_ENFORCE_SERVIZI_PLAN, bypass VITE_DISABLE_SERVIZI_GATE).
 */

/** @typedef {{ label: string, paths: string[], note?: string }} ModuloImplementato */

/**
 * @typedef {{
 *   sintesi: string,
 *   moduli: ModuloImplementato[],
 *   riferimentiCodice?: string[],
 * }} SchedaServizioImplementazione
 */

/** @type {Record<string, SchedaServizioImplementazione>} */
export const SCHEDE_SERVIZI_IMPLEMENTAZIONE = {
  ordini_cassa: {
    sintesi: "Creazione ordini, incasso al banco, turni e prodotti esauriti collegati al flusso cassa.",
    moduli: [
      { label: "Cassa", paths: ["/operative/cassa"], note: "Ordini e ricevuta" },
      { label: "Prodotti esauriti", paths: ["/operative/cassa/prodotti-esauriti"] },
      { label: "Turni", paths: ["/operative/turni"], note: "API backend turni dove configurato" },
    ],
    riferimentiCodice: ["src/features/operative/cassa/pages/CassaPage.jsx", "src/features/operative/pages/OperativeTurniPage.jsx"],
  },
  stampa_comanda: {
    sintesi: "Riepilogo ordine per reparto integrato nel flusso cassa / preparazione.",
    moduli: [
      { label: "Flusso cassa e reparti", paths: ["/operative/cassa", "/operative/bancone", "/operative/cucina"] },
      { label: "Stampanti reparto (IP)", paths: ["/operative/cassa/stampanti-reparti"] },
    ],
    riferimentiCodice: [
      "printComanda.js",
      "comandaRepartiStampanti.js",
      "CassaStampantiRepartiPage.jsx",
    ],
  },
  gestione_consegne: {
    sintesi: "Dashboard delivery / rider e coordinamento consegne.",
    moduli: [
      {
        label: "Delivery / asporto (pony)",
        paths: ["/operative/delivery"],
        note: "La route /operative/pony reindirizza alla stessa dashboard delivery",
      },
    ],
    riferimentiCodice: ["src/features/operative/delivery/pages/DeliveryDashboard.jsx", "AppRouter.jsx /operative/pony"],
  },
  ordini_online: {
    sintesi: "Negozio pubblico, ordine cliente e pubblicazione sito / dominio.",
    moduli: [
      { label: "Store e preview SaaS", paths: ["/negozio", "/preview"] },
      { label: "Dominio pizzeria", paths: ["/ordine", "/ordine-confermato"], note: "Solo host non-SaaS" },
      { label: "Super Admin dominio / deploy", paths: ["/superadmin/pubblicazione-sito"] },
    ],
    riferimentiCodice: [
      "src/features/public/pages/PublicStore.jsx",
      "src/features/pubblicazione/PubblicazioneSitoWorkspace.jsx",
      "src/features/services/publicService.js",
    ],
  },
  tablet_ruoli: {
    sintesi: "Schermate operative per cucina, bancone, pizzaioli e delivery (permessi per area).",
    moduli: [
      { label: "Cucina", paths: ["/operative/cucina"] },
      { label: "Bancone", paths: ["/operative/bancone"] },
      { label: "Pizzaioli", paths: ["/operative/pizzaioli"] },
      { label: "Delivery", paths: ["/operative/delivery"] },
    ],
    riferimentiCodice: ["src/layouts/OperativeLayout.jsx", "src/app/contexts/AuthContext.jsx (permessiAree)"],
  },
  report_analisi: {
    sintesi: "Report vendite e KPI in area amministrazione.",
    moduli: [{ label: "Report", paths: ["/admin/report"] }],
    riferimentiCodice: ["src/features/admin/pages/Report.jsx"],
  },
  multi_sede: {
    sintesi: "Selezione punto vendita e dati tenant multi-PV.",
    moduli: [
      { label: "Selezione PV", paths: ["/select-pv"] },
      { label: "Contesto PV", paths: [], note: "PvContext dopo login" },
    ],
    riferimentiCodice: ["src/app/contexts/PvContext.jsx", "src/features/public/pages/SelectPuntoVendita.jsx"],
  },
  ruoli_avanzati: {
    sintesi: "Configurazione ruoli e permessi sulle aree operative.",
    moduli: [{ label: "Ruoli", paths: ["/admin/ruoli"] }],
    riferimentiCodice: ["src/features/admin/pages/RuoliPage.jsx"],
  },
  menu_listini: {
    sintesi: "Gestione menu completo (categorie, listini, ingredienti, allergeni, ecc.).",
    moduli: [{ label: "Menu admin", paths: ["/admin/menu"], note: "Prefisso /admin/menu/*" }],
    riferimentiCodice: ["src/features/admin/pages/menu/*"],
  },
  magazzino_gestione: {
    sintesi: "Fornitori, listino con soglie di riordino e registro DDT in entrata (persistenza locale per tenant).",
    moduli: [
      { label: "Magazzino", paths: ["/admin/magazzino"], note: "Hub, ordini fornitori, DDT" },
    ],
    riferimentiCodice: ["src/features/admin/pages/magazzino/*", "useTenantLocalJson"],
  },
  contabilita_locale: {
    sintesi: "Registri economici in locale: fatture, pagamenti, food cost, spese, incassi (collegabile ai DDT).",
    moduli: [{ label: "Contabilità", paths: ["/admin/contabilita"], note: "Hub e sotto-pagine" }],
    riferimentiCodice: ["src/features/admin/pages/contabilita/*", "useTenantLocalJson"],
  },
  contabilita_semplice: {
    sintesi: "Incassi manuali + riepilogo quantità vendute per macro-categoria menu (pizze, fritti, dolci, bibite).",
    moduli: [
      { label: "Gestione incassi", paths: ["/admin/contabilita/incassi"], note: "Unica voce menu; hub reindirizza qui" },
    ],
    riferimentiCodice: [
      "GestioneIncassiPage.jsx",
      "useTenantServizi (contabilitaMode)",
      "adminService.getVenditeMacroCategorieInPeriod",
    ],
  },
  fidelity_card: {
    sintesi: "Carta fedeltà: punti per clienti anagrafica cassa, codice carta e movimenti.",
    moduli: [{ label: "Fidelity Card", paths: ["/admin/fidelity", "/operative/cassa/fidelity"] }],
    riferimentiCodice: [
      "src/features/admin/pages/FidelityCardPage.jsx",
      "src/features/operative/cassa/pages/CassaFidelityPage.jsx",
      "adminService (getFidelitySaldi, …)",
    ],
  },
  supporto_prioritario: {
    sintesi: "Offerta commerciale: nessun modulo dedicato in app.",
    moduli: [],
  },
  gestione_tavoli: {
    sintesi: "Roadmap: mappa sale e tavoli non ancora in produzione.",
    moduli: [],
    riferimentiCodice: [],
  },
  api_integrazioni: {
    sintesi: "Backend Nest (server/pizzeria-backend) e RPC/API parziali (es. turni).",
    moduli: [],
    riferimentiCodice: ["server/pizzeria-backend"],
  },
  account_manager: {
    sintesi: "Offerta commerciale: nessun gate in app.",
    moduli: [],
  },
  sla_personalizzazioni: {
    sintesi: "Offerta commerciale / progetti su misura.",
    moduli: [],
  },
};

export function schedaImplementazioneForServizioId(id) {
  return SCHEDE_SERVIZI_IMPLEMENTAZIONE[id] ?? null;
}
