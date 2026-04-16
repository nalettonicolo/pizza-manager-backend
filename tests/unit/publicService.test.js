import { describe, it, expect } from "vitest"
import { parsePublicTenantQuery, mergePublicTenantOptions } from "@/features/services/publicService"

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
