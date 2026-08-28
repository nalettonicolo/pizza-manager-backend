import { describe, expect, it } from "vitest"
import { banconeSlotsWithPrepItems } from "@/features/operative/bancone/utils/banconeSlotPick"

describe("banconeSlotsWithPrepItems", () => {
  it("nasconde fasce senza ingredienti né bibite", () => {
    const slots = banconeSlotsWithPrepItems(
      { "21:30": [], "22:15": [{ pickKey: "ing:22:15:mais", label: "Mais", count: 1 }] },
      { "21:30": [] },
    )
    expect(slots).toEqual(["22:15"])
  })

  it("include fascia se ci sono solo bibite", () => {
    const slots = banconeSlotsWithPrepItems({ "21:30": [] }, { "21:30": [{ pickKey: "bib:1", label: "Coca", count: 1 }] })
    expect(slots).toEqual(["21:30"])
  })
})
