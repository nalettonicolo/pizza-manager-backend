import { describe, expect, it } from "vitest"
import {
  assignDeliveriesToPonies,
  baulettoCapFromParametri,
  combineWindowFromParametri,
  ordersWithinCombineWindow,
  DEFAULT_BAULETTO_CAP,
} from "@/features/operative/cassa/utils/planningPonyAssign"

describe("baulettoCapFromParametri", () => {
  it("usa 12 di default", () => {
    expect(DEFAULT_BAULETTO_CAP).toBe(12)
    expect(baulettoCapFromParametri({})).toBe(12)
  })

  it("legge capienza_bauletto", () => {
    expect(baulettoCapFromParametri({ capienza_bauletto: 12 })).toBe(12)
  })
})

describe("tempi stabiliti (combine window)", () => {
  it("stesso orario = combinabili", () => {
    expect(
      ordersWithinCombineWindow(
        [{ orario_ritiro: "12:45" }, { orario_ritiro: "12:45" }],
        15,
      ),
    ).toBe(true)
  })

  it("orari oltre la finestra = non combinabili", () => {
    expect(
      ordersWithinCombineWindow(
        [{ orario_ritiro: "12:00" }, { orario_ritiro: "12:45" }],
        15,
      ),
    ).toBe(false)
  })

  it("consegne_ogni_min da parametri", () => {
    expect(combineWindowFromParametri({ consegne_ogni_min: 15 })).toBe(15)
  })
})

describe("assignDeliveriesToPonies — bauletto + tempi", () => {
  it("12:45 stesso civico: B pieno 12, A porta 4+5 (tempi OK)", () => {
    const orders = [
      {
        id: "small",
        indirizzo_consegna: "Via Pontedera 4, Padova 35124",
        orario_ritiro: "12:45",
        created_at: "2026-08-23T10:00:00Z",
      },
      {
        id: "big",
        indirizzo_consegna: "Via Pontedera 4, Padova 35124",
        orario_ritiro: "12:45",
        created_at: "2026-08-23T10:01:00Z",
      },
    ]
    const rows = assignDeliveriesToPonies(orders, 2, {}, {
      pizzePerOrdine: { small: 4, big: 17 },
      baulettoCap: 12,
      combineWindowMin: 15,
    })

    const onB = rows.filter((r) => r.ponyLetter === "B")
    const onA = rows.filter((r) => r.ponyLetter === "A")
    const pzB = onB.reduce((s, r) => s + Number(r.pzShare || 0), 0)
    const pzA = onA.reduce((s, r) => s + Number(r.pzShare || 0), 0)

    expect(pzB).toBe(12)
    expect(pzA).toBe(9) // 4 + 5
    expect(onB.some((r) => r.ordine.id === "big" && r.pzShare === 12)).toBe(true)
    expect(onA.some((r) => r.ordine.id === "big" && r.pzShare === 5)).toBe(true)
    expect(onA.some((r) => r.ordine.id === "small" && r.pzShare === 4)).toBe(true)
  })

  it("ordine piccolo fuori tempi: NON auto-assegnato; solo split del grosso", () => {
    const orders = [
      {
        id: "small",
        indirizzo_consegna: "Via Pontedera 4",
        orario_ritiro: "12:00",
        created_at: "2026-08-23T10:00:00Z",
      },
      {
        id: "big",
        indirizzo_consegna: "Via Pontedera 4",
        orario_ritiro: "12:45",
        created_at: "2026-08-23T10:01:00Z",
      },
    ]
    const rows = assignDeliveriesToPonies(orders, 2, {}, {
      pizzePerOrdine: { small: 4, big: 17 },
      baulettoCap: 12,
      combineWindowMin: 15,
    })

    expect(rows.every((r) => r.ordine.id !== "small")).toBe(true)
    const pzBig = rows
      .filter((r) => r.ordine.id === "big")
      .reduce((s, r) => s + Number(r.pzShare || 0), 0)
    expect(pzBig).toBe(17)
    expect(rows.some((r) => r.ponyLetter === "B" && r.pzShare === 12)).toBe(true)
  })

  it("ordine piccolo da solo (nessun grosso) resta auto-assegnato", () => {
    const orders = [
      {
        id: "solo",
        indirizzo_consegna: "Via X 1",
        orario_ritiro: "19:00",
        created_at: "2026-08-23T10:00:00Z",
      },
    ]
    const rows = assignDeliveriesToPonies(orders, 2, {}, {
      pizzePerOrdine: { solo: 4 },
      baulettoCap: 12,
      combineWindowMin: 15,
    })
    expect(rows).toHaveLength(1)
    expect(rows[0].ordine.id).toBe("solo")
    expect(rows[0].pzShare).toBe(4)
  })
})
