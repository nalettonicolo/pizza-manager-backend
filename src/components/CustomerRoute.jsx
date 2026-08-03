import { Navigate, Outlet } from "react-router-dom"
import { useAuth } from "@/app/contexts/AuthContext"
import { useLocation } from "react-router-dom"
import { devLog } from "@/lib/devLog"
import { isSuperAdminRole } from "@/utils/superAdminAccess"

export default function CustomerRoute() {
  const { user, tipoUtente, ruolo, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    devLog("CustomerRoute", "loading...")
    return (
      <div style={{ padding: "40px", textAlign: "center" }}>
        Verifica accesso...
      </div>
    )
  }

  if (user && isSuperAdminRole(ruolo)) {
    return <Outlet />
  }

  if (!user || tipoUtente !== "cliente") {
    devLog("CustomerRoute", "non cliente → /login", { haUser: !!user, tipoUtente })
    return <Navigate to={`/login${location.search || ""}`} state={{ from: location }} replace />
  }

  devLog("CustomerRoute", "autorizzato cliente")
  return <Outlet />
}
