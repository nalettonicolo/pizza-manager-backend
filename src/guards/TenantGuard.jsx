import { Navigate } from "react-router-dom"
import { useTenant } from "@/app/contexts/TenantContext"

export default function TenantGuard({ children }) {
  const { tenantData, loading } = useTenant()

  if (loading) return null

  if (!tenantData) {
    return <Navigate to="/no-tenant" replace />
  }

  return children
}
