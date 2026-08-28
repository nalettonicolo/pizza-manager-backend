import { describe, expect, it } from "vitest"
import {
  buildCucinaPrepTasks,
  filterPrepTasksForPizzaiolo,
  pizzaioloShouldSeePrepTask,
  sortedCucinaSlotTabs,
} from "@/features/operative/cucina/utils/cucinaPrepTasks"

describe("cucinaPrepTasks slot vuoti e pizzaiolo", () => {
  it("non crea fasce orarie se l'ordine non ha prep cucina/bancone", () => {
    const orders = [{ id: "o1", orario_ritiro: "21:30", numero: 1 }]
    const righe = [{ id: "r1", ordineId: "o1", prodottoId: "p1", quantita: 1 }]
    const byProduct = {
      p1: [{ id: "i1", nome: "Mozzarella", prepCucina: false, vaInCottura: true, categoria: "" }],
    }
    const tasks = buildCucinaPrepTasks(orders, righe, { p1: "Margherita" }, byProduct, 15)
    expect(Object.keys(tasks)).toEqual([])
    expect(sortedCucinaSlotTabs(tasks)).toEqual([])
  })

  it("crea la fascia solo se c'è un ingrediente da preparare", () => {
    const orders = [{ id: "o1", orario_ritiro: "21:30", numero: 1 }]
    const righe = [{ id: "r1", ordineId: "o1", prodottoId: "p1", quantita: 1 }]
    const byProduct = {
      p1: [{ id: "i1", nome: "Mais", prepCucina: true, vaInCottura: true, categoria: "" }],
    }
    const tasks = buildCucinaPrepTasks(orders, righe, { p1: "Mais" }, byProduct, 15)
    const keys = Object.keys(tasks)
    expect(keys.length).toBe(1)
    expect(tasks[keys[0]].some((t) => t.ingredienteNome === "Mais")).toBe(true)
  })

  it("pizzaiolo vede prep in cottura, non fritti prodotto né fine cottura", () => {
    expect(
      pizzaioloShouldSeePrepTask({
        kind: "ingrediente",
        vaInCottura: true,
        ingredienteCategoria: "",
        ingredienteNome: "Mais",
      }),
    ).toBe(true)
    expect(
      pizzaioloShouldSeePrepTask({
        kind: "prodotto",
        vaInCottura: false,
        ingredienteCategoria: "fritto",
        ingredienteNome: "Patatine fritte",
      }),
    ).toBe(false)
    expect(
      pizzaioloShouldSeePrepTask({
        kind: "ingrediente",
        vaInCottura: false,
        ingredienteCategoria: "",
        ingredienteNome: "Rucola",
      }),
    ).toBe(false)

    const filtered = filterPrepTasksForPizzaiolo({
      "21:30": [
        { kind: "ingrediente", vaInCottura: true, ingredienteCategoria: "", ingredienteNome: "Mais" },
        { kind: "prodotto", vaInCottura: false, ingredienteCategoria: "fritto", ingredienteNome: "Patatine" },
      ],
    })
    expect(filtered["21:30"].map((t) => t.ingredienteNome)).toEqual(["Mais"])
  })
})
