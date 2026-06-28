import { PLANNING_GRID_SLOT_MINUTES } from "./planningUtils"

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

export function isSlotFull(slotKey, slotCarico, cartPizze, maxPerSlot) {
  if (!maxPerSlot || maxPerSlot <= 0) return false
  return slotCaricoValue(slotCarico, slotKey) + cartPizze > maxPerSlot
}

export function filterSlotsExcludingFull(slots, slotCarico, cartPizze, maxPerSlot) {
  return (slots || []).filter((s) => !isSlotFull(s.key, slotCarico, cartPizze, maxPerSlot))
}
