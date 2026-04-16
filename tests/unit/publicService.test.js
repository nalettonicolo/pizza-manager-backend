import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { parsePublicTenantQuery, mergePublicTenantOptions, getPublicMenuIngredientNames } from "@/features/services/publicService"
import { supabase } from "@/lib/supabaseClient"

describe("publicService tenant query parsing", () => {
  it("estrae tenantId valido da tenant e tenantId", () => {
    const uuid = "123e4567-e89b-12d3-a456-426614174000"
    expect(parsePublicTenantQuery(`?tenant=${uuid}`)).toEqual({ tenantId: uuid })
    expect(parsePublicTenantQuery(`?tenantId=${uuid}`)).toEqual({ tenantId: uuid })
  })

  it("ignora tenantId non valido e usa slug", () => {
    expect(parsePublicTenantQuery("?tenant=abc&slug=roma-centro")).toEqual({ tenantSlug: "roma-centro" })
  })

  it("mergePublicTenantOptions dà priorità ai valori espliciti", () => {
    const uuid = "123e4567-e89b-12d3-a456-426614174000"
    const merged = mergePublicTenantOptions({
      tenantId: uuid,
      tenantSlug: "esplicito",
      search: "?tenant=00000000-0000-0000-0000-000000000000&slug=query",
    })
    expect(merged).toEqual({ tenantId: uuid, tenantSlug: "esplicito" })
  })

  it("mergePublicTenantOptions usa query quando non c'è input esplicito", () => {
    const uuid = "123e4567-e89b-12d3-a456-426614174000"
    const merged = mergePublicTenantOptions({ search: `?tenant=${uuid}` })
    expect(merged).toEqual({ tenantId: uuid, tenantSlug: null })
  })
})

describe("getPublicMenuIngredientNames", () => {
  const tenantId = "123e4567-e89b-12d3-a456-426614174000"
  const productId = "223e4567-e89b-12d3-a456-426614174001"

  beforeEach(() => {
    vi.spyOn(supabase, "rpc")
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("costruisce la mappa da righe RPC", async () => {
    supabase.rpc.mockResolvedValue({
      data: [{ prodotto_id: productId, nomi: ["Mozzarella", "Pomodoro"] }],
      error: null,
    })
    const map = await getPublicMenuIngredientNames(tenantId, [productId])
    expect(map).toEqual({ [productId]: ["Mozzarella", "Pomodoro"] })
    expect(supabase.rpc).toHaveBeenCalledWith("get_public_menu_ingredient_names", {
      p_tenant_id: tenantId,
      p_product_ids: [productId],
    })
  })

  it("ritorna null se la RPC non esiste (deploy pendente)", async () => {
    supabase.rpc.mockResolvedValue({
      data: null,
      error: { message: "Could not find the function public.get_public_menu_ingredient_names" },
    })
    expect(await getPublicMenuIngredientNames(tenantId, [productId])).toBeNull()
  })
})
