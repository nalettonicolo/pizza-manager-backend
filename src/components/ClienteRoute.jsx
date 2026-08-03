import { Navigate, Outlet, useLocation } from "react-router-dom"
import { useAuth } from "@/app/contexts/AuthContext"
import { isSuperAdminRole } from "@/utils/superAdminAccess"

/**
 * Area cliente: utenti con riga in public.clienti, oppure Super Admin in supporto/QA.
 */
export default function ClienteRoute() {
  const { user, tipoUtente, ruolo, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="min-h-[200px] flex items-center justify-center">
        <span className="text-gray-400 text-sm">Verifica accesso…</span>
      </div>
    )
  }

  if (user && isSuperAdminRole(ruolo)) {
    return <Outlet />
  }

  if (!user || tipoUtente !== "cliente") {
    return <Navigate to={`/login${location.search || ""}`} state={{ from: location }} replace />
  }

  return <Outlet />
}
