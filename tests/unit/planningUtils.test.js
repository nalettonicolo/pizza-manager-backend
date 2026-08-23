import { describe, expect, it } from "vitest"
import {
  ordineToSlotKey,
  orarioRitiroToSlotKey,
  PLANNING_GRID_SLOT_MINUTES,
  filterSlotsWebDeliveryVetrinaQuarter,
  getTodayOrariConsegna,
  buildSlotsFullDay,
  getActivePlanningServizioBand,
} from "@/features/operative/cassa/utils/planningUtils"

describe("planningUtils slot keys", () => {
  it("orarioRitiroToSlotKey parses HH:mm", () => {
    const key = orarioRitiroToSlotKey("19:30", PLANNING_GRID_SLOT_MINUTES)
    const d = new Date(key)
    expect(d.getHours()).toBe(19)
    expect(d.getMinutes()).toBe(30)
  })

  it("ordineToSlotKey falls back to createdAt when orario_ritiro missing", () => {
    const created = new Date()
    created.setHours(20, 15, 0, 0)
    const key = ordineToSlotKey({ createdAt: created.toISOString() }, PLANNING_GRID_SLOT_MINUTES)
    const d = new Date(key)
    expect(d.getHours()).toBe(20)
    expect(d.getMinutes()).toBe(15)
  })

  it("ordineToSlotKey prefers orario_ritiro over createdAt", () => {
    const created = new Date()
    created.setHours(10, 0, 0, 0)
    const key = ordineToSlotKey(
      { orario_ritiro: "18:45", createdAt: created.toISOString() },
      PLANNING_GRID_SLOT_MINUTES,
    )
    const d = new Date(key)
    expect(d.getHours()).toBe(18)
    expect(d.getMinutes()).toBe(45)
  })

  it("filterSlotsWebDeliveryVetrinaQuarter uses slot hour not wall clock", () => {
    const nowMorning = new Date()
    nowMorning.setHours(10, 0, 0, 0)
    const slots = [
      { date: new Date(2000, 0, 1, 11, 45), key: "11:45" },
      { date: new Date(2000, 0, 1, 11, 15), key: "11:15" },
      { date: new Date(2000, 0, 1, 17, 0), key: "17:00" },
      { date: new Date(2000, 0, 1, 17, 45), key: "17:45" },
    ]
    const filtered = filterSlotsWebDeliveryVetrinaQuarter(slots, nowMorning, {})
    expect(filtered.map((s) => s.key)).toEqual(["11:45", "17:00", "17:45"])
  })

  it("getTodayOrariConsegna prefers fascia consegna quando diversa", () => {
    const jsDay = new Date().getDay()
    const giorno = (jsDay + 6) % 7
    const orari = Array.from({ length: 7 }, (_, i) => ({
      giorno: i,
      aperto: true,
      apertura: "11:00",
      chiusura: "23:00",
      consegnaDiversa: i === giorno,
      consegnaDa: "18:00",
      consegnaA: "22:00",
    }))
    const today = getTodayOrariConsegna(orari)
    expect(today.fonte).toBe("consegna")
    expect(today.apertura).toBe("18:00")
    expect(today.chiusura).toBe("22:00")
    const slots = buildSlotsFullDay(today)
    expect(slots.length).toBeGreaterThan(0)
    expect(slots[0].label).toMatch(/18:00/)
  })
})

describe("getActivePlanningServizioBand", () => {
  const dualFasce = [
    { apertura: "12:00", chiusura: "14:30" },
    { apertura: "18:00", chiusura: "23:00" },
  ]

  function at(h, m = 0) {
    const d = new Date()
    d.setHours(h, m, 0, 0)
    return d
  }

  it("returns null with single fascia", () => {
    expect(getActivePlanningServizioBand(at(13), [{ apertura: "11:00", chiusura: "23:00" }])).toBeNull()
  })

  it("returns pranzo during lunch hours", () => {
    expect(getActivePlanningServizioBand(at(13), dualFasce)).toBe("pranzo")
  })

  it("returns cena during dinner hours", () => {
    expect(getActivePlanningServizioBand(at(20), dualFasce)).toBe("cena")
  })

  it("returns cena in afternoon gap between services", () => {
    expect(getActivePlanningServizioBand(at(16), dualFasce)).toBe("cena")
  })

  it("returns pranzo before lunch opens", () => {
    expect(getActivePlanningServizioBand(at(10), dualFasce)).toBe("pranzo")
  })
})
