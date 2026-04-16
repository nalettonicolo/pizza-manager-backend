import { describe, it, expect } from "vitest"
import { productMatchesMenuSearch } from "@/utils/menuProductSearch"

describe("productMatchesMenuSearch", () => {
  it("match su nome e descrizione", () => {
    expect(productMatchesMenuSearch({ nome: "Margherita" }, "marg", [])).toBe(true)
    expect(productMatchesMenuSearch({ nome: "X", descrizione: "pomodoro fresco" }, "pomod", [])).toBe(true)
  })

  it("match su nome ingrediente in ricetta", () => {
    expect(
      productMatchesMenuSearch({ nome: "Capricciosa" }, "funghi", ["pomodoro", "funghi", "prosciutto"]),
    ).toBe(true)
  })

  it("nessun match", () => {
    expect(productMatchesMenuSearch({ nome: "Marinara" }, "funghi", ["pomodoro", "aglio"])).toBe(false)
  })

  it("query vuota = tutti", () => {
    expect(productMatchesMenuSearch({ nome: "A" }, "", [])).toBe(true)
  })
})
