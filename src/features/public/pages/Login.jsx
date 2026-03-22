// 📍 src/features/public/pages/Login.jsx

import { useState, useEffect } from "react"
import { Link, useNavigate } from "react-router-dom"
import { useAuth } from "@/app/contexts/AuthContext"
import { devLog } from "@/lib/devLog"
import "@/styles/login.css"

export default function Login() {
  const { login, ruolo, tipoUtente, user, loading } = useAuth()
  const navigate = useNavigate()

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [noProfileError, setNoProfileError] = useState(false)

  useEffect(() => {
    if (loading) return
    if (!user || !tipoUtente) return

    devLog("Login", "redirect check", { tipoUtente, ruolo, email: user?.email })

    if (tipoUtente === "cliente") {
      devLog("Login", "redirect → /cliente/dashboard")
      navigate("/cliente/dashboard", { replace: true })
      return
    }

    if (tipoUtente === "staff") {
      const roleRoutes = {
        superadmin: "/superadmin/dashboard",
        admin: "/admin/dashboard",
        operatore: "/operative/dashboard",
        cassa: "/operative/cassa",
        bancone: "/operative/bancone",
        cucina: "/operative/cucina",
        pizzaiolo: "/operative/dashboard",
        delivery: "/operative/delivery",
        pony: "/operative/pony",
      }
      const ruoloNorm = (ruolo && typeof ruolo === "string") ? ruolo.toLowerCase().trim() : ""
      const targetRoute = roleRoutes[ruoloNorm] || "/operative/dashboard"

      devLog("Login", "redirect →", targetRoute, { ruolo })
      navigate(targetRoute, { replace: true })
      return
    }

    devLog("Login", "fallback redirect → /")
    navigate("/", { replace: true })
  }, [user, ruolo, tipoUtente, loading, navigate])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setNoProfileError(false)
    setSubmitting(true)
    devLog("Login", "submit", { email })

    const result = await login(email, password)
    const err = result?.error

    if (err) {
      devLog("Login", "submit error", err.message)
      setError(err.message || "Errore di accesso")
    } else {
      devLog("Login", "submit ok, in attesa redirect", { userId: result?.data?.user?.id })
    }
    setSubmitting(false)
  }

  useEffect(() => {
    if (!loading && user && tipoUtente === null && ruolo === null) {
      setNoProfileError(true)
    } else {
      setNoProfileError(false)
    }
  }, [loading, user, tipoUtente, ruolo])

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
            <h1 className="login-brand-title">PizzaManager</h1>
            <p className="login-brand-sub">
              Accedi con le credenziali del tuo account staff o cliente.
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
            {noProfileError && (
              <p className="login-warning" role="status">
                Accesso effettuato ma nessun profilo attivo. Verifica in Supabase che il tuo utente sia presente in{" "}
                <code>public.utenti_ruoli</code> (campo <code>ruolo</code>, es. <code>superadmin</code>) con il tuo{" "}
                <code>user_id</code>.
              </p>
            )}

            <button type="submit" className="login-submit" disabled={submitting}>
              {submitting ? "Accesso in corso…" : "Accedi"}
            </button>
          </form>

          <div className="login-footer-links">
            <Link to="/" className="login-back">
              ← Torna alla home
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
