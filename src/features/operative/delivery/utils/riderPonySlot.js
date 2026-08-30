/**
 * Slot pony (1 / 2) dalle route PWA: /operative/rider/1, /operative/pony/2.
 * Usato da Rider PWA, Sala QA e presence.
 */

export function parseRiderPonySlot(pathname) {
  const m = String(pathname || "").match(/^\/operative\/(?:rider|pony)\/(\d+)$/)
  if (!m) return null
  const n = Number(m[1])
  return n === 1 || n === 2 ? n : null
}

export function riderPonySlotLabel(slot) {
  return slot === 1 || slot === 2 ? `Pony ${slot}` : "Rider"
}

/** Colori allineati alla mappa live (primo = rosso, secondo = blu). */
export function riderPonySlotColor(slot) {
  if (slot === 1) return "#ef4444"
  if (slot === 2) return "#3b82f6"
  return "#0f172a"
}

/** Nome digitato a inizio turno (sessionStorage), distinto per slot pony. */
export function riderNameSessionKey(slot) {
  return slot ? `pm_rider_nome_confermato_v1_pony_${slot}` : "pm_rider_nome_confermato_v1"
}
