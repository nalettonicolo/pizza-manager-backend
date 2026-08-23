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

/** Coordinate sede: PV attivo se presenti, altrimenti tenant. */
export function resolveShopCoords(tenantData, puntoVendita) {
  const pvLat = Number(puntoVendita?.lat)
  const pvLng = Number(puntoVendita?.lng)
  if (Number.isFinite(pvLat) && Number.isFinite(pvLng)) return { lat: pvLat, lng: pvLng }
  const lat = Number(tenantData?.lat)
  const lng = Number(tenantData?.lng)
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null
}

/** Anello area consegna: poligono PV se configurato, altrimenti tenant. */
export function resolveDeliveryPolygonOuterRing(tenantData, puntoVendita) {
  const pvPoly = puntoVendita?.consegna_area_poligono
  if (pvPoly && typeof pvPoly === "object" && pvPoly.type === "Polygon") {
    return getDeliveryPolygonOuterRing({ consegna_area_poligono: pvPoly })
  }
  return getDeliveryPolygonOuterRing(tenantData?.parametri_operativi)
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

/**
 * Inserisce punti lungo ogni lato del poligono (stesso perimetro, più vertici per sagomare con l’editor).
 * `ring` = anello GeoJSON [lng,lat], chiuso (ultimo punto = primo) o meno.
 * @param {number[][]} ring
 * @param {number} [extraPerEdge=2] punti aggiunti per ogni lato (oltre ai vertici originali)
 */
export function densifyPolygonRingLngLat(ring, extraPerEdge = 2) {
  if (!Array.isArray(ring) || ring.length < 3) return ring
  const tol = 1e-9
  let vertices = ring.map((c) => [Number(c[0]), Number(c[1])])
  const first = vertices[0]
  const last = vertices[vertices.length - 1]
  if (
    vertices.length > 1 &&
    Math.abs(first[0] - last[0]) < tol &&
    Math.abs(first[1] - last[1]) < tol
  ) {
    vertices = vertices.slice(0, -1)
  }
  const m = vertices.length
  if (m < 3) return ring
  const ex = Math.max(0, Math.min(8, Math.floor(Number(extraPerEdge) || 0)))
  const out = []
  for (let i = 0; i < m; i++) {
    const a = vertices[i]
    const b = vertices[(i + 1) % m]
    out.push([a[0], a[1]])
    for (let k = 1; k <= ex; k++) {
      const t = k / (ex + 1)
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t])
    }
  }
  out.push([out[0][0], out[0][1]])
  return out
}

const EARTH_RADIUS_M = 6371000

/**
 * Punto sulla sfera a distanza `distanceMeters` da (latDeg, lngDeg) con bearing radianti (0 = Nord).
 */
function destinationPointLngLat(latDeg, lngDeg, distanceMeters, bearingRad) {
  const φ1 = (latDeg * Math.PI) / 180
  const λ1 = (lngDeg * Math.PI) / 180
  const δ = distanceMeters / EARTH_RADIUS_M
  const sinφ1 = Math.sin(φ1)
  const cosφ1 = Math.cos(φ1)
  const sinδ = Math.sin(δ)
  const cosδ = Math.cos(δ)
  const sinφ2 = sinφ1 * cosδ + cosφ1 * sinδ * Math.cos(bearingRad)
  const φ2 = Math.asin(sinφ2)
  const y = Math.sin(bearingRad) * sinδ * cosφ1
  const x = cosδ - sinφ1 * sinφ2
  const λ2 = λ1 + Math.atan2(y, x)
  const lat2 = (φ2 * 180) / Math.PI
  let lng2 = (λ2 * 180) / Math.PI
  lng2 = ((((lng2 + 180) % 360) + 360) % 360) - 180
  return { lat: lat2, lng: lng2 }
}

/**
 * Raggio lineare (km) percorribile in `minutes` a velocità costante `speedKmh`.
 * Esempio: 20 km/h × 15 min → 5 km.
 */
export function radiusKmFromSpeedAndMinutes(speedKmh, minutes) {
  const v = Math.max(0.1, Number(speedKmh) || 20)
  const m = Math.max(1, Number(minutes) || 15)
  return (v / 60) * m
}

/**
 * Raggio in metri (stessa formula di {@link radiusKmFromSpeedAndMinutes} × 1000).
 */
export function radiusMetersFromSpeedAndMinutes(speedKmh, minutes) {
  return radiusKmFromSpeedAndMinutes(speedKmh, minutes) * 1000
}

/**
 * GeoJSON Polygon (WGS84) circolare approssimato con `numPoints` lati.
 * @param {number} lat
 * @param {number} lng
 * @param {number} radiusMeters
 * @param {number} [numPoints=64]
 */
export function geoJsonCirclePolygon(lat, lng, radiusMeters, numPoints = 64) {
  const la = Number(lat)
  const lo = Number(lng)
  if (!Number.isFinite(la) || !Number.isFinite(lo)) return null
  const R = Math.max(10, Number(radiusMeters) || 0)
  const n = Math.max(8, Math.min(128, Math.floor(Number(numPoints)) || 64))
  const ring = []
  for (let i = 0; i <= n; i++) {
    const bearing = (2 * Math.PI * i) / n
    const p = destinationPointLngLat(la, lo, R, bearing)
    ring.push([p.lng, p.lat])
  }
  return { type: "Polygon", coordinates: [ring] }
}
