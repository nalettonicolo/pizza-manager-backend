// 📍 src/features/public/pages/Login.jsx

import { useState, useEffect } from "react"
import { Link, useNavigate, useLocation } from "react-router-dom"
import { useAuth } from "@/app/contexts/AuthContext"
import { getOperativeHomePathForStaff } from "@/constants/operativeRoutes"
import { ADMIN_TENANT_HOME, adminHomeWithSupportSearch } from "@/constants/adminTenantHome"
import { devLog } from "@/lib/devLog"
import { supabase } from "@/lib/supabaseClient"
import { getIsSaaSClient } from "@/utils/saasHost"
import { getSaaSLoginUrl } from "@/utils/saasLoginUrl"
import { isViewportLayoutPreviewSearch, isQaSupportSearch } from "@/utils/viewportLayoutPreview"
import { isSuperAdminRole, normalizeAppRuolo } from "@/utils/superAdminAccess"
import { translateAuthError } from "@/utils/translateAuthError"
import {
  DEMO_CLIENTE_FLAG_KEY,
  DEMO_CLIENTE_QUERY,
  clearDemoClienteSessionFlags,
  getDemoClienteCredentials,
  hasDemoSaStash,
  resolveDemoClienteTenantIdFromEnv,
  stripDemoMarkersFromSearch,
} from "@/utils/demoClienteSession"
import { setDemoGiroSessionActive, withDemoGiroQuery } from "@/utils/demoGiro"
import { readSafeReturnTo, setSupportTenantOverride, SUPPORT_TENANT_QUERY } from "@/utils/supportTenantOverride"
import { resolveClienteVetrinaPath } from "@/utils/clienteVetrinaPath"
import "@/styles/login.css"

function isDemoClienteAccount(user) {
  const demoEmail = getDemoClienteCredentials().email
  if (!demoEmail || !user?.email) return false
  return String(user.email).trim().toLowerCase() === String(demoEmail).trim().toLowerCase()
}

export default function Login() {
  const { login, logout, ruolo, tipoUtente, user, loading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [switchingToCliente, setSwitchingToCliente] = useState(false)
  const searchParams = new URLSearchParams(location.search)
  const supportTenantId = searchParams.get("support_tenant")
  const supportReturnTo = location.state?.from
  const returnToQuery = readSafeReturnTo(location.search)
  const forceClienteMode =
    searchParams.get("cliente") === "1" ||
    location.pathname === "/preview" ||
    location.pathname === "/negozio"
  const staffBlockedOnClienteLogin = Boolean(forceClienteMode && user && tipoUtente === "staff")
  const vetrinaReturnPath =
    supportReturnTo?.pathname === "/preview" || supportReturnTo?.pathname === "/negozio"
      ? `${supportReturnTo.pathname}${supportReturnTo.search || ""}`
      : "/preview"

  const handleExitStaffForClienteDemo = async () => {
    setError(null)
    setSwitchingToCliente(true)
    try {
      await logout()
    } catch (e) {
      setError(e?.message || "Uscita non riuscita. Riprova.")
    } finally {
      setSwitchingToCliente(false)
    }
  }

  useEffect(() => {
    if (loading) return
    if (!user) return

    const demoCliente =
      (() => {
        try {
          return sessionStorage.getItem("pm_demo_cliente_active") === "1"
        } catch {
          return false
        }
      })() ||
      new URLSearchParams(location.search).get("_demo_giro") === "1"

    // Cliente (anche senza ruolo staff): non restare sul form.
    // Su SaaS (localhost) la demo area cliente deve funzionare; non fare signOut.
    if (tipoUtente === "cliente") {
      const saas = getIsSaaSClient()
      const returnCliente =
        (returnToQuery && returnToQuery.startsWith("/cliente")) ||
        (supportReturnTo?.pathname && String(supportReturnTo.pathname).startsWith("/cliente"))
      const demoAccount = isDemoClienteAccount(user)

      // Cliente Test: login esterno → area cliente reale (vetrina + profilo).
      // Chrome demo SA solo con stash + entrata esplicita (_demo_cliente), non con stash residuo.
      if (demoAccount) {
        const tid = supportTenantId || resolveDemoClienteTenantIdFromEnv()
        const explicitDemoEntry =
          new URLSearchParams(location.search).get(DEMO_CLIENTE_QUERY) === "1"
        const saDemo = hasDemoSaStash() && explicitDemoEntry

        if (!saDemo) {
          clearDemoClienteSessionFlags()
          setDemoGiroSessionActive(false)
        }

        if (tid) setSupportTenantOverride(tid)

        if (saDemo && tid) {
          try {
            sessionStorage.setItem(DEMO_CLIENTE_FLAG_KEY, "1")
          } catch {
            /* ignore */
          }
          setDemoGiroSessionActive(true)
          let dest = withDemoGiroQuery("/preview", tid)
          try {
            const url = new URL(dest, window.location.origin)
            url.searchParams.set(DEMO_CLIENTE_QUERY, "1")
            dest = `${url.pathname}${url.search}`
          } catch {
            /* keep */
          }
          devLog("Login", "redirect → vetrina Cliente Test (demo SA)", { dest })
          navigate(dest, { replace: true })
          return
        }

        let dest = resolveClienteVetrinaPath(stripDemoMarkersFromSearch(location.search || ""))
        if (tid) {
          try {
            const url = new URL(dest, window.location.origin)
            url.searchParams.set(SUPPORT_TENANT_QUERY, tid)
            url.searchParams.delete(DEMO_CLIENTE_QUERY)
            url.searchParams.delete("_demo_giro")
            url.searchParams.delete("_qa_console")
            url.searchParams.delete("return_to")
            dest = `${url.pathname}${url.search}`
          } catch {
            /* keep */
          }
        }
        devLog("Login", "redirect → area cliente (Cliente Test)", { dest })
        navigate(dest, { replace: true })
        return
      }

      if (saas && !forceClienteMode && !demoCliente && !returnCliente && !supportTenantId) {
        setError("Gli account cliente si usano dal sito della tua pizzeria (menu online), non da PizzaManager.")
        void supabase.auth.signOut()
        return
      }

      if (forceClienteMode && returnToQuery && (returnToQuery.startsWith("/preview") || returnToQuery.startsWith("/negozio"))) {
        navigate(returnToQuery, { replace: true })
        return
      }
      if (
        forceClienteMode &&
        supportReturnTo?.pathname &&
        (supportReturnTo.pathname === "/preview" || supportReturnTo.pathname === "/negozio")
      ) {
        navigate(`${supportReturnTo.pathname}${supportReturnTo.search || ""}`, { replace: true })
        return
      }

      // Preferisci return_to vetrina / area cliente; altrimenti menù (non hub account).
      let dest
      if (returnToQuery && (returnToQuery.startsWith("/preview") || returnToQuery.startsWith("/negozio") || returnToQuery === "/")) {
        dest = returnToQuery
      } else if (returnToQuery && returnToQuery.startsWith("/cliente")) {
        dest = `${returnToQuery.split("?")[0]}${location.search || ""}`
      } else if (
        supportReturnTo?.pathname &&
        (supportReturnTo.pathname.startsWith("/preview") ||
          supportReturnTo.pathname.startsWith("/negozio") ||
          supportReturnTo.pathname.startsWith("/cliente"))
      ) {
        dest = `${supportReturnTo.pathname}${supportReturnTo.search || location.search || ""}`
      } else {
        dest = resolveClienteVetrinaPath(location.search || "")
      }
      devLog("Login", "redirect → vetrina cliente", { dest, demoCliente })
      navigate(dest, { replace: true })
      return
    }

    // Aspetta profilo staff completo (cliente già gestito sopra).
    if (!tipoUtente || !ruolo) return

    const qaSupport = isQaSupportSearch(location.search) || Boolean(supportTenantId)
    const layoutOnlyPreview =
      isViewportLayoutPreviewSearch(location.search) && !qaSupport && location.pathname === "/login"

    const returnPathFromState =
      supportReturnTo?.pathname && supportReturnTo.pathname !== "/login"
        ? `${supportReturnTo.pathname}${supportReturnTo.search || ""}`
        : null

    const buildQaTarget = (pathOnly) => {
      const p = pathOnly || "/operative/cassa"
      const params = new URLSearchParams()
      if (supportTenantId) params.set("support_tenant", supportTenantId)
      params.set("_qa_console", "1")
      params.set("return_to", p)
      return `${p}?${params.toString()}`
    }

    const ruoloNorm = normalizeAppRuolo(ruolo)
    const isTenantAdmin =
      ruoloNorm === "admin" || ruoloNorm === "owner" || isSuperAdminRole(ruolo)

    // Accedi da vetrina (/login?cliente=1): staff già loggato (admin / SA) entra in automatico
    // nell’area amministrazione del locale — senza form e senza logout per “cliente”.
    if (forceClienteMode && tipoUtente === "staff" && isTenantAdmin) {
      navigate(adminHomeWithSupportSearch(location.search), { replace: true })
      return
    }

    // Solo Sala QA / supporto live: torna alla schermata richiesta (cassa, cucina, …).
    // Login SA normale → sempre /superadmin/ingresso (scelta Anteprima / Amministrazione).
    if (isSuperAdminRole(ruolo) && qaSupport) {
      if (returnPathFromState) {
        navigate(returnPathFromState.includes("?") ? returnPathFromState : buildQaTarget(returnPathFromState), {
          replace: true,
        })
        return
      }
      if (returnToQuery) {
        navigate(buildQaTarget(returnToQuery), { replace: true })
        return
      }
      if (supportTenantId) {
        navigate(buildQaTarget("/operative/cassa"), { replace: true })
        return
      }
    }

    // Solo anteprima layout della pagina login (tool Test layout), non Sala QA.
    if (layoutOnlyPreview) return

    // Login cliente da vetrina: sessione staff non-admin → resta sul form (uscita per demo cliente).
    if (forceClienteMode && tipoUtente === "staff" && !isQaSupportSearch(location.search)) {
      return
    }

    // Super Admin fuori da Sala QA:
    // - login pulito → ingresso a 2 tasti
    // - return_to / state verso area superadmin (es. Sala QA) → onora la destinazione
    if (isSuperAdminRole(ruolo) && !qaSupport) {
      const fromState =
        returnPathFromState && returnPathFromState.startsWith("/superadmin/")
          ? returnPathFromState
          : null
      const fromQuery =
        returnToQuery && returnToQuery.startsWith("/superadmin/") ? returnToQuery : null
      const saTarget = fromState || fromQuery
      if (saTarget && saTarget !== "/superadmin/ingresso" && !saTarget.startsWith("/superadmin/ingresso?")) {
        navigate(saTarget, { replace: true })
        return
      }
      navigate("/superadmin/ingresso", { replace: true })
      return
    }

    devLog("Login", "redirect check", { tipoUtente, ruolo, email: user?.email })

    const saas = getIsSaaSClient()

    if (!saas && tipoUtente === "staff" && !forceClienteMode) {
      window.location.replace(getSaaSLoginUrl())
      return
    }

    if (tipoUtente === "staff") {
      const ruoloNormStaff = ruolo && typeof ruolo === "string" ? ruolo.toLowerCase().trim() : ""
      let targetRoute = "/operative/dashboard"
      if (ruoloNormStaff === "superadmin") targetRoute = "/superadmin/ingresso"
      else if (ruoloNormStaff === "admin" || ruoloNormStaff === "owner") targetRoute = ADMIN_TENANT_HOME
      else targetRoute = getOperativeHomePathForStaff(ruolo, user?.email)

      if (returnPathFromState) {
        navigate(returnPathFromState, { replace: true })
        return
      }

      if (returnToQuery && !returnToQuery.startsWith("/superadmin")) {
        navigate(returnToQuery, { replace: true })
        return
      }

      // Demo giro con return_to cliente: non mandare in cassa.
      if (demoCliente && returnToQuery?.startsWith("/cliente")) {
        navigate(`${returnToQuery.split("?")[0]}${location.search || ""}`, { replace: true })
        return
      }

      devLog("Login", "redirect →", targetRoute, { ruolo })
      navigate(targetRoute, { replace: true })
      return
    }

    devLog("Login", "fallback redirect → /")
    navigate("/", { replace: true })
  }, [
    user,
    ruolo,
    tipoUtente,
    loading,
    navigate,
    location.state,
    location.search,
    location.pathname,
    forceClienteMode,
    supportTenantId,
    supportReturnTo,
    returnToQuery,
  ])

  const isSaaS = getIsSaaSClient()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    devLog("Login", "submit", { email })

    const result = await login(email, password)
    const err = result?.error

    if (err) {
      devLog("Login", "submit error", err.message)
      setError(translateAuthError(err, "Errore di accesso"))
    } else {
      devLog("Login", "submit ok, in attesa redirect", { userId: result?.data?.user?.id })
      try {
        const uid = result?.data?.user?.id
        if (uid && typeof sessionStorage !== "undefined") {
          const prev = sessionStorage.getItem("pm_staff_session_uid")
          if (prev && prev !== uid) {
            sessionStorage.removeItem("pm_staff_session_uid")
          }
          sessionStorage.setItem("pm_staff_session_uid", uid)
        }
      } catch {
        /* ignore */
      }
    }
    setSubmitting(false)
  }

  if (loading) {
    devLog("Login", "in attesa sessione (loading=true)...")
    return (
      <div className="login-loading-screen">
        <div className="login-spinner" aria-hidden="true" />
        <p>Verifica sessione…</p>
      </div>
    )
  }

  const layoutPreview =
    isViewportLayoutPreviewSearch(location.search) && !isQaSupportSearch(location.search)

  return (
    <div className="login-page">
      <div className="login-page-inner">
        <div className="login-card">
          {layoutPreview ? (
            <p className="login-layout-preview-banner" role="status">
              Anteprima layout: la sessione resta attiva; questa schermata non esegue il reindirizzamento automatico.
            </p>
          ) : null}
          <div className="login-brand">
            <div className="login-brand-mark" aria-hidden="true">
              🍕
            </div>
            <h1 className="login-brand-title">{isSaaS && !forceClienteMode ? "PizzaManager" : "Accedi"}</h1>
          </div>

          {staffBlockedOnClienteLogin ? (
            <div
              role="status"
              style={{
                marginBottom: 16,
                padding: "14px 16px",
                borderRadius: 10,
                background: "#fff7ed",
                border: "1px solid #fdba74",
                color: "#9a3412",
                fontSize: 14,
                lineHeight: 1.45,
              }}
            >
              <p style={{ margin: "0 0 12px" }}>
                Sei ancora connesso come <strong>staff / Super Admin</strong>. Per mostrare il percorso cliente (carrello,
                ordini) esci da questa sessione e accedi con un account cliente, oppure crea un account dalla vetrina.
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                <button
                  type="button"
                  className="login-submit"
                  style={{ width: "auto", margin: 0, padding: "10px 16px" }}
                  disabled={switchingToCliente}
                  onClick={() => void handleExitStaffForClienteDemo()}
                >
                  {switchingToCliente ? "Uscita…" : "Esci e continua come cliente"}
                </button>
                <Link
                  to={vetrinaReturnPath}
                  className="login-back"
                  style={{ alignSelf: "center", margin: 0 }}
                >
                  Torna alla vetrina
                </Link>
              </div>
            </div>
          ) : (
          <form className="login-form" onSubmit={handleSubmit} noValidate>
            <div className="login-field">
              <label className="login-label" htmlFor="login-email">
                Email
              </label>
              <input
                id="login-email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="nome@esempio.it"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="login-input"
                required
              />
            </div>

            <div className="login-field">
              <label className="login-label" htmlFor="login-password">
                Password
              </label>
              <div style={{ position: "relative" }}>
                <input
                  id="login-password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="login-input"
                  style={{ paddingRight: 44 }}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Nascondi password" : "Mostra password"}
                  style={{
                    position: "absolute",
                    right: 10,
                    top: "50%",
                    transform: "translateY(-50%)",
                    border: "none",
                    background: "transparent",
                    cursor: "pointer",
                    fontSize: 18,
                  }}
                >
                  {showPassword ? "🙈" : "👁️"}
                </button>
              </div>
            </div>

            {error && (
              <p className="login-error" role="alert">
                {error}
              </p>
            )}

            <button type="submit" className="login-submit" disabled={submitting}>
              {submitting ? "Accesso in corso…" : "Accedi"}
            </button>
          </form>
          )}

          {error && staffBlockedOnClienteLogin ? (
            <p className="login-error" role="alert">
              {error}
            </p>
          ) : null}

          <div className="login-footer-links">
            {!isSaaS || forceClienteMode ? (
              <>
                <Link
                  to={`/registrazione${forceClienteMode ? "?from=preview" : ""}`}
                  className="login-back"
                >
                  Crea account cliente
                </Link>
                <Link to="/password-dimenticata" className="login-back">
                  Password dimenticata
                </Link>
              </>
            ) : null}
            <Link to={forceClienteMode ? vetrinaReturnPath : "/"} className="login-back">
              {forceClienteMode ? "← Torna alla vetrina" : "← Torna alla home"}
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
