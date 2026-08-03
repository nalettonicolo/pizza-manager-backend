import { describe, it, expect } from "vitest"
import { isSuperAdminRole, normalizeAppRuolo } from "@/utils/superAdminAccess"

describe("superAdminAccess", () => {
  it("riconosce superadmin / super_admin", () => {
    expect(isSuperAdminRole("superadmin")).toBe(true)
    expect(isSuperAdminRole("SuperAdmin")).toBe(true)
    expect(isSuperAdminRole("super_admin")).toBe(true)
    expect(isSuperAdminRole("admin")).toBe(false)
    expect(isSuperAdminRole(null)).toBe(false)
  })

  it("normalizza il ruolo", () => {
    expect(normalizeAppRuolo("  ADMIN ")).toBe("admin")
    expect(normalizeAppRuolo(null)).toBe("")
  })
})
