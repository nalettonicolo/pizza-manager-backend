import { apiClient } from "@/app/api/client.js"

/** Tenant corrente dal backend Nest (`tenantId` nel JWT). Allineato alla forma letta da PostgREST `public.tenants`. */
export async function nestTenantMe() {
  const { data } = await apiClient.get("/api/tenant/me")
  return data
}

/** Elenco PV da Nest (`core.punti_vendita`) per il `tenantId` nel JWT. */
export async function nestTenantPuntiVendita() {
  const { data } = await apiClient.get("/api/tenant/punti-vendita")
  return data
}
