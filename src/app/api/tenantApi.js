import { apiClient } from "@/app/api/client.js"

/** Tenant corrente dal backend Nest. Super Admin: passa `tenantId` override Sala QA. */
export async function nestTenantMe(tenantId) {
  const q =
    tenantId && String(tenantId).trim()
      ? `?tenantId=${encodeURIComponent(String(tenantId).trim())}`
      : ""
  const { data } = await apiClient.get(`/api/tenant/me${q}`)
  return data
}

/** Elenco PV da Nest. Super Admin: passa `tenantId` del tenant assistito. */
export async function nestTenantPuntiVendita(tenantId) {
  const q =
    tenantId && String(tenantId).trim()
      ? `?tenantId=${encodeURIComponent(String(tenantId).trim())}`
      : ""
  const { data } = await apiClient.get(`/api/tenant/punti-vendita${q}`)
  return data
}
