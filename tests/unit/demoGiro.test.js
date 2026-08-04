import { describe, it, expect } from "vitest"
import { DEMO_GIRO_STEPS, isDemoGiroSearch, withDemoGiroQuery } from "@/utils/demoGiro"

describe("demoGiro", () => {
  it("riconosce _demo_giro=1", () => {
    expect(isDemoGiroSearch("?_demo_giro=1&support_tenant=abc")).toBe(true)
    expect(isDemoGiroSearch("?support_tenant=abc")).toBe(false)
  })

  it("avvia da Cassa con marker support", () => {
    const url = withDemoGiroQuery(DEMO_GIRO_STEPS[0].path, "tenant-1", { stepIndex: 0 })
    expect(url.startsWith("/operative/cassa?")).toBe(true)
    expect(url).toContain("support_tenant=tenant-1")
    expect(url).toContain("_demo_giro=1")
    expect(url).toContain("_qa_console=1")
  })
})
