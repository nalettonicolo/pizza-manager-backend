/**
 * Sidebar admin tenant — voci raggruppate per sezione.
 * @typedef {{ to: string, label: string, end?: boolean }} AdminSidebarItem
 * @typedef {{ label: string, items: AdminSidebarItem[] }} AdminSidebarGroup
 */

/** @type {AdminSidebarGroup[]} */
export const SETTINGS_SIDEBAR_GROUPS = [
  {
    label: "Locale",
    items: [
      { to: "/admin/settings/dati-pizzeria", label: "Dati pizzeria" },
      { to: "/admin/settings/orari", label: "Giorni e orari" },
      { to: "/admin/settings/area-consegna", label: "Area di consegna" },
    ],
  },
  {
    label: "Vetrina",
    items: [
      { to: "/admin/settings/layout", label: "Aspetto vetrina" },
      { to: "/admin/settings/pagamenti-online", label: "Pagamenti online" },
    ],
  },
  {
    label: "Operatività",
    items: [
      { to: "/admin/settings/parametri", label: "Parametri operativi" },
      { to: "/admin/settings/stampa-operativa", label: "Stampa operativa" },
    ],
  },
]

/** @type {AdminSidebarGroup[]} */
export const MENU_SIDEBAR_GROUPS = [
  {
    label: "Struttura",
    items: [
      { to: "/admin/menu/categorie", label: "Categorie" },
      { to: "/admin/menu/formati", label: "Formati" },
      { to: "/admin/menu/cottura", label: "Cottura" },
    ],
  },
  {
    label: "Prodotti",
    items: [
      { to: "/admin/menu/pizze", label: "Pizze" },
      { to: "/admin/menu/ingredienti", label: "Ingredienti" },
      { to: "/admin/menu/impasti", label: "Impasti" },
      { to: "/admin/menu/bibite", label: "Bibite" },
      { to: "/admin/menu/dolci", label: "Dolci" },
      { to: "/admin/menu/fritti", label: "Fritti" },
      { to: "/admin/menu/allergeni", label: "Allergeni" },
    ],
  },
  {
    label: "Listino e cucina",
    items: [
      { to: "/admin/menu/listini", label: "Listini e backup" },
      { to: "/admin/menu/prep-cucina-colori", label: "Colori prep Cucina" },
    ],
  },
]

/** @type {AdminSidebarGroup[]} */
export const MAGAZZINO_SIDEBAR_GROUPS = [
  {
    label: "Magazzino",
    items: [
      { to: "/admin/magazzino", label: "Panoramica", end: true },
      { to: "/admin/magazzino/ordini-fornitori", label: "Ordini fornitori" },
      { to: "/admin/magazzino/ddt", label: "DDT" },
      { to: "/admin/magazzino/movimenti-db", label: "Movimenti (DB)" },
    ],
  },
]

/** @type {AdminSidebarGroup[]} */
export const CONTABILITA_SIDEBAR_GROUPS = [
  {
    label: "Contabilità",
    items: [
      { to: "/admin/contabilita", label: "Panoramica", end: true },
      { to: "/admin/contabilita/fatture", label: "Fatture" },
      { to: "/admin/contabilita/pagamenti-fatture", label: "Pagamenti fatture" },
      { to: "/admin/contabilita/food-cost", label: "Food cost" },
      { to: "/admin/contabilita/spese-locale", label: "Spese gestione locale" },
      { to: "/admin/contabilita/spese-personale", label: "Spese gestione personale" },
      { to: "/admin/contabilita/incassi", label: "Gestione incassi" },
    ],
  },
  {
    label: "Code e monitor",
    items: [
      { to: "/admin/fiscal-outbox", label: "Coda fiscale" },
      { to: "/admin/notifiche-outbox", label: "Coda notifiche" },
    ],
  },
]

/** @type {AdminSidebarGroup[]} */
export const CONTABILITA_SEMPLICE_SIDEBAR_GROUPS = [
  {
    label: "Contabilità",
    items: [{ to: "/admin/contabilita/incassi", label: "Gestione incassi" }],
  },
]

/**
 * @param {AdminSidebarGroup[]} groups
 * @returns {AdminSidebarItem[]}
 */
export function flattenSidebarGroups(groups) {
  return groups.flatMap((g) => g.items)
}
