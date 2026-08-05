import { describe, it, expect } from "vitest"
import {
  resolveOperativePermessiAree,
  canEditTenantParametriInOperative,
  isSaDemoOrSupportContext,
} from "@/utils/operativeSaDemoAccess"

describe("operativeSaDemoAccess", () => {
  it("SA ottiene tutte le aree anche senza permessi staff", () => {
    const p = resolveOperativePermessiAree("superadmin", null, "")
    expect(p.cassa).toBe(true)
    expect(p.cucina).toBe(true)
    expect(p.delivery).toBe(true)
  })

  it("staff resta sui propri permessi", () => {
    const p = resolveOperativePermessiAree("cassa", { cassa: true, cucina: false }, "")
    expect(p.cassa).toBe(true)
    expect(p.cucina).toBe(false)
  })

  it("isSaDemoOrSupportContext richiede SA + marker", () => {
    expect(isSaDemoOrSupportContext("superadmin", "?_demo_giro=1")).toBe(true)
    expect(isSaDemoOrSupportContext("superadmin", "?support_tenant=abc")).toBe(true)
    expect(isSaDemoOrSupportContext("cassa", "?_demo_giro=1")).toBe(false)
  })

  it("canEditTenantParametriInOperative: SA sempre true", () => {
    expect(canEditTenantParametriInOperative("superadmin", false, "")).toBe(true)
    expect(canEditTenantParametriInOperative("cassa", false, "")).toBe(false)
    expect(canEditTenantParametriInOperative("cassa", true, "")).toBe(true)
  })
})
