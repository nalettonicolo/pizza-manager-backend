import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { getPublicTenantInfo } from "@/features/services/publicService"
import { signUpCliente } from "@/features/public/services/clienteAuthService"
import Loader from "@/components/feedback/Loader"
import ErrorState from "@/components/feedback/ErrorState"
import "@/styles/login.css"

export default function ClienteRegistrazionePage() {
  const [tenant, setTenant] = useState(null)
  const [loadingTenant, setLoadingTenant] = useState(true)
  const [tenantError, setTenantError] = useState(null)

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [nome, setNome] = useState("")
  const [telefono, setTelefono] = useState("")
  const [indirizzo, setIndirizzo] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [doneMessage, setDoneMessage] = useState(null)

  useEffect(() => {
    let c = false
    ;(async () => {
      try {
        setLoadingTenant(true)
        setTenantError(null)
        const t = await getPublicTenantInfo()
        if (!c) {
          if (!t?.id) setTenantError("Impossibile identificare la pizzeria da questo dominio.")
          else setTenant(t)
        }
      } catch (e) {
        if (!c) setTenantError(e?.message || "Errore caricamento.")
      } finally {
        if (!c) setLoadingTenant(false)
      }
    })()
    return () => {
      c = true
    }
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setDoneMessage(null)
    if (!tenant?.id) return
    if (password.length < 6) {
      setError("La password deve avere almeno 6 caratteri.")
      return
    }
    setBusy(true)
    try {
      const { data, error: err } = await signUpCliente({
        email,
        password,
        tenantId: tenant.id,
        nome,
        telefono,
        indirizzo,
      })
      if (err) {
        setError(err.message || "Registrazione non riuscita.")
        return
      }
      if (data?.session) {
        setDoneMessage("Account creato. Reindirizzamento…")
        window.location.assign("/cliente/dashboard")
        return
      }
      setDoneMessage(
        "Ti abbiamo inviato un’email di conferma. Apri il link per attivare l’account, poi accedi da Login.",
      )
    } catch (ex) {
      setError(ex?.message || "Errore imprevisto.")
    } finally {
      setBusy(false)
    }
  }

  if (loadingTenant) return <Loader />
  if (tenantError) return <ErrorState message={tenantError} />
  if (!tenant) return <ErrorState message="Tenant non disponibile." />

  return (
    <div className="login-page">
      <div className="login-page-inner">
        <div className="login-card">
          <div className="login-brand">
            <div className="login-brand-mark" aria-hidden="true">
              🍕
            </div>
            <h1 className="login-brand-title">Crea il tuo account</h1>
            <p className="login-brand-sub">
              Ordini e profilo per <strong>{tenant.nome || "la pizzeria"}</strong>. Dopo la registrazione potrai accedere al
              menu e (in seguito) completare gli ordini online.
            </p>
          </div>

          {doneMessage ? (
            <p className="login-error" style={{ color: "#166534", background: "#ecfdf5", border: "1px solid #a7f3d0" }}>
              {doneMessage}
            </p>
          ) : (
            <form className="login-form" onSubmit={handleSubmit} noValidate>
              <div className="login-field">
                <label className="login-label" htmlFor="reg-nome">
                  Nome e cognome
                </label>
                <input
                  id="reg-nome"
                  className="login-input"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  autoComplete="name"
                />
              </div>
              <div className="login-field">
                <label className="login-label" htmlFor="reg-email">
                  Email
                </label>
                <input
                  id="reg-email"
                  type="email"
                  className="login-input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>
              <div className="login-field">
                <label className="login-label" htmlFor="reg-tel">
                  Telefono
                </label>
                <input
                  id="reg-tel"
                  type="tel"
                  className="login-input"
                  value={telefono}
                  onChange={(e) => setTelefono(e.target.value)}
                  autoComplete="tel"
                />
              </div>
              <div className="login-field">
                <label className="login-label" htmlFor="reg-ind">
                  Indirizzo (utile per consegne)
                </label>
                <input
                  id="reg-ind"
                  className="login-input"
                  value={indirizzo}
                  onChange={(e) => setIndirizzo(e.target.value)}
                  autoComplete="street-address"
                />
              </div>
              <div className="login-field">
                <label className="login-label" htmlFor="reg-pw">
                  Password
                </label>
                <input
                  id="reg-pw"
                  type="password"
                  className="login-input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
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
                {busy ? "Registrazione…" : "Registrati"}
              </button>
            </form>
          )}

          <div className="login-footer-links">
            <Link to="/login" className="login-back">
              Hai già un account? Accedi
            </Link>
            <Link to="/" className="login-back">
              ← Menù
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
