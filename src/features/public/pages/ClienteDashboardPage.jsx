import { Navigate, useLocation } from "react-router-dom"
import { resolveClienteVetrinaPath } from "@/utils/clienteVetrinaPath"

/**
 * Hub account deprecato: dopo login il cliente entra in vetrina.
 * Questa route resta per bookmark / link vecchi.
 */
export default function ClienteDashboardPage() {
  const location = useLocation()
  return <Navigate to={resolveClienteVetrinaPath(location.search)} replace />
}
