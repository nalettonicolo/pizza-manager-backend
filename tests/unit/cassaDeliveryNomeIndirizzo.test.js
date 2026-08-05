import { describe, it, expect } from "vitest"
import { splitNomeDaIndirizzoConsegna } from "@/features/operative/cassa/utils/cassaDeliveryNomeIndirizzo"

describe("splitNomeDaIndirizzoConsegna", () => {
  it("restituisce vuoto su input vuoto", () => {
    expect(splitNomeDaIndirizzoConsegna("")).toEqual({ nomePart: "", addrPart: "", full: "" })
    expect(splitNomeDaIndirizzoConsegna(null)).toEqual({ nomePart: "", addrPart: "", full: "" })
  })

  it("splitta Nome – Via con trattino normale", () => {
    expect(splitNomeDaIndirizzoConsegna("Mario Rossi - Via Roma 1")).toEqual({
      nomePart: "Mario Rossi",
      addrPart: "Via Roma 1",
      full: "Mario Rossi - Via Roma 1",
    })
  })

  it("splitta con en-dash Unicode", () => {
    expect(splitNomeDaIndirizzoConsegna("Anna Bianchi \u2013 Viale Verdi 12")).toEqual({
      nomePart: "Anna Bianchi",
      addrPart: "Viale Verdi 12",
      full: "Anna Bianchi \u2013 Viale Verdi 12",
    })
  })

  it("non splitta se la parte sinistra sembra già un indirizzo", () => {
    expect(splitNomeDaIndirizzoConsegna("Via Garibaldi 5 - interno 2")).toEqual({
      nomePart: "",
      addrPart: "",
      full: "Via Garibaldi 5 - interno 2",
    })
  })

  it("non splitta se manca il trattino", () => {
    expect(splitNomeDaIndirizzoConsegna("Solo indirizzo Via Roma 1")).toEqual({
      nomePart: "",
      addrPart: "",
      full: "Solo indirizzo Via Roma 1",
    })
  })

  it("non splitta se il nome è troppo lungo", () => {
    const longName = "A".repeat(53)
    const raw = `${longName} - Via Roma 1`
    expect(splitNomeDaIndirizzoConsegna(raw)).toEqual({
      nomePart: "",
      addrPart: "",
      full: raw,
    })
  })

  it("normalizza spazi e NBSP", () => {
    expect(splitNomeDaIndirizzoConsegna("Mario\u00a0Rossi   -   Via Roma 1")).toEqual({
      nomePart: "Mario Rossi",
      addrPart: "Via Roma 1",
      full: "Mario Rossi - Via Roma 1",
    })
  })
})
