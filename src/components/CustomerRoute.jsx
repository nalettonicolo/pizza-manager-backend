import { Navigate, Outlet } from "react-router-dom"
import { useAuth } from "@/app/contexts/AuthContext"
import { devLog } from "@/lib/devLog"

export default function CustomerRoute() {
  const { user, tipoUtente, loading } = useAuth()

  if (loading) {
    devLog("CustomerRoute", "loading...")
    return (
      <div style={{ padding: "40px", textAlign: "center" }}>
        Verifica accesso...
      </div>
    )
  }

  if (!user || tipoUtente !== "cliente") {
    devLog("CustomerRoute", "non cliente → /login", { haUser: !!user, tipoUtente })
    return <Navigate to="/login" replace />
  }

  devLog("CustomerRoute", "autorizzato cliente")
  return <Outlet />
}