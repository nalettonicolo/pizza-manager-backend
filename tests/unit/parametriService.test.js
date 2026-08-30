import { describe, it, expect, vi, afterEach } from "vitest"

vi.mock("@/lib/supabaseClient", () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
  },
}))

import { supabase } from "@/lib/supabaseClient"
import { patchTenantParametriOperativi } from "@/features/admin/services/parametriService"

describe("parametriService", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("patchTenantParametriOperativi merge sul blob esistente via RPC", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: { id: "t1", parametri_operativi: { a: 1, ordini_online_attivi: false } },
      error: null,
    })
    const eqSelect = vi.fn(() => ({ maybeSingle }))
    const select = vi.fn(() => ({ eq: eqSelect }))
    const update = vi.fn()

    supabase.from.mockImplementation(() => ({ select, update }))
    supabase.rpc.mockResolvedValue({
      data: { a: 1, ordini_online_attivi: true },
      error: null,
    })

    await patchTenantParametriOperativi("t1", { ordini_online_attivi: true })

    expect(supabase.rpc).toHaveBeenCalledWith("admin_update_tenant_parametri_operativi", {
      p_tenant_id: "t1",
      p_parametri: { a: 1, ordini_online_attivi: true },
    })
    expect(update).not.toHaveBeenCalled()
  })
})
