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
  {
    to: "/operative/dashboard",
    label: "Aree di lavoro",
    description: "Hub reparti e panoramica demo",
    areaKey: "riepilogo",
    servizioId: null,
    group: "panoramica",
  },
  {
    to: "/operative/cassa",
    label: "Cassa",
    description: "Ordini, carrello e incassi in sala",
    areaKey: "cassa",
    servizioId: "ordini_cassa",
    group: "cassa",
  },
  {
    to: "/operative/cassa/prodotti-esauriti",
    label: "Prodotti esauriti",
    description: "Blocca articoli non disponibili",
    areaKey: "cassa",
    servizioId: "ordini_cassa",
    group: "cassa",
  },
  {
    to: "/operative/cassa/stampanti-reparti",
    label: "Stampanti (USB / IP)",
    description: "Comande e stampanti di reparto",
    areaKey: "cassa",
    servizioId: "stampa_comanda",
    group: "cassa",
  },
  {
    to: "/operative/turni",
    label: "Turni",
    description: "Apertura e chiusura turno cassa",
    areaKey: "cassa",
    servizioId: "ordini_cassa",
    group: "cassa",
  },
  {
    to: "/operative/cucina",
    label: "Cucina",
    description: "Preparazione e task di cucina",
    areaKey: "cucina",
    servizioId: "tablet_ruoli",
    group: "reparti",
  },
  {
    to: "/operative/bancone",
    label: "Bancone",
    description: "Comande pronte e ritiri",
    areaKey: "bancone",
    servizioId: "tablet_ruoli",
    group: "reparti",
  },
  {
    to: "/operative/pizzaioli",
    label: "Pizzaioli",
    description: "Forno e cotture in corso",
    areaKey: "pizzaiolo",
    servizioId: "tablet_ruoli",
    group: "reparti",
  },
  {
    to: "/operative/delivery",
    label: "Delivery / Pony",
    description: "Consegne a domicilio e pony",
    areaKey: "delivery",
    servizioId: "gestione_consegne",
    group: "reparti",
  },
  {
    to: "/operative/rider",
    label: "Pony (rider)",
    description: "Vista rider / pony su strada",
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
