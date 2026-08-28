import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { supabase } from "@/lib/supabaseClient"
import { useAuth } from "@/app/contexts/AuthContext"
import { translateAuthError } from "@/utils/translateAuthError"
import "@/styles/login.css"

export default function ClienteReimpostaPasswordPage() {
  const { updatePassword } = useAuth()
  const [ready, setReady] = useState(false)
  const [password, setPassword] = useState("")
  const [password2, setPassword2] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [ok, setOk] = useState(false)

  useEffect(() => {
    let cancelled = false
    supabase.auth.getSession().then(({ data }) => {
      if (!cancelled && data?.session) setReady(true)
    })
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled) return
      if (event === "PASSWORD_RECOVERY" || session) setReady(true)
    })
    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    if (password.length < 6) {
      setError("La password deve avere almeno 6 caratteri.")
      return
    }
    if (password !== password2) {
      setError("Le password non coincidono.")
      return
    }
    setBusy(true)
    try {
      const { error: err } = await updatePassword(password)
      if (err) {
        setError(translateAuthError(err, "Aggiornamento non riuscito."))
        return
      }
      setOk(true)
    } catch (ex) {
      setError(translateAuthError(ex, "Errore imprevisto."))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-page-inner">
        <div className="login-card">
          <div className="login-brand">
            <div className="login-brand-mark" aria-hidden="true">
              🔒
            </div>
            <h1 className="login-brand-title">Nuova password</h1>
            <p className="login-brand-sub">Imposta una nuova password per il tuo account cliente.</p>
          </div>

          {!ready ? (
            <p className="text-gray-500 text-sm">Verifica link in corso…</p>
          ) : ok ? (
            <p style={{ color: "#166534", fontSize: 15 }}>
              Password aggiornata. <Link to="/login">Accedi</Link>
            </p>
          ) : (
            <form className="login-form" onSubmit={handleSubmit} noValidate>
              <div className="login-field">
                <label className="login-label" htmlFor="npw1">
                  Nuova password
                </label>
                <input
                  id="npw1"
                  type="password"
                  className="login-input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  autoComplete="new-password"
                />
              </div>
              <div className="login-field">
                <label className="login-label" htmlFor="npw2">
                  Ripeti password
                </label>
                <input
                  id="npw2"
                  type="password"
                  className="login-input"
                  value={password2}
                  onChange={(e) => setPassword2(e.target.value)}
                  required
                  minLength={6}
                  autoComplete="new-password"
                />
              </div>
              {error ? (
                <p className="login-error" role="alert">
                  {error}
                </p>
              ) : null}
              <button type="submit" className="login-submit" disabled={busy}>
                {busy ? "Salvataggio…" : "Salva password"}
              </button>
            </form>
          )}

          <div className="login-footer-links">
            <Link to="/login" className="login-back">
              ← Login
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
