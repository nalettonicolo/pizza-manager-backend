import { describe, it, expect } from "vitest"
import {
  deliveryIndirizzoRiga,
  indirizzoConsegnaMatchAnagrafica,
  buildOrdineCardTitleModel,
  orarioVisualizzatoLista,
  formatOrarioFallbackDaCreazione,
} from "@/features/operative/cassa/utils/cassaDeliveryDisplay"

describe("cassaDeliveryDisplay", () => {
  it("deliveryIndirizzoRiga usa solo la parte indirizzo da Nome – Via", () => {
    const line = deliveryIndirizzoRiga({
      indirizzo_consegna: "Mario Rossi - Via Roma 1",
    })
    expect(line.toLowerCase()).toContain("via roma")
    expect(line.toLowerCase()).not.toContain("mario")
  })

  it("indirizzoConsegnaMatchAnagrafica confronta case-insensitive", () => {
    expect(indirizzoConsegnaMatchAnagrafica("Via Roma 1", "via roma 1")).toBe(true)
    expect(indirizzoConsegnaMatchAnagrafica("Via Roma 1", "Via Milano 2")).toBe(false)
  })

  it("buildOrdineCardTitleModel delivery preferisce nome_cliente", () => {
    const m = buildOrdineCardTitleModel(
      {
        nome_cliente: "Luca",
        indirizzo_consegna: "Via Roma 1",
        orario_ritiro: "20:30",
      },
      true,
    )
    expect(m.titoloPrincipale).toBe("Luca")
    expect(m.showOrarioADestra).toBe(true)
    expect(m.orario).toBe("20:30")
  })

  it("buildOrdineCardTitleModel delivery ricava nome dallo split legacy", () => {
    const m = buildOrdineCardTitleModel(
      {
        indirizzo_consegna: "Anna – Via Verdi 3",
        orario_ritiro: "19:00",
      },
      true,
    )
    expect(m.nome).toBe("Anna")
    expect(m.titoloPrincipale).toBe("Anna")
  })

  it("orarioVisualizzatoLista cade su createdAt se manca orario_ritiro", () => {
    const o = { created_at: "2026-08-04T18:45:00.000Z" }
    expect(formatOrarioFallbackDaCreazione(o)).toMatch(/^\d{2}:\d{2}$/)
    expect(orarioVisualizzatoLista(o)).toMatch(/^\d{2}:\d{2}$/)
  })
})
