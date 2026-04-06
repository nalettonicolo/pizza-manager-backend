import { getDeliveryPolygonOuterRing, pointInPolygonRing } from "@/utils/deliveryArea"

/**
 * Per ogni PV: poligono proprio in `consegna_area_poligono`, altrimenti poligono tenant (`parametri_operativi`).
 * @param {Array<{ id: string, attivo?: boolean, consegna_area_poligono?: unknown }>} puntiVendita
 * @param {number} lng
 * @param {number} lat
 * @param {Record<string, unknown>} tenantParametri
 * @returns {{ matchIds: string[], reason: null | "nessuna_sede" | "nessun_poligono" | "fuori_area" }}
 */
export function resolveMatchingPuntiVendita(puntiVendita, lng, lat, tenantParametri) {
  const tenantRing = getDeliveryPolygonOuterRing(tenantParametri)
  const active = (puntiVendita || []).filter((p) => p && p.attivo !== false)
  if (active.length === 0) {
    return { matchIds: [], reason: "nessuna_sede" }
  }

  const matchIds = []
  for (const pv of active) {
    const own = pv.consegna_area_poligono
    const ring =
      own && typeof own === "object" && own.type === "Polygon"
        ? getDeliveryPolygonOuterRing({ consegna_area_poligono: own })
        : tenantRing
    if (!ring) continue
    if (pointInPolygonRing(lng, lat, ring)) matchIds.push(String(pv.id))
  }

  if (matchIds.length === 0) {
    const anyRing = active.some((pv) => {
      const own = pv.consegna_area_poligono
      return own && typeof own === "object" && own.type === "Polygon"
    })
    if (!tenantRing && !anyRing) {
      return { matchIds: [], reason: "nessun_poligono" }
    }
    return { matchIds: [], reason: "fuori_area" }
  }

  return { matchIds, reason: null }
}
