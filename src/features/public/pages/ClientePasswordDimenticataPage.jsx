import { useState } from "react"
import { Link } from "react-router-dom"
import { requestClientePasswordReset } from "@/features/public/services/clienteAuthService"
import "@/styles/login.css"

export default function ClientePasswordDimenticataPage() {
  const [email, setEmail] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [sent, setSent] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      const { error: err } = await requestClientePasswordReset(email)
      if (err) {
        setError(err.message || "Invio non riuscito.")
        return
      }
      setSent(true)
    } catch (ex) {
      setError(ex?.message || "Errore imprevisto.")
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
              🔑
            </div>
            <h1 className="login-brand-title">Password dimenticata</h1>
            <p className="login-brand-sub">
              Solo per <strong>account cliente</strong> di questa pizzeria. Riceverai un link per impostare una nuova password
              (controlla anche lo spam).
            </p>
          </div>

          {sent ? (
            <p style={{ fontSize: 15, color: "#166534", lineHeight: 1.5 }}>
              Se l’indirizzo è registrato, abbiamo inviato le istruzioni. Apri il link sullo stesso sito della pizzeria.
            </p>
          ) : (
            <form className="login-form" onSubmit={handleSubmit} noValidate>
              <div className="login-field">
                <label className="login-label" htmlFor="rec-email">
                  Email
                </label>
                <input
                  id="rec-email"
                  type="email"
                  className="login-input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>
              {error ? (
                <p className="login-error" role="alert">
                  {error}
                </p>
              ) : null}
              <button type="submit" className="login-submit" disabled={busy}>
                {busy ? "Invio…" : "Invia link"}
              </button>
            </form>
          )}

          <div className="login-footer-links">
            <Link to="/login" className="login-back">
              ← Torna al login
            </Link>
            <Link to="/" className="login-back">
              Menù
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
