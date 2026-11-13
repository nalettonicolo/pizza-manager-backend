import { describe, expect, it } from "vitest"
import {
  CASSA_SLOT_GRACE_AFTER_START_MIN,
  filterSlotsExcludingFull,
  filterSlotsExcludingPast,
  isCassaSlotLocked,
  isSlotFull,
  isSlotPast,
  maxPizzePerSlot,
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

describe("maxPizzePerSlot (capacità forno)", () => {
  it("usa il valore impostato", () => {
    expect(maxPizzePerSlot({ pizze_ogni_15_min: 12 })).toBe(12)
    expect(maxPizzePerSlot({ pizze_ogni_15_min: "10" })).toBe(10)
  })

  // Il form Parametri salva "" come 0: in lato client 0 significa "non impostato" → default 8.
  // (Il SQL assert_slot_capacity_for_ordine invece con 0 usa il minimo 1: vedi report.)
  it("pizze_ogni_15_min = 0 (numero o testo) ricade sul default 8", () => {
    expect(maxPizzePerSlot({ pizze_ogni_15_min: 0 })).toBe(8)
    expect(maxPizzePerSlot({ pizze_ogni_15_min: "0" })).toBe(8)
  })

  it("valori mancanti o non numerici ricadono sul default 8", () => {
    expect(maxPizzePerSlot(undefined)).toBe(8)
    expect(maxPizzePerSlot(null)).toBe(8)
    expect(maxPizzePerSlot({})).toBe(8)
    expect(maxPizzePerSlot({ pizze_ogni_15_min: "" })).toBe(8)
    expect(maxPizzePerSlot({ pizze_ogni_15_min: "abc" })).toBe(8)
  })

  it("negativi e frazioni sotto 0,5 non scendono sotto 1", () => {
    expect(maxPizzePerSlot({ pizze_ogni_15_min: -3 })).toBe(1)
    expect(maxPizzePerSlot({ pizze_ogni_15_min: 0.4 })).toBe(1)
  })

  it("con capacità 0 passata direttamente a isSlotFull nessuna fascia risulta piena", () => {
    expect(isSlotFull("k", { k: 99 }, 4, 0)).toBe(false)
  })

  it("con pizze_ogni_15_min = 0 il filtro fasce usa 8, non zero", () => {
    const slots = [slotAt(19, 30), slotAt(19, 45)]
    const max = maxPizzePerSlot({ pizze_ogni_15_min: 0 })
    const carico = { [slots[0].key]: 5 }
    expect(filterSlotsExcludingFull(slots, carico, 4, max).map((s) => s.label)).toEqual(["19:45"])
    expect(filterSlotsExcludingFull(slots, carico, 3, max).map((s) => s.label)).toEqual(["19:30", "19:45"])
  })
})
