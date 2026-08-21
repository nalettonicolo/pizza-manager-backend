import { Navigate, Outlet, useLocation } from "react-router-dom"
import { useAuth } from "@/app/contexts/AuthContext"
import { isSuperAdminRole } from "@/utils/superAdminAccess"
import { isDemoClienteSessionActive } from "@/utils/demoClienteSession"

/**
 * Area cliente: utenti con riga in public.clienti, oppure Super Admin in supporto/QA.
 */
export default function ClienteRoute() {
  const { user, tipoUtente, ruolo, loading, profileReady } = useAuth()
  const location = useLocation()
  const demoCliente = isDemoClienteSessionActive()

  // Demo Area cliente: non attendere getSession / utenti_ruoli (lock Auth ~8–12s).
  if (demoCliente) {
    if (user) return <Outlet />
    if (loading) {
      return (
        <div className="min-h-[200px] flex items-center justify-center">
          <span className="text-gray-400 text-sm">Accesso Cliente Test…</span>
        </div>
      )
    }
  }

  // Non attendere getSession (può andare in timeout ~12s): se profilo pronto, entra subito.
  if (user && !profileReady) {
    return (
      <div className="min-h-[200px] flex items-center justify-center">
        <span className="text-gray-400 text-sm">Verifica accesso…</span>
      </div>
    )
  }
  if (loading && !user) {
    return (
      <div className="min-h-[200px] flex items-center justify-center">
        <span className="text-gray-400 text-sm">Verifica accesso…</span>
      </div>
    )
  }

  if (user && isSuperAdminRole(ruolo)) {
    return <Outlet />
  }

  if (user && tipoUtente === "cliente") {
    return <Outlet />
  }

  if (!user || tipoUtente !== "cliente") {
    return <Navigate to={`/login${location.search || ""}`} state={{ from: location }} replace />
  }

  return <Outlet />
}
