/**
 * URL Google Maps per una consegna: coordinate se ci sono, altrimenti ricerca indirizzo.
 */
export function consegnaMapsUrl({ lat, lng, indirizzo } = {}) {
  const la = lat != null ? Number(lat) : NaN
  const ln = lng != null ? Number(lng) : NaN
  if (Number.isFinite(la) && Number.isFinite(ln)) {
    return `https://www.google.com/maps?q=${la},${ln}`
  }
  const ind = String(indirizzo || "").trim()
  if (!ind) return null
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(ind)}`
}
