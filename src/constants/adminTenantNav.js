/**
 * Navigazione Admin tenant: unica fonte per barra superiore e hub `/admin/home`.
 * Ordine pensato per gestore locale (quotidiano → locale → moduli → guida).
 */

export const ADMIN_TOP_NAV = Object.freeze([
  { to: "/admin/home", label: "Home", servizioId: null, end: true },
  { to: "/admin/ordini", label: "Ordini", servizioId: null },
  { to: "/admin/menu", label: "Menu", servizioId: null },
  { to: "/admin/report", label: "Report", servizioId: "report_analisi" },
  { to: "/admin/magazzino", label: "Magazzino", servizioId: "magazzino_gestione" },
  { to: "/admin/contabilita", label: "Contabilità", servizioId: null },
  { to: "/admin/fidelity", label: "Fidelity", servizioId: "fidelity_card" },
  { to: "/admin/dipendenti", label: "Staff", servizioId: null },
  { to: "/admin/documenti", label: "Documenti", servizioId: null },
  { to: "/admin/settings", label: "Impostazioni", servizioId: null },
  { to: "/admin/manuale", label: "Guida", servizioId: null },
])

/**
 * Sezioni hub home admin (card). `servizioId` opzionale: nascosto se piano non include.
 * Contabilità: filtro speciale in Home (come in AdminLayout).
 */
export const ADMIN_HOME_SECTIONS = Object.freeze([
  {
    id: "quotidiano",
    title: "Operatività",
    lede: "Ordini, listino e andamento del locale.",
    items: [
      {
        to: "/admin/ordini",
        label: "Ordini",
        description: "Stato e dettaglio degli ordini",
      },
      {
        to: "/admin/menu",
        label: "Menu",
        description: "Categorie, pizze, listini e allergeni",
      },
      {
        to: "/admin/report",
        label: "Report",
        description: "Incassi e analisi vendite",
        servizioId: "report_analisi",
      },
    ],
  },
  {
    id: "locale",
    title: "Locale e team",
    lede: "Configura la pizzeria e chi può accedere alle aree.",
    items: [
      {
        to: "/admin/settings",
        label: "Impostazioni",
        description: "Dati sede, orari, consegne e parametri",
      },
      {
        to: "/admin/dipendenti",
        label: "Dipendenti",
        description: "Account staff e aree consentite",
      },
      {
        to: "/admin/ruoli",
        label: "Ruoli",
        description: "Permessi per tipo di operatore",
      },
      {
        to: "/admin/documenti",
        label: "Documenti",
        description: "Contratti, pagamenti e comunicazioni con PizzaManager",
      },
      {
        to: "/admin/manuale",
        label: "Guida",
        description: "Manuale operativo per titolare e staff",
      },
    ],
  },
  {
    id: "moduli",
    title: "Gestione avanzata",
    lede: "Moduli del piano (se attivi).",
    items: [
      {
        to: "/admin/magazzino",
        label: "Magazzino",
        description: "Fornitori, DDT e movimenti",
        servizioId: "magazzino_gestione",
      },
      {
        to: "/admin/contabilita",
        label: "Contabilità",
        description: "Incassi, spese e food cost",
        contabilita: true,
      },
      {
        to: "/admin/fidelity",
        label: "Fidelity",
        description: "Carte fedeltà clienti",
        servizioId: "fidelity_card",
      },
    ],
  },
])
