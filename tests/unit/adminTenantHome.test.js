import { describe, it, expect } from "vitest"
import { adminHomeWithSupportSearch, ADMIN_TENANT_HOME } from "@/constants/adminTenantHome"

describe("adminHomeWithSupportSearch", () => {
  it("senza marker restituisce solo home", () => {
    expect(adminHomeWithSupportSearch("")).toBe(ADMIN_TENANT_HOME)
    expect(adminHomeWithSupportSearch("?foo=1")).toBe(ADMIN_TENANT_HOME)
  })

  it("preserva support_tenant e demo giro", () => {
    const out = adminHomeWithSupportSearch(
      "?support_tenant=abc&_demo_giro=1&_qa_console=1&cliente=1",
    )
    expect(out).toContain(ADMIN_TENANT_HOME)
    expect(out).toContain("support_tenant=abc")
    expect(out).toContain("_demo_giro=1")
    expect(out).not.toContain("cliente=1")
  })
})
