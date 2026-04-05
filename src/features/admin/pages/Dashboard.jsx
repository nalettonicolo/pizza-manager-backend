import { Navigate } from "react-router-dom"
import { ADMIN_TENANT_HOME } from "@/constants/adminTenantHome"

/** Pagina Riepilogo KPI non più usata in AppRouter; reindirizza sempre (anche se importata da percorsi legacy). */
export default function Dashboard() {
  return <Navigate to={ADMIN_TENANT_HOME} replace />
}
