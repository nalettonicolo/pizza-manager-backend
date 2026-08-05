import { describe, it, expect, vi, afterEach } from "vitest"

vi.mock("@/lib/supabaseClient", () => ({
  supabase: {
    from: vi.fn(),
  },
}))

import { supabase } from "@/lib/supabaseClient"
import { patchTenantParametriOperativi } from "@/features/admin/services/parametriService"

describe("parametriService", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("patchTenantParametriOperativi merge sul blob esistente", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: { id: "t1", parametri_operativi: { a: 1, ordini_online_attivi: false } },
      error: null,
    })
    const eqSelect = vi.fn(() => ({ maybeSingle }))
    const select = vi.fn(() => ({ eq: eqSelect }))

    const eqUpdate = vi.fn().mockResolvedValue({ error: null })
    const update = vi.fn(() => ({ eq: eqUpdate }))

    supabase.from.mockImplementation(() => ({ select, update }))

    await patchTenantParametriOperativi("t1", { ordini_online_attivi: true })

    expect(update).toHaveBeenCalledWith({
      parametri_operativi: { a: 1, ordini_online_attivi: true },
    })
  })
})
