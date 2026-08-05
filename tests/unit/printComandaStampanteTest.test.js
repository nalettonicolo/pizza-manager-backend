import { describe, it, expect } from "vitest"
import { buildStampanteRepartoTestPayload } from "@/features/operative/cassa/utils/printComanda"

describe("buildStampanteRepartoTestPayload", () => {
  it("include destinazione USB e riga di prova", () => {
    const p = buildStampanteRepartoTestPayload(
      {
        id: "1",
        nome: "Cassa",
        tipo_connessione: "usb",
        nome_dispositivo: "POS-58",
        indirizzo_ip: "",
        porta: 9100,
      },
      "Francy Pizza",
    )
    expect(p.tenantNome).toBe("Francy Pizza")
    expect(p.numero).toBe("TEST")
    expect(p.destStampaOverride).toContain("POS-58")
    expect(p.destStampaOverride).toContain("Cassa")
    expect(p.righe).toHaveLength(1)
    expect(p.parametri.comanda_rotolo_mm).toBe(58)
  })
})
