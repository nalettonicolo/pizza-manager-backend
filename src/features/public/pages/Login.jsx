// 📍 src/features/public/pages/Login.jsx

import { useState, useEffect } from "react"
import { Link, useNavigate, useLocation } from "react-router-dom"
import { useAuth } from "@/app/contexts/AuthContext"
import { OPERATIVE_ROLE_HOME } from "@/constants/operativeRoutes"
import { ADMIN_TENANT_HOME } from "@/constants/adminTenantHome"
import { devLog } from "@/lib/devLog"
import { supabase } from "@/lib/supabaseClient"
import { getIsSaaSClient } from "@/utils/saasHost"
import { getSaaSLoginUrl } from "@/utils/saasLoginUrl"
import "@/styles/login.css"

function safeInternalPath(p) {
  if (!p || typeof p !== "string") return null
  if (!p.startsWith("/") || p.startsWith("//")) return null
  if (p.includes("..")) return null
  return p
}

export default function Login() {
  const { login, ruolo, tipoUtente, user, loading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (loading) return
    if (!user || !tipoUtente) return

    devLog("Login", "redirect check", { tipoUtente, ruolo, email: user?.email })

    const saas = getIsSaaSClient()

    if (saas && tipoUtente === "cliente") {
      setError("Gli account cliente si usano dal sito della tua pizzeria (menu online), non da PizzaManager.")
      void supabase.auth.signOut()
      return
    }

    if (!saas && tipoUtente === "staff") {
      window.location.replace(getSaaSLoginUrl())
      return
    }

    if (tipoUtente === "cliente") {
      devLog("Login", "redirect → /cliente/dashboard")
      navigate("/cliente/dashboard", { replace: true })
      return
    }

    if (tipoUtente === "staff") {
      const roleRoutes = {
        superadmin: "/superadmin/ingresso",
        admin: ADMIN_TENANT_HOME,
        ...OPERATIVE_ROLE_HOME,
      }
      const ruoloNorm = (ruolo && typeof ruolo === "string") ? ruolo.toLowerCase().trim() : ""
      const targetRoute = roleRoutes[ruoloNorm] || "/operative/dashboard"

      devLog("Login", "redirect →", targetRoute, { ruolo })
      navigate(targetRoute, { replace: true })
      return
    }

    devLog("Login", "fallback redirect → /")
    navigate("/", { replace: true })
  }, [user, ruolo, tipoUtente, loading, navigate, location.state])

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
      setError(err.message || "Errore di accesso")
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
      } catch (_) {
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

  return (
    <div className="login-page">
      <div className="login-page-inner">
        <div className="login-card">
          <div className="login-brand">
            <div className="login-brand-mark" aria-hidden="true">
              🍕
            </div>
            <h1 className="login-brand-title">{isSaaS ? "PizzaManager" : "Accedi"}</h1>
            <p className="login-brand-sub">
              {isSaaS
                ? "Accesso per staff e operatori della piattaforma. Account cliente: usa il sito della tua pizzeria."
                : "Accedi con l’account cliente per questa pizzeria. Il personale accede da PizzaManager."}
            </p>
          </div>

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
              <input
                id="login-password"
                name="password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="login-input"
                required
              />
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

          <div className="login-footer-links">
            {!isSaaS ? (
              <>
                <Link to="/registrazione" className="login-back">
                  Crea account
                </Link>
                <Link to="/password-dimenticata" className="login-back">
                  Password dimenticata
                </Link>
              </>
            ) : (
              <p className="login-back" style={{ cursor: "default", textDecoration: "none", color: "#94a3b8", fontSize: 13 }}>
                Recupero password: solo sul sito della pizzeria (menu online).
              </p>
            )}
            <Link to="/" className="login-back">
              ← Torna alla home
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
