/** Distanza Haversine in km tra due coordinate WGS84. */
export function haversineKm(lat1, lon1, lat2, lon2) {
  const toRad = (d) => (d * Math.PI) / 180
  const R = 6371
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

/**
 * Ordina ordini delivery per vicinanza (nearest-neighbor greedy).
 * @param {Array} orders ordini con consegna_lat/lng
 * @param {{ lat: number, lng: number } | null} start punto di partenza (es. pizzeria o rider)
 */
export function sortOrdersByNearestNeighbor(orders, start) {
  const list = [...(orders || [])]
  if (!start || list.length < 2) return list

  const remaining = [...list]
  const sorted = []
  let curLat = start.lat
  let curLng = start.lng

  while (remaining.length) {
    let bestIdx = 0
    let bestDist = Infinity
    for (let i = 0; i < remaining.length; i++) {
      const o = remaining[i]
      const lat = Number(o.consegna_lat ?? o.consegnaLat)
      const lng = Number(o.consegna_lng ?? o.consegnaLng)
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        bestIdx = i
        bestDist = Infinity
        break
      }
      const d = haversineKm(curLat, curLng, lat, lng)
      if (d < bestDist) {
        bestDist = d
        bestIdx = i
      }
    }
    const next = remaining.splice(bestIdx, 1)[0]
    sorted.push(next)
    const nLat = Number(next.consegna_lat ?? next.consegnaLat)
    const nLng = Number(next.consegna_lng ?? next.consegnaLng)
    if (Number.isFinite(nLat) && Number.isFinite(nLng)) {
      curLat = nLat
      curLng = nLng
    }
  }
  return sorted
}
