import { describe, expect, it } from "vitest"
import {
  parseRiderPonySlot,
  riderPonySlotColor,
  riderPonySlotLabel,
} from "@/features/operative/delivery/utils/riderPonySlot"
import { QA_PRESETS } from "@/features/superadmin/pages/SuperadminQaConsolePage"

describe("riderPonySlot", () => {
  it("riconosce Pony 1 e Pony 2 da rider e pony", () => {
    expect(parseRiderPonySlot("/operative/rider/1")).toBe(1)
    expect(parseRiderPonySlot("/operative/rider/2")).toBe(2)
    expect(parseRiderPonySlot("/operative/pony/1")).toBe(1)
    expect(parseRiderPonySlot("/operative/pony/2")).toBe(2)
    expect(parseRiderPonySlot("/operative/rider")).toBeNull()
    expect(parseRiderPonySlot("/operative/rider/3")).toBeNull()
  })

  it("etichetta e colori distinti", () => {
    expect(riderPonySlotLabel(1)).toBe("Pony 1")
    expect(riderPonySlotLabel(2)).toBe("Pony 2")
    expect(riderPonySlotColor(1)).not.toBe(riderPonySlotColor(2))
  })
})

describe("QA_PRESETS pony", () => {
  it("Sala QA ha Pony 1 e Pony 2 nei preset operativo e mix", () => {
    for (const key of ["operativo", "mix"]) {
      const paths = QA_PRESETS[key].panels.map((p) => p.path)
      expect(paths).toContain("/operative/rider/1")
      expect(paths).toContain("/operative/rider/2")
      expect(QA_PRESETS[key].panels.find((p) => p.path === "/operative/rider/1")?.label).toBe("Pony 1")
      expect(QA_PRESETS[key].panels.find((p) => p.path === "/operative/rider/2")?.label).toBe("Pony 2")
    }
  })
})
