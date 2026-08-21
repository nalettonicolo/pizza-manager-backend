import { describe, expect, it } from "vitest"
import {
  listTipiPagamentoCassa,
  isOrdineOnlineCanale,
  TIPO_PAGAMENTO_PAGA_ONLINE,
} from "@/features/operative/cassa/utils/cassaPagamentiOptions"

describe("cassaPagamentiOptions", () => {
  it("cassa completa include Paga online e non Link legacy", () => {
    const tipi = listTipiPagamentoCassa({}, { ordineOnline: false })
    expect(tipi).toContain(TIPO_PAGAMENTO_PAGA_ONLINE)
    expect(tipi).toContain("Misto")
    expect(tipi.some((t) => t.toLowerCase().includes("link"))).toBe(false)
  })

  it("ordine online solo Contanti Carta Paga online se attivi", () => {
    const tipi = listTipiPagamentoCassa(
      {
        cassa_pagamento_contanti: true,
        cassa_pagamento_carta: true,
        cassa_pagamento_paga_online: true,
      },
      { ordineOnline: true },
    )
    expect(tipi).toEqual(["Contanti", "Carta", "Paga online"])
  })

  it("nasconde metodi disattivati dall’admin", () => {
    const tipi = listTipiPagamentoCassa(
      {
        cassa_pagamento_contanti: false,
        cassa_pagamento_carta: true,
        cassa_pagamento_paga_online: false,
      },
      { ordineOnline: true },
    )
    expect(tipi).toEqual(["Carta"])
  })

  it("riconosce ordine web dalle note", () => {
    expect(isOrdineOnlineCanale({ note: "Ordine web · consegna · pagamento contanti" })).toBe(true)
    expect(isOrdineOnlineCanale({ note: "Tavolo 3" })).toBe(false)
  })
})
