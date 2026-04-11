/**
 * Utility per la vista Pizzaioli: filtra ordini X minuti prima dell'orario, ordinamento, ritardo.
 */

/** Converte "HH:mm" in minuti da mezzanotte (oggi). */
export function orarioToMinutes(orarioStr) {
  if (!orarioStr || typeof orarioStr !== "string") return null
  const [h, m] = orarioStr.trim().split(":").map(Number)
  if (h == null || isNaN(h)) return null
  return (h || 0) * 60 + (m || 0)
}

/** Minuti da mezzanotte per "adesso" (oggi). */
export function nowMinutes() {
  const d = new Date()
  return d.getHours() * 60 + d.getMinutes()
}

/**
 * Filtra ordini visibili nella pagina Pizzaioli.
 * Mostra orario in [now - 24h, now + minutiPrima] così gli ordini calendarizzati (es. 18:30)
 * non ancora preparati restano in pagina anche se l'orario è già passato.
 */
export function filterOrdiniVisibili(ordini, minutiPrima = 45) {
  const now = nowMinutes()
  const maxAhead = now + Math.max(0, minutiPrima)
  const minPast = now - 24 * 60 // 24 ore nel passato: ordini in ritardo restano visibili
  return (ordini || []).filter((o) => {
    const min = orarioToMinutes(o.orario_ritiro ?? o.orarioRitiro)
    if (min == null) return false
    return min >= minPast && min <= maxAhead
  })
}

/** Ordina per orario_ritiro crescente. */
export function sortOrdiniByOrario(ordini) {
  return [...(ordini || [])].sort((a, b) => {
    const ma = orarioToMinutes(a.orario_ritiro ?? a.orarioRitiro) ?? 9999
    const mb = orarioToMinutes(b.orario_ritiro ?? b.orarioRitiro) ?? 9999
    return ma - mb
  })
}

/**
 * Calcola minuti di ritardo per un ordine.
 * Negozio: ritardo se now > orario_ritiro.
 * Consegna: ritardo se now > (orario_ritiro - partenzaConsegneMinuti). Le pizze devono essere pronte "partenzaConsegneMinuti" prima dell'orario.
 * @returns { number } minuti di ritardo (0 se in orario)
 */
export function getRitardoMinuti(ordine, partenzaConsegneMinuti = 30) {
  const orario = ordine.orario_ritiro ?? ordine.orarioRitiro
  const min = orarioToMinutes(orario)
  if (min == null) return 0
  const now = nowMinutes()
  const isDelivery = (ordine.tipo_ordine || "").toLowerCase() === "delivery"
  const deadline = isDelivery ? min - Math.max(0, partenzaConsegneMinuti) : min
  if (now <= deadline) return 0
  return now - deadline
}

/** Raggruppa per orario_ritiro (slot 15 min) e conta pizze. Restituisce { orarioLabel: count } solo per slot con count > 0. */
export function slotPizzeCount(ordini, pizzePerOrdine, slotMinutes = 15) {
  const map = {}
  for (const o of ordini || []) {
    const orario = o.orario_ritiro ?? o.orarioRitiro
    if (!orario) continue
    const [h, m] = orario.trim().split(":").map(Number)
    const slotM = Math.floor(((h || 0) * 60 + (m || 0)) / slotMinutes) * slotMinutes
    const label = `${String(Math.floor(slotM / 60)).padStart(2, "0")}:${String(slotM % 60).padStart(2, "0")}`
    const pizze = pizzePerOrdine?.[o.id] ?? 0
    map[label] = (map[label] || 0) + pizze
  }
  return map
}

/** Ordina le chiavi orario per tempo. */
export function sortedSlotLabels(slotPizzeMap) {
  return Object.keys(slotPizzeMap || {}).sort((a, b) => {
    const [ha, ma] = a.split(":").map(Number)
    const [hb, mb] = b.split(":").map(Number)
    return (ha || 0) * 60 + (ma || 0) - (hb || 0) * 60 - (mb || 0)
  })
}

/** Etichetta slot (es. 15 min) da stringa orario HH:mm. */
export function orarioToSlotLabel(orarioStr, slotMinutes = 15) {
  if (!orarioStr || typeof orarioStr !== "string") return null
  const [h, m] = orarioStr.trim().split(":").map(Number)
  if (h == null || Number.isNaN(h)) return null
  const slotM = Math.floor(((h || 0) * 60 + (m || 0)) / slotMinutes) * slotMinutes
  return `${String(Math.floor(slotM / 60)).padStart(2, "0")}:${String(slotM % 60).padStart(2, "0")}`
}
