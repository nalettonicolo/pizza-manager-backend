import { Navigate, Outlet, useLocation } from "react-router-dom"
import { useAuth } from "@/app/contexts/AuthContext"

/**
 * Solo utenti cliente con email confermata (ordini online).
 */
export default function ClienteEmailVerifiedRoute() {
  const { user, tipoUtente, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="min-h-[200px] flex items-center justify-center">
        <span className="text-gray-400 text-sm">Verifica account…</span>
      </div>
    )
  }

  if (!user || tipoUtente !== "cliente") {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (!user.email_confirmed_at) {
    return <Navigate to="/cliente/verifica-email" state={{ from: location }} replace />
  }

  return <Outlet />
}
