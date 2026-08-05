import { describe, it, expect } from "vitest"
import {
  normalizeComandaRepartiStampanti,
  validateRepartiStampantiForSave,
  formatRepartoStampanteDest,
  stampantiLabelDaReparti,
} from "@/utils/comandaRepartiStampanti"

describe("comandaRepartiStampanti", () => {
  it("normalizza legacy solo IP come connessione rete", () => {
    const list = normalizeComandaRepartiStampanti([
      { id: "1", nome: "Cucina", indirizzo_ip: "192.168.1.10", porta: 9100 },
    ])
    expect(list[0].tipo_connessione).toBe("ip")
    expect(list[0].indirizzo_ip).toBe("192.168.1.10")
    expect(list[0].nome_dispositivo).toBe("")
  })

  it("normalizza riga USB con nome dispositivo", () => {
    const list = normalizeComandaRepartiStampanti([
      { id: "2", nome: "Cassa", tipo_connessione: "usb", nome_dispositivo: "POS-58" },
    ])
    expect(list[0].tipo_connessione).toBe("usb")
    expect(list[0].nome_dispositivo).toBe("POS-58")
    expect(list[0].indirizzo_ip).toBe("")
  })

  it("validate richiede IP valido per rete e nome per USB", () => {
    expect(
      validateRepartiStampantiForSave([
        {
          id: "1",
          nome: "Cucina",
          tipo_connessione: "ip",
          indirizzo_ip: "bad",
          porta: 9100,
          nome_dispositivo: "",
        },
      ]).ok,
    ).toBe(false)
    expect(
      validateRepartiStampantiForSave([
        {
          id: "2",
          nome: "Cassa",
          tipo_connessione: "usb",
          indirizzo_ip: "",
          porta: 9100,
          nome_dispositivo: "",
        },
      ]).ok,
    ).toBe(false)
    expect(
      validateRepartiStampantiForSave([
        {
          id: "3",
          nome: "Cassa",
          tipo_connessione: "usb",
          indirizzo_ip: "",
          porta: 9100,
          nome_dispositivo: "POS-58",
        },
      ]).ok,
    ).toBe(true)
  })

  it("formatRepartoStampanteDest distingue USB e IP", () => {
    expect(
      formatRepartoStampanteDest({
        nome: "Cucina",
        tipo_connessione: "usb",
        nome_dispositivo: "POS-58",
        indirizzo_ip: "",
        porta: 9100,
      }),
    ).toContain("USB")
    expect(
      formatRepartoStampanteDest({
        nome: "Forno",
        tipo_connessione: "ip",
        nome_dispositivo: "",
        indirizzo_ip: "10.0.0.5",
        porta: 9100,
      }),
    ).toContain("10.0.0.5")
  })

  it("stampantiLabelDaReparti elenca USB e IP", () => {
    const label = stampantiLabelDaReparti({
      comanda_reparti_stampanti: [
        { nome: "Cassa", tipo_connessione: "usb", nome_dispositivo: "POS-58" },
        { nome: "Cucina", indirizzo_ip: "192.168.1.20", porta: 9100 },
      ],
    })
    expect(label).toContain("USB: POS-58")
    expect(label).toContain("192.168.1.20")
  })
})
