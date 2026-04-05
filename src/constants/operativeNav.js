/**
 * Voci area operativa: permessi (`areaKey`) e servizio catalogo (`servizioId`).
 * Unica fonte per sidebar, eligibility e dashboard riepilogo.
 */
export const OPERATIVE_AREA_NAV = Object.freeze([
  { to: "/operative/dashboard", label: "Riepilogo", areaKey: "riepilogo", servizioId: null },
  { to: "/operative/cassa", label: "Cassa", areaKey: "cassa", servizioId: "ordini_cassa" },
  { to: "/operative/cassa/prodotti-esauriti", label: "Prodotti esauriti", areaKey: "cassa", servizioId: "ordini_cassa" },
  { to: "/operative/turni", label: "Turni", areaKey: "cassa", servizioId: "ordini_cassa" },
  { to: "/operative/cucina", label: "Cucina", areaKey: "cucina", servizioId: "tablet_ruoli" },
  { to: "/operative/bancone", label: "Bancone", areaKey: "bancone", servizioId: "tablet_ruoli" },
  { to: "/operative/pizzaioli", label: "Pizzaioli", areaKey: "pizzaiolo", servizioId: "tablet_ruoli" },
  { to: "/operative/delivery", label: "Delivery", areaKey: "delivery", servizioId: "gestione_consegne" },
]);
