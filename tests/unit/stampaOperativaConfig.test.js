import { describe, it, expect } from "vitest"
import {
  readStampaModalita,
  readStampaQuando,
  canRepartoStampareRicevutaCortesia,
  readComandaCopie,
} from "@/utils/stampaOperativaConfig"

describe("stampaOperativaConfig", () => {
  it("default solo_cassa e quando legacy da boolean", () => {
    expect(readStampaModalita({})).toBe("solo_cassa")
    expect(readStampaQuando({ comanda_stampa_auto: true }, "comanda")).toBe("auto")
    expect(readStampaQuando({ comanda_stampa_auto: false }, "comanda")).toBe("manuale")
  })

  it("cortesia solo con_tablet e reparto matching", () => {
    const po = {
      stampa_modalita: "con_tablet",
      stampa_ricevuta_cortesia_reparto: "delivery",
    }
    expect(canRepartoStampareRicevutaCortesia(po, "delivery")).toBe(true)
    expect(canRepartoStampareRicevutaCortesia(po, "bancone")).toBe(false)
    expect(canRepartoStampareRicevutaCortesia({ ...po, stampa_modalita: "solo_cassa" }, "delivery")).toBe(
      false,
    )
  })

  it("comanda_copie clamp", () => {
    expect(readComandaCopie({ comanda_copie: 3 })).toBe(3)
    expect(readComandaCopie({ comanda_copie: 99 })).toBe(5)
    expect(readComandaCopie({})).toBe(1)
  })
})
