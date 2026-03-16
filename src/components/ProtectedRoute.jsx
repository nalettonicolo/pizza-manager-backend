import React from "react"
import { Navigate, Outlet, useLocation } from "react-router-dom"
import { useAuth } from "@/app/contexts/AuthContext"
import { devLog } from "@/lib/devLog"

const ProtectedRoute = ({ allowedRoles = [], demoOnly = false, children }) => {
  const { user, tipoUtente, ruolo, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    devLog("ProtectedRoute", "loading...", { allowedRoles, demoOnly })
    return (
      <div className="min-h-[200px] flex items-center justify-center">
        <span className="text-gray-400 text-sm">Accesso in corso...</span>
      </div>
    )
  }

  if (!user || tipoUtente !== "staff") {
    devLog("ProtectedRoute", "non autorizzato → /login", { haUser: !!user, tipoUtente, allowedRoles })
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (!allowedRoles.includes(ruolo)) {
    devLog("ProtectedRoute", "ruolo non consentito → /login", { ruolo, allowedRoles })
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (demoOnly) {
    const email = user.email?.toLowerCase() || ""
    if (!email.endsWith("@pizzamanager.it")) {
      devLog("ProtectedRoute", "demoOnly: email non @pizzamanager.it → /login", { email })
      return <Navigate to="/login" state={{ from: location }} replace />
    }
  }

  devLog("ProtectedRoute", "autorizzato", { ruolo, allowedRoles })
  // Se ci sono children (es. RoleLayout + SuperAdminLayout), renderizzali così il layout con il suo Outlet viene mostrato
  if (children != null && React.Children.count(children) > 0) {
    return children
  }
  return <Outlet />
}

export default ProtectedRoute
