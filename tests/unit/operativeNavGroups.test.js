import { describe, it, expect } from "vitest"
import { groupOperativeNavItems, OPERATIVE_AREA_NAV } from "@/constants/operativeNav"

describe("groupOperativeNavItems", () => {
  it("raggruppa le voci operative in sezioni con label", () => {
    const groups = groupOperativeNavItems([...OPERATIVE_AREA_NAV])
    expect(groups.map((g) => g.id)).toEqual(["panoramica", "cassa", "reparti"])
    expect(groups.find((g) => g.id === "cassa")?.items.map((i) => i.label)).toContain("Cassa")
    expect(groups.find((g) => g.id === "reparti")?.items.map((i) => i.label)).toEqual([
      "Cucina",
      "Bancone",
      "Pizzaioli",
      "Delivery / Pony",
      "Pony (rider)",
    ])
  })

  it("omite gruppi senza voci filtrate", () => {
    const onlyCucina = OPERATIVE_AREA_NAV.filter((i) => i.to === "/operative/cucina")
    const groups = groupOperativeNavItems(onlyCucina)
    expect(groups).toHaveLength(1)
    expect(groups[0].id).toBe("reparti")
  })
})
