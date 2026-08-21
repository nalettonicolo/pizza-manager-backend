import { PLANNING_GRID_SLOT_MINUTES } from "./planningUtils"

/** Minuti dopo l’inizio fascia: in cassa lo slot resta visibile ma non più selezionabile. */
export const CASSA_SLOT_GRACE_AFTER_START_MIN = 30

/** Capacità forno per fascia (griglia 15 min, come in Cassa). */
export function maxPizzePerSlot(parametri) {
  const pizzeOgni15 = Number(parametri?.pizze_ogni_15_min) || 8
  return Math.max(1, Math.round((pizzeOgni15 * PLANNING_GRID_SLOT_MINUTES) / 15))
}

export function cartPizzeCount(items) {
  return (items || []).reduce((sum, p) => sum + Math.max(1, Number(p.qty) || 1), 0)
}

export function slotCaricoValue(slotCarico, slotKey) {
  if (!slotCarico || slotKey == null) return 0
  const k = String(slotKey)
  return Number(slotCarico[k] ?? slotCarico[slotKey] ?? 0) || 0
}

/** True se carico attuale + pizze carrello non entrano nella capacità (niente posto). */
export function isSlotFull(slotKey, slotCarico, cartPizze, maxPerSlot) {
  if (!maxPerSlot || maxPerSlot <= 0) return false
  const cart = Math.max(0, Number(cartPizze) || 0)
  return slotCaricoValue(slotCarico, slotKey) + cart > maxPerSlot
}

export function filterSlotsExcludingFull(slots, slotCarico, cartPizze, maxPerSlot) {
  return (slots || []).filter((s) => !isSlotFull(s.key, slotCarico, cartPizze, maxPerSlot))
}

export function slotStartDate(slot) {
  if (!slot) return null
  if (slot.date instanceof Date && !Number.isNaN(slot.date.getTime())) return slot.date
  if (slot.date != null) {
    const d = new Date(slot.date)
    if (!Number.isNaN(d.getTime())) return d
  }
  if (slot.key != null) {
    const d = new Date(Number(slot.key))
    if (!Number.isNaN(d.getTime())) return d
  }
  return null
}

/** Fascia già iniziata (orario slot < adesso). */
export function isSlotPast(slot, nowDate = new Date()) {
  const start = slotStartDate(slot)
  if (!start) return false
  const now = nowDate instanceof Date ? nowDate : new Date(nowDate)
  return start.getTime() < now.getTime()
}

/**
 * Cassa: oltre grace minuti dall’inizio fascia → non cliccabile (resta visibile in grigio).
 */
export function isCassaSlotLocked(slot, nowDate = new Date(), graceMin = CASSA_SLOT_GRACE_AFTER_START_MIN) {
  const start = slotStartDate(slot)
  if (!start) return false
  const now = nowDate instanceof Date ? nowDate : new Date(nowDate)
  const grace = Number.isFinite(graceMin) ? Math.max(0, graceMin) : CASSA_SLOT_GRACE_AFTER_START_MIN
  return now.getTime() >= start.getTime() + grace * 60 * 1000
}

/** Vetrina: nasconde fasce già passate. */
export function filterSlotsExcludingPast(slots, nowDate = new Date()) {
  return (slots || []).filter((s) => !isSlotPast(s, nowDate))
}
