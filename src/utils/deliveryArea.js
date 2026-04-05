/**
 * Area di consegna da `parametri_operativi.consegna_area_poligono` (GeoJSON Polygon, WGS84).
 */

/** @param {unknown} po — parametri_operativi */
export function getDeliveryPolygonOuterRing(po) {
  if (!po || typeof po !== "object") return null
  const gj = po.consegna_area_poligono
  if (!gj || typeof gj !== "object" || gj.type !== "Polygon") return null
  const coords = gj.coordinates
  if (!Array.isArray(coords) || !coords[0] || !Array.isArray(coords[0])) return null
  const ring = coords[0]
  if (ring.length < 4) return null
  return ring
}

/**
 * Ray casting (anello chiuso GeoJSON, coordinate [lng, lat]).
 * @param {number} lng
 * @param {number} lat
 * @param {number[][]} ring
 */
export function pointInPolygonRing(lng, lat, ring) {
  if (!Array.isArray(ring) || ring.length < 4) return null
  let n = ring.length
  const tol = 1e-9
  const same =
    Math.abs(Number(ring[0][0]) - Number(ring[n - 1][0])) < tol &&
    Math.abs(Number(ring[0][1]) - Number(ring[n - 1][1])) < tol
  if (same) n -= 1
  if (n < 3) return null

  let inside = false
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n
    const xi = Number(ring[i][0])
    const yi = Number(ring[i][1])
    const xj = Number(ring[j][0])
    const yj = Number(ring[j][1])
    if ((yi > lat) !== (yj > lat)) {
      const xinters = ((xj - xi) * (lat - yi)) / (yj - yi) + xi
      if (lng < xinters) inside = !inside
    }
  }
  return inside
}

/** @param {unknown} po */
export function isPointInDeliveryArea(lng, lat, po) {
  const ring = getDeliveryPolygonOuterRing(po)
  if (!ring) return null
  const v = pointInPolygonRing(lng, lat, ring)
  return v
}

/**
 * Converte path Google Maps in GeoJSON Polygon (primo anello chiuso).
 * @param {Array<{ lat(): number, lng(): number }>} pathMvc
 */
export function googlePathToGeoJsonPolygon(pathMvc) {
  if (!pathMvc || !pathMvc.getLength || pathMvc.getLength() < 3) return null
  const n = pathMvc.getLength()
  const ring = []
  for (let i = 0; i < n; i++) {
    const p = pathMvc.getAt(i)
    ring.push([p.lng(), p.lat()])
  }
  const first = ring[0]
  const last = ring[ring.length - 1]
  if (first[0] !== last[0] || first[1] !== last[1]) {
    ring.push([first[0], first[1]])
  }
  return { type: "Polygon", coordinates: [ring] }
}
