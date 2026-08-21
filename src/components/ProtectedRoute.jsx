import React, { useEffect, useState } from "react"
import { Navigate, Outlet, useLocation } from "react-router-dom"
import { useAuth } from "@/app/contexts/AuthContext"
import { devLog } from "@/lib/devLog"
import { isSuperAdminRole, normalizeAppRuolo } from "@/utils/superAdminAccess"
import { isDemoClienteSessionActive } from "@/utils/demoClienteSession"
import { withDemoGiroQuery } from "@/utils/demoGiro"
import { resolveSupportTenantOverride } from "@/utils/supportTenantOverride"

function loginRedirectSearch(location) {
  const params = new URLSearchParams(location.search || "")
  if (location.pathname && location.pathname !== "/login" && !params.get("return_to")) {
    params.set("return_to", location.pathname)
  }
  const qs = params.toString()
  return qs ? `?${qs}` : ""
}

const ProtectedRoute = ({ allowedRoles = [], demoOnly = false, children }) => {
  const { user, tipoUtente, ruolo, loading, profileReady } = useAuth()
  const location = useLocation()
  const [profileWaitTooLong, setProfileWaitTooLong] = useState(false)

  useEffect(() => {
    if (profileReady || !user || loading) {
      setProfileWaitTooLong(false)
      return undefined
    }
    const t = window.setTimeout(() => setProfileWaitTooLong(true), 10000)
    return () => window.clearTimeout(t)
  }, [profileReady, user, loading])

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

  if (!profileReady) {
    if (profileWaitTooLong) {
      return (
        <div
          className="min-h-[200px] flex flex-col items-center justify-center gap-3"
          style={{ padding: 24, textAlign: "center", maxWidth: 420, margin: "0 auto" }}
        >
          <p style={{ margin: 0, fontSize: 15, color: "#334155", lineHeight: 1.5 }}>
            Il caricamento del profilo sta impiegando troppo. Spesso è un problema di rete o di sessione.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{
                padding: "8px 14px",
                borderRadius: 8,
                border: "none",
                background: "#1565c0",
                color: "#fff",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Ricarica
            </button>
            <a
              href={`/login${loginRedirectSearch(location)}`}
              style={{
                padding: "8px 14px",
                borderRadius: 8,
                border: "1px solid #cbd5e1",
                background: "#fff",
                color: "#334155",
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              Vai al login
            </a>
          </div>
        </div>
      )
    }
    return (
      <div className="min-h-[200px] flex items-center justify-center">
        <span className="text-gray-400 text-sm">Caricamento profilo...</span>
      </div>
    )
  }

  // Profilo risolto ma assente / incompleto (non restare in loop infinito).
  if (!tipoUtente || (!ruolo && tipoUtente === "staff")) {
    return (
      <div
        className="min-h-[200px] flex flex-col items-center justify-center gap-3"
        style={{ padding: 24, textAlign: "center", maxWidth: 420, margin: "0 auto" }}
      >
        <p style={{ margin: 0, fontSize: 15, color: "#334155", lineHeight: 1.5 }}>
          Non riusciamo a caricare il profilo operativo per questo account.
        </p>
        <p style={{ margin: 0, fontSize: 13, color: "#64748b", lineHeight: 1.45 }}>
          Ricarica la pagina. Se il problema resta, esci e accedi di nuovo, oppure verifica che l’utente
          sia presente tra i dipendenti della pizzeria.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              padding: "8px 14px",
              borderRadius: 8,
              border: "none",
              background: "#1565c0",
              color: "#fff",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Ricarica
          </button>
          <a
            href={`/login${loginRedirectSearch(location)}`}
            style={{
              padding: "8px 14px",
              borderRadius: 8,
              border: "1px solid #cbd5e1",
              background: "#fff",
              color: "#334155",
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            Vai al login
          </a>
        </div>
      </div>
    )
  }

  if (isSuperAdminRole(ruolo)) {
    devLog("ProtectedRoute", "superadmin bypass", { allowedRoles, path: location.pathname })
    if (children != null && React.Children.count(children) > 0) return children
    return <Outlet />
  }

  if (tipoUtente !== "staff") {
    // Demo Area cliente: sessione cliente mentre si è ancora su route operative/admin.
    if (tipoUtente === "cliente" && isDemoClienteSessionActive()) {
      const tid =
        resolveSupportTenantOverride() ||
        String(import.meta.env.VITE_PUBLIC_DEMO_TENANT_ID || "").trim()
      let dest = withDemoGiroQuery("/preview", tid)
      try {
        const url = new URL(dest, window.location.origin)
        url.searchParams.set("_demo_cliente", "1")
        dest = `${url.pathname}${url.search}`
      } catch {
        /* keep */
      }
      if (!location.pathname.startsWith("/cliente")) {
        devLog("ProtectedRoute", "demo cliente → area cliente", { dest })
        return <Navigate to={dest} replace />
      }
    }
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
