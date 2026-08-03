import React from "react"
import { Navigate, Outlet, useLocation } from "react-router-dom"
import { useAuth } from "@/app/contexts/AuthContext"
import { devLog } from "@/lib/devLog"
import { isSuperAdminRole, normalizeAppRuolo } from "@/utils/superAdminAccess"

function loginRedirectSearch(location) {
  const params = new URLSearchParams(location.search || "")
  if (location.pathname && location.pathname !== "/login" && !params.get("return_to")) {
    params.set("return_to", location.pathname)
  }
  const qs = params.toString()
  return qs ? `?${qs}` : ""
}

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

  if (!user) {
    devLog("ProtectedRoute", "non autenticato → /login", { allowedRoles })
    return (
      <Navigate to={`/login${loginRedirectSearch(location)}`} state={{ from: location }} replace />
    )
  }

  // Sessione presente ma profilo ancora in caricamento: NON mandare a /login
  // (nuove finestre Sala QA altrimenti sembrano “non loggate”).
  if (!tipoUtente || (!ruolo && tipoUtente === "staff")) {
    return (
      <div className="min-h-[200px] flex items-center justify-center">
        <span className="text-gray-400 text-sm">Caricamento profilo...</span>
      </div>
    )
  }

  if (isSuperAdminRole(ruolo)) {
    devLog("ProtectedRoute", "superadmin bypass", { allowedRoles, path: location.pathname })
    if (children != null && React.Children.count(children) > 0) return children
    return <Outlet />
  }

  if (tipoUtente !== "staff") {
    devLog("ProtectedRoute", "non staff → /login", { tipoUtente, allowedRoles })
    return (
      <Navigate to={`/login${loginRedirectSearch(location)}`} state={{ from: location }} replace />
    )
  }

  const ruoloNorm = normalizeAppRuolo(ruolo)
  const allowed = allowedRoles.some(
    (r) => (r && typeof r === "string" ? r.toLowerCase().trim() : "") === ruoloNorm,
  )
  if (!allowed) {
    devLog("ProtectedRoute", "ruolo non consentito → /login", { ruolo, allowedRoles })
    return (
      <Navigate to={`/login${loginRedirectSearch(location)}`} state={{ from: location }} replace />
    )
  }

  if (demoOnly) {
    const email = user.email?.toLowerCase() || ""
    if (!email.endsWith("@pizzamanager.it")) {
      devLog("ProtectedRoute", "demoOnly: email non @pizzamanager.it → /login", { email })
      return (
        <Navigate to={`/login${loginRedirectSearch(location)}`} state={{ from: location }} replace />
      )
    }
  }

  devLog("ProtectedRoute", "autorizzato", { ruolo, allowedRoles })
  if (children != null && React.Children.count(children) > 0) {
    return children
  }
  return <Outlet />
}

export default ProtectedRoute
