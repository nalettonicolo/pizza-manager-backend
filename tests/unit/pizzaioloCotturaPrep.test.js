import { describe, expect, it } from "vitest"
import {
  filterTasksBySlotForPizzaiolo,
  isPizzaioloCotturaPrepTask,
} from "@/features/operative/cucina/utils/cucinaPrepTasks"

describe("isPizzaioloCotturaPrepTask", () => {
  it("tiene extra e ingredienti da forno", () => {
    expect(isPizzaioloCotturaPrepTask({ kind: "ingrediente", ingredienteCategoria: "congelato" })).toBe(true)
    expect(isPizzaioloCotturaPrepTask({ kind: "extra", categoria: "affettato" })).toBe(true)
    expect(isPizzaioloCotturaPrepTask({ kind: "ingrediente", categoria: "" })).toBe(true)
  })

  it("nasconde prodotti interi e categorie non da forno", () => {
    expect(isPizzaioloCotturaPrepTask({ kind: "prodotto", ingredienteCategoria: "bibita" })).toBe(false)
    expect(isPizzaioloCotturaPrepTask({ kind: "prodotto", categoria: "fritto" })).toBe(false)
    expect(isPizzaioloCotturaPrepTask({ kind: "ingrediente", categoria: "bibita" })).toBe(false)
    expect(isPizzaioloCotturaPrepTask({ kind: "ingrediente", categoria: "fritto" })).toBe(false)
    expect(isPizzaioloCotturaPrepTask({ kind: "ingrediente", categoria: "dolce" })).toBe(false)
    expect(isPizzaioloCotturaPrepTask(null)).toBe(false)
  })
})

describe("filterTasksBySlotForPizzaiolo", () => {
  it("toglie Coca Cola e fritti, lascia extra da pizza", () => {
    const filtered = filterTasksBySlotForPizzaiolo({
      "20:30": [
        { kind: "prodotto", ingredienteCategoria: "bibita", ingredienteNome: "Coca Cola Latt 33cl" },
        { kind: "prodotto", categoria: "fritto", ingredienteNome: "Patatine fritte" },
        { kind: "extra", categoria: "affettato", ingredienteNome: "Stracchino" },
      ],
    })
    expect(filtered["20:30"]).toHaveLength(1)
    expect(filtered["20:30"][0].ingredienteNome).toBe("Stracchino")
  })
})
