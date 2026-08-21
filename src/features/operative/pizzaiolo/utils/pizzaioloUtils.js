/**
 * Utility per la vista Pizzaioli: filtra ordini X minuti prima dell'orario, ordinamento, ritardo.
 */

/** Default: pizze pronte 10′ prima dell’orario consegna (es. 19:15 → entro 19:05). */
export const DEFAULT_LEAD_TIME_CONSEGNA_MIN = 10

/** Converte "HH:mm" in minuti da mezzanotte (oggi). */
export function orarioToMinutes(orarioStr) {
  if (!orarioStr || typeof orarioStr !== "string") return null
  const [h, m] = orarioStr.trim().split(":").map(Number)
  if (h == null || isNaN(h)) return null
  return (h || 0) * 60 + (m || 0)
}

/** Formatta minuti da mezzanotte → "HH:mm". */
export function minutesToOrario(totalMin) {
  const t = ((Math.floor(Number(totalMin)) % (24 * 60)) + 24 * 60) % (24 * 60)
  const h = Math.floor(t / 60)
  const m = t % 60
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
}

/**
 * Minuti prima dell’orario cliente entro cui le pizze delivery devono essere pronte.
 * Preferisce `pizzaiolo_tempo_viaggio_minuti`, poi `pizzaiolo_partenza_consegne_minuti`, default 10.
 * @param {Record<string, unknown>} [parametriOperativi]
 * @returns {number}
 */
export function readPizzaioloLeadTimeConsegnaMin(parametriOperativi) {
  const po = parametriOperativi && typeof parametriOperativi === "object" ? parametriOperativi : {}
  const rawV = po.pizzaiolo_tempo_viaggio_minuti
  const hasV = rawV !== undefined && rawV !== null && String(rawV).trim() !== ""
  const viaggio = Number(rawV)
  if (hasV && Number.isFinite(viaggio) && viaggio > 0) {
    return Math.min(120, Math.max(1, Math.floor(viaggio)))
  }
  const rawP = po.pizzaiolo_partenza_consegne_minuti
  const hasP = rawP !== undefined && rawP !== null && String(rawP).trim() !== ""
  const partenza = Number(rawP)
  if (hasP && Number.isFinite(partenza) && partenza > 0) {
    // Default legacy 30′ faceva partire il “ritardo” troppo presto rispetto al viaggio reale (~10′).
    if (partenza === 30) return DEFAULT_LEAD_TIME_CONSEGNA_MIN
    return Math.min(120, Math.max(1, Math.floor(partenza)))
  }
  return DEFAULT_LEAD_TIME_CONSEGNA_MIN
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
 * Scadenza “pizze pronte” in minuti da mezzanotte.
 * Negozio = orario cliente. Consegna = orario − lead time viaggio.
 */
export function kitchenDeadlineMinutes(ordine, leadTimeConsegnaMin = DEFAULT_LEAD_TIME_CONSEGNA_MIN) {
  const orario = ordine.orario_ritiro ?? ordine.orarioRitiro
  const min = orarioToMinutes(orario)
  if (min == null) return null
  const isDelivery = (ordine.tipo_ordine || "").toLowerCase() === "delivery"
  const lead = Math.max(0, Number(leadTimeConsegnaMin) || 0)
  return isDelivery ? min - lead : min
}

/**
 * Calcola minuti di ritardo per un ordine.
 * Negozio: ritardo se now > orario_ritiro.
 * Consegna: ritardo se now > (orario_ritiro − leadTime). Es. 19:15 con lead 10 → ritardo solo dopo le 19:05.
 * @returns { number } minuti di ritardo (0 se in orario)
 */
export function getRitardoMinuti(ordine, leadTimeConsegnaMin = DEFAULT_LEAD_TIME_CONSEGNA_MIN) {
  const deadline = kitchenDeadlineMinutes(ordine, leadTimeConsegnaMin)
  if (deadline == null) return 0
  const now = nowMinutes()
  if (now <= deadline) return 0
  return now - deadline
}

/**
 * Raggruppa per fascia forno e conta pizze.
 * Delivery: conteggio sullo slot di preparazione (orario − lead), non sull’orario a casa.
 * @returns {{ [orarioLabel: string]: number }}
 */
export function slotPizzeCount(
  ordini,
  pizzePerOrdine,
  slotMinutes = 15,
  leadTimeConsegnaMin = DEFAULT_LEAD_TIME_CONSEGNA_MIN,
) {
  const map = {}
  const lead = Math.max(0, Number(leadTimeConsegnaMin) || 0)
  for (const o of ordini || []) {
    const orario = o.orario_ritiro ?? o.orarioRitiro
    if (!orario) continue
    const [h, m] = String(orario).trim().split(":").map(Number)
    let totalMin = (h || 0) * 60 + (m || 0)
    const isDelivery = (o.tipo_ordine || "").toLowerCase() === "delivery"
    if (isDelivery) totalMin -= lead
    if (totalMin < 0) totalMin = 0
    const slotM = Math.floor(totalMin / slotMinutes) * slotMinutes
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
