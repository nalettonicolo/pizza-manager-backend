import { describe, it, expect } from "vitest"
import {
  isBanconeDeliveryOrder,
  banconeHandoffLabel,
  banconeHandoffTitle,
} from "@/features/operative/bancone/utils/banconeHandoffLabel"

describe("banconeHandoffLabel", () => {
  it("negozio: Consegnato", () => {
    const o = { tipo_ordine: "negozio" }
    expect(isBanconeDeliveryOrder(o)).toBe(false)
    expect(banconeHandoffLabel(o)).toBe("Consegnato")
    expect(banconeHandoffTitle(o)).toBe("Segna come consegnato")
  })

  it("domicilio: In consegna", () => {
    const o = { tipo_ordine: "delivery", indirizzo_consegna: "Via Pontedera 4" }
    expect(isBanconeDeliveryOrder(o)).toBe(true)
    expect(banconeHandoffLabel(o)).toBe("In consegna")
    expect(banconeHandoffTitle(o)).toBe("Segna come in consegna")
  })

  it("tipoOrdine camelCase delivery", () => {
    expect(banconeHandoffLabel({ tipoOrdine: "DELIVERY" })).toBe("In consegna")
  })

  it("con indirizzo e senza tipo: domicilio", () => {
    expect(isBanconeDeliveryOrder({ indirizzo_consegna: "Via Roma 1" })).toBe(true)
    expect(banconeHandoffLabel({ indirizzoConsegna: "Via Roma 1" })).toBe("In consegna")
  })

  it("ritardo: mostra i minuti anche sul domicilio", () => {
    const o = { tipo_ordine: "delivery" }
    expect(banconeHandoffLabel(o, 8)).toBe("8 min in attesa")
    expect(banconeHandoffTitle(o, 8)).toBe("8 min in attesa")
  })
})
