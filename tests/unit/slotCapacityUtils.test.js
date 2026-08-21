import { describe, expect, it } from "vitest"
import {
  CASSA_SLOT_GRACE_AFTER_START_MIN,
  filterSlotsExcludingFull,
  filterSlotsExcludingPast,
  isCassaSlotLocked,
  isSlotFull,
  isSlotPast,
} from "@/features/operative/cassa/utils/slotCapacityUtils"

function slotAt(h, m) {
  const d = new Date(2026, 7, 20, h, m, 0, 0)
  return { key: d.getTime(), date: d, label: `${h}:${String(m).padStart(2, "0")}` }
}

describe("slotCapacityUtils online/cassa", () => {
  it("nasconde fasce piene per ordine online", () => {
    const slots = [slotAt(19, 30), slotAt(19, 45)]
    const carico = { [slots[0].key]: 8 }
    const out = filterSlotsExcludingFull(slots, carico, 4, 8)
    expect(out.map((s) => s.label)).toEqual(["19:45"])
  })

  it("isSlotFull false se carico+carrello entra esatto", () => {
    expect(isSlotFull("k", { k: 4 }, 4, 8)).toBe(false)
    expect(isSlotFull("k", { k: 5 }, 4, 8)).toBe(true)
  })

  it("elimina fasce già passate", () => {
    const now = new Date(2026, 7, 20, 19, 20, 0, 0)
    const slots = [slotAt(19, 0), slotAt(19, 15), slotAt(19, 30)]
    expect(filterSlotsExcludingPast(slots, now).map((s) => s.label)).toEqual(["19:30"])
    expect(isSlotPast(slots[0], now)).toBe(true)
  })

  it("cassa: dopo 30 min dall’inizio fascia è locked", () => {
    const slot = slotAt(19, 0)
    const at1915 = new Date(2026, 7, 20, 19, 15, 0, 0)
    const at1930 = new Date(2026, 7, 20, 19, 30, 0, 0)
    expect(isCassaSlotLocked(slot, at1915, CASSA_SLOT_GRACE_AFTER_START_MIN)).toBe(false)
    expect(isCassaSlotLocked(slot, at1930, CASSA_SLOT_GRACE_AFTER_START_MIN)).toBe(true)
  })
})
