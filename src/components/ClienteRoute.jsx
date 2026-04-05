import { Navigate, Outlet, useLocation } from "react-router-dom"
import { useAuth } from "@/app/contexts/AuthContext"

/**
 * Solo utenti con riga in public.clienti (tipoUtente === "cliente").
 */
export default function ClienteRoute() {
  const { user, tipoUtente, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="min-h-[200px] flex items-center justify-center">
        <span className="text-gray-400 text-sm">Verifica accesso…</span>
      </div>
    )
  }

  if (!user || tipoUtente !== "cliente") {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return <Outlet />
}
