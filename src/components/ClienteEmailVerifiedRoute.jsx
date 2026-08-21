import { Navigate, Outlet, useLocation } from "react-router-dom"
import { useAuth } from "@/app/contexts/AuthContext"
import { isSuperAdminRole } from "@/utils/superAdminAccess"
import { isDemoClienteSessionActive } from "@/utils/demoClienteSession"

/**
 * Solo utenti cliente con email confermata (ordini online).
 * Super Admin in supporto/QA entra senza verifica email cliente.
 */
export default function ClienteEmailVerifiedRoute() {
  const { user, tipoUtente, ruolo, loading, profileReady } = useAuth()
  const location = useLocation()
  const demoCliente = isDemoClienteSessionActive()

  // Demo: sblocca checkout subito (test Stripe/SumUp).
  if (demoCliente && user) {
    return <Outlet />
  }

  if (loading && !user) {
    return (
      <div className="min-h-[200px] flex items-center justify-center">
        <span className="text-gray-400 text-sm">Verifica account…</span>
      </div>
    )
  }

  if (user && !profileReady) {
    return (
      <div className="min-h-[200px] flex items-center justify-center">
        <span className="text-gray-400 text-sm">Verifica account…</span>
      </div>
    )
  }

  if (user && isSuperAdminRole(ruolo)) {
    return <Outlet />
  }

  if (!user || tipoUtente !== "cliente") {
    return <Navigate to={`/login${location.search || ""}`} state={{ from: location }} replace />
  }

  if (!user.email_confirmed_at) {
    return <Navigate to={`/cliente/verifica-email${location.search || ""}`} state={{ from: location }} replace />
  }

  return <Outlet />
}
