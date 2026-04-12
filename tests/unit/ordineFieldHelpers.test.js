import { describe, it, expect } from "vitest"
import {
  ordineTipoOrdine,
  ordineIsDelivery,
  ordineNomeCliente,
  ordineTelefonoRitiro,
  ordineIndirizzoConsegna,
  ordineOrarioRitiro,
} from "@/features/operative/cassa/utils/ordineFieldHelpers"

describe("ordineFieldHelpers", () => {
  it("ordineTipoOrdine normalizza snake e camel", () => {
    expect(ordineTipoOrdine({ tipo_ordine: "DELIVERY" })).toBe("delivery")
    expect(ordineTipoOrdine({ tipoOrdine: "negozio" })).toBe("negozio")
  })

  it("ordineIsDelivery", () => {
    expect(ordineIsDelivery({ tipo_ordine: "delivery" })).toBe(true)
    expect(ordineIsDelivery({ tipo_ordine: "negozio" })).toBe(false)
  })

  it("ordineNomeCliente preferisce nome_cliente", () => {
    expect(ordineNomeCliente({ nome_cliente: "  Mario  ", nome: "Altro" })).toBe("Mario")
  })

  it("ordineTelefonoRitiro e indirizzo e orario", () => {
    expect(ordineTelefonoRitiro({ telefonoRitiro: " 333 " })).toBe("333")
    expect(ordineIndirizzoConsegna({ indirizzoConsegna: "Via Roma 1" })).toBe("Via Roma 1")
    expect(ordineOrarioRitiro({ orario_ritiro: "19:00" })).toBe("19:00")
  })
})
