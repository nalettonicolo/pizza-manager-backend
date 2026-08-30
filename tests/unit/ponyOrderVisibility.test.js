import { describe, expect, it } from "vitest"
import { ordineVisibileAlPony } from "@/features/operative/delivery/utils/ponyOrderVisibility"

describe("ordineVisibileAlPony", () => {
  it("mostra le consegne ancora libere", () => {
    expect(ordineVisibileAlPony({ stato_consegna: "" }, { riderId: "me" })).toBe(true)
  })

  it("nasconde le consegne di un altro pony", () => {
    expect(
      ordineVisibileAlPony({ stato_consegna: "IN_VIAGGIO", rider_id: "altro" }, { riderId: "me" }),
    ).toBe(false)
  })

  it("lascia visibile la consegna che ho preso io", () => {
    expect(
      ordineVisibileAlPony({ stato_consegna: "IN_VIAGGIO", rider_id: "me" }, { riderId: "me" }),
    ).toBe(true)
  })

  it("non mostra le già consegnate", () => {
    expect(ordineVisibileAlPony({ stato_consegna: "CONSEGNATO", rider_id: "me" }, { riderId: "me" })).toBe(false)
  })
})
