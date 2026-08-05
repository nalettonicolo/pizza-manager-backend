/**
 * Voci area operativa: permessi (`areaKey`) e servizio catalogo (`servizioId`).
 * Unica fonte per sidebar, eligibility e home «Aree di lavoro».
 */

/** Sezioni sidebar (ordine di visualizzazione). */
export const OPERATIVE_NAV_GROUPS = Object.freeze([
  { id: "panoramica", label: "Panoramica" },
  { id: "cassa", label: "Cassa" },
  { id: "reparti", label: "Reparti" },
  { id: "strumenti", label: "Strumenti" },
  { id: "admin", label: "Amministrazione" },
])

export const OPERATIVE_AREA_NAV = Object.freeze([
  { to: "/operative/dashboard", label: "Aree di lavoro", areaKey: "riepilogo", servizioId: null, group: "panoramica" },
  { to: "/operative/cassa", label: "Cassa", areaKey: "cassa", servizioId: "ordini_cassa", group: "cassa" },
  {
    to: "/operative/cassa/prodotti-esauriti",
    label: "Prodotti esauriti",
    areaKey: "cassa",
    servizioId: "ordini_cassa",
    group: "cassa",
  },
  {
    to: "/operative/cassa/stampanti-reparti",
    label: "Stampanti (USB / IP)",
    areaKey: "cassa",
    servizioId: "stampa_comanda",
    group: "cassa",
  },
  { to: "/operative/turni", label: "Turni", areaKey: "cassa", servizioId: "ordini_cassa", group: "cassa" },
  { to: "/operative/cucina", label: "Cucina", areaKey: "cucina", servizioId: "tablet_ruoli", group: "reparti" },
  { to: "/operative/bancone", label: "Bancone", areaKey: "bancone", servizioId: "tablet_ruoli", group: "reparti" },
  { to: "/operative/pizzaioli", label: "Pizzaioli", areaKey: "pizzaiolo", servizioId: "tablet_ruoli", group: "reparti" },
  {
    to: "/operative/delivery",
    label: "Delivery",
    areaKey: "delivery",
    servizioId: "gestione_consegne",
    group: "reparti",
  },
])

/**
 * Raggruppa voci filtrate per `OPERATIVE_NAV_GROUPS` (salta gruppi vuoti).
 * @param {typeof OPERATIVE_AREA_NAV[number][]} items
 * @returns {{ id: string, label: string, items: typeof items }[]}
 */
export function groupOperativeNavItems(items) {
  const list = Array.isArray(items) ? items : []
  return OPERATIVE_NAV_GROUPS.map((g) => ({
    id: g.id,
    label: g.label,
    items: list.filter((item) => (item.group || "reparti") === g.id),
  })).filter((g) => g.items.length > 0)
}
