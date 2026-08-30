import { describe, expect, it } from "vitest"
import {
  classifyConsegnaPagamento,
  groupConsegneByPony,
} from "@/features/operative/cassa/utils/cassaDeliveryIncassi"

describe("cassaDeliveryIncassi", () => {
  it("classifica contanti, bancomat e già pagato", () => {
    expect(classifyConsegnaPagamento("Contanti")).toBe("contanti")
    expect(classifyConsegnaPagamento("Carta")).toBe("bancomat")
    expect(classifyConsegnaPagamento("Bancomat")).toBe("bancomat")
    expect(classifyConsegnaPagamento("Paga online")).toBe("gia_pagato")
    expect(classifyConsegnaPagamento("Stripe")).toBe("gia_pagato")
  })

  it("raggruppa per pony e somma i totali", () => {
    const groups = groupConsegneByPony([
      { rider_id: "a", rider_nome: "Marco", tipo_pagamento: "Contanti", totale: 10, numero: 1 },
      { rider_id: "a", rider_nome: "Marco", tipo_pagamento: "Carta", totale: 20, numero: 2 },
      { rider_id: "b", rider_nome: "Luca", tipo_pagamento: "Paga online", totale: 15, numero: 3 },
    ])
    expect(groups).toHaveLength(2)
    const marco = groups.find((g) => g.nome === "Marco")
    expect(marco.totals.contanti).toBe(10)
    expect(marco.totals.bancomat).toBe(20)
    expect(marco.totals.count).toBe(2)
    const luca = groups.find((g) => g.nome === "Luca")
    expect(luca.totals.gia_pagato).toBe(15)
  })

  it("mette le consegne senza pony in Non assegnato", () => {
    const groups = groupConsegneByPony([
      { rider_id: null, rider_nome: null, tipo_pagamento: "Contanti", totale: 8, numero: 80 },
    ])
    expect(groups).toHaveLength(1)
    expect(groups[0].riderId).toBeNull()
    expect(groups[0].label).toBe("Non assegnato")
  })

  it("tiene separati due nomi di sessione anche sullo stesso rider", () => {
    const groups = groupConsegneByPony([
      { rider_id: "same", rider_nome: "Alessandro", nome_pony: "Alessandro", tipo_pagamento: "Contanti", totale: 10, numero: 1 },
      { rider_id: "same", rider_nome: "1", nome_pony: "1", tipo_pagamento: "Contanti", totale: 8, numero: 2 },
    ])
    expect(groups).toHaveLength(2)
    expect(groups.map((g) => g.nome).sort()).toEqual(["1", "Alessandro"])
  })

  it("non sposta un ordine senza nome di sessione quando il rider cambia nome", () => {
    const groups = groupConsegneByPony([
      { rider_id: "same", rider_nome: "Alessandro", nome_pony: "Alessandro", tipo_pagamento: "Contanti", totale: 10, numero: 84 },
      { rider_id: "same", rider_nome: "Alessandro", nome_pony: null, tipo_pagamento: "Contanti", totale: 8, numero: 80 },
    ])
    expect(groups).toHaveLength(2)
    expect(groups.find((g) => g.nome === "Alessandro").ordini.map((o) => o.numero)).toEqual([84])
    expect(groups.find((g) => g.ordini.some((o) => o.numero === 80)).ordini).toHaveLength(1)
  })
})
