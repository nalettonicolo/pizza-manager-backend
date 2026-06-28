import { describe, expect, it } from "vitest"
import {
  ordineToSlotKey,
  orarioRitiroToSlotKey,
  PLANNING_GRID_SLOT_MINUTES,
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
})
