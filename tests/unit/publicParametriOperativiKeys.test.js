import { describe, it, expect } from "vitest"
import {
  PUBLIC_PARAMETRI_OPERATIVI_KEYS,
  PUBLIC_PARAMETRI_FORBIDDEN_KEYS,
  filterPublicParametriOperativi,
  assertPublicParametriSafe,
} from "@/constants/publicParametriOperativiKeys"

describe("publicParametriOperativiKeys", () => {
  it("whitelist contiene chiavi vetrina attese", () => {
    expect(PUBLIC_PARAMETRI_OPERATIVI_KEYS).toContain("ordini_online_attivi")
    expect(PUBLIC_PARAMETRI_OPERATIVI_KEYS).toContain("menuTheme")
    expect(PUBLIC_PARAMETRI_OPERATIVI_KEYS.length).toBeGreaterThanOrEqual(10)
  })

  it("filterPublicParametriOperativi rimuove chiavi operative", () => {
    const src = {
      ordini_online_attivi: true,
      menuTheme: "dark",
      leak_cassa: true,
      smtp_host: "smtp.example.com",
    }
    expect(filterPublicParametriOperativi(src)).toEqual({
      ordini_online_attivi: true,
      menuTheme: "dark",
    })
  })

  it("assertPublicParametriSafe segnala chiavi extra", () => {
    const bad = { ordini_online_attivi: true, leak_cassa: false }
    const r = assertPublicParametriSafe(bad)
    expect(r.ok).toBe(false)
    expect(r.extraKeys).toContain("leak_cassa")
  })

  it("assertPublicParametriSafe ok su solo whitelist", () => {
    const good = { ordini_online_attivi: true, fidelity_attivo: false }
    expect(assertPublicParametriSafe(good).ok).toBe(true)
  })

  it("forbidden probe keys non sono in whitelist", () => {
    for (const k of PUBLIC_PARAMETRI_FORBIDDEN_KEYS) {
      expect(PUBLIC_PARAMETRI_OPERATIVI_KEYS).not.toContain(k)
    }
  })
})
