import { withPreservedSupportSearch } from "@/utils/supportTenantOverride"

/**
 * Home admin tenant: pagina Benvenuto con card (anteprima, scelta PV se multi-sede, area admin).
 * `/admin/dashboard` reindirizza qui. Da qui si entra in Menu → `/admin/menu` (categorie).
 */
export const ADMIN_TENANT_HOME = "/admin/home"

/** Home admin con marker demo / support_tenant preservati. */
export function adminHomeWithSupportSearch(search) {
  return withPreservedSupportSearch(ADMIN_TENANT_HOME, search)
}
