import { useEffect, useMemo, useState } from "react"
import { Link, useLocation } from "react-router-dom"
import { getPublicTenantInfo } from "@/features/services/publicService"
import { signUpCliente, iscriviClienteFidelity } from "@/features/public/services/clienteAuthService"
import ClienteIndirizzoMappaField from "@/features/public/components/ClienteIndirizzoMappaField"
import Loader from "@/components/feedback/Loader"
import ErrorState from "@/components/feedback/ErrorState"
import {
  readFidelityNomeProgramma,
  readFidelityProgrammaAttivo,
} from "@/utils/fidelityProgramConfig"
import { resolveClienteVetrinaPath } from "@/utils/clienteVetrinaPath"
import { isDemoGiroSearch } from "@/utils/demoGiro"
import "@/styles/login.css"

export default function ClienteRegistrazionePage() {
  const location = useLocation()
  const [tenant, setTenant] = useState(null)
  const [loadingTenant, setLoadingTenant] = useState(true)
  const [tenantError, setTenantError] = useState(null)

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [nome, setNome] = useState("")
  const [telefono, setTelefono] = useState("")
  const [indirizzo, setIndirizzo] = useState("")
  const [coords, setCoords] = useState(null)
  const [noteConsegna, setNoteConsegna] = useState("")
  const [iscriviFidelity, setIscriviFidelity] = useState(true)
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [doneMessage, setDoneMessage] = useState(null)

  const parametri = useMemo(
    () =>
      tenant?.parametri_operativi && typeof tenant.parametri_operativi === "object"
        ? tenant.parametri_operativi
        : {},
    [tenant?.parametri_operativi],
  )
  const fidelityAttivo = readFidelityProgrammaAttivo(parametri)
  const fidelityNome = readFidelityNomeProgramma(parametri, tenant?.nome)
  const inDemo = isDemoGiroSearch(location.search)
  const menuTo = resolveClienteVetrinaPath(location.search)
  const loginTo = `/login${location.search || ""}${location.search ? "&" : "?"}cliente=1`

  useEffect(() => {
    let c = false
    ;(async () => {
      try {
        setLoadingTenant(true)
        setTenantError(null)
        const t = await getPublicTenantInfo({ search: location.search })
        if (!c) {
          if (!t?.id) {
            setTenantError(
              inDemo
                ? "Imposta support_tenant (o tenant) nell’URL demo per aprire la registrazione del locale."
                : "Impossibile identificare la pizzeria da questo dominio.",
            )
          } else setTenant(t)
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
  }, [location.search, inDemo])

  useEffect(() => {
    if (!fidelityAttivo) setIscriviFidelity(false)
    else setIscriviFidelity(true)
  }, [fidelityAttivo, tenant?.id])

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
      const wantFidelity = Boolean(fidelityAttivo && iscriviFidelity)
      const { data, error: err } = await signUpCliente({
        email,
        password,
        tenantId: tenant.id,
        nome,
        telefono,
        indirizzo,
        latitudine: coords?.lat ?? null,
        longitudine: coords?.lng ?? null,
        noteConsegna,
        iscriviFidelity: wantFidelity,
      })
      if (err) {
        setError(err.message || "Registrazione non riuscita.")
        return
      }
      if (data?.session) {
        let fidelityNote = ""
        if (wantFidelity) {
          const { data: fid, error: fidErr } = await iscriviClienteFidelity()
          if (fidErr) {
            fidelityNote =
              " Account creato; l’iscrizione fidelity si può completare dal profilo."
          } else if (fid?.codice_carta) {
            fidelityNote = ` Tessera fidelity: ${fid.codice_carta}.`
          } else {
            fidelityNote = " Iscrizione al programma fedeltà completata."
          }
        }
        setDoneMessage(`Account creato.${fidelityNote} Reindirizzamento al menù…`)
        window.location.assign(menuTo)
        return
      }
      setDoneMessage(
        wantFidelity
          ? "Ti abbiamo inviato un’email di conferma. Dopo l’attivazione, al primo accesso potrai completare l’iscrizione al programma fedeltà dal profilo."
          : "Ti abbiamo inviato un’email di conferma. Apri il link per attivare l’account, poi accedi da Login.",
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
    <div className="login-page login-page--top">
      <div className="login-page-inner login-page-inner--wide">
        <div className="login-card">
          <div className="login-brand">
            <div className="login-brand-mark" aria-hidden="true">
              🍕
            </div>
            <h1 className="login-brand-title">Crea il tuo account</h1>
            <p className="login-brand-sub">
              Ordini e profilo per <strong>{tenant.nome || "la pizzeria"}</strong>. Dopo la registrazione potrai accedere al
              menù e completare gli ordini online.
            </p>
            {inDemo ? (
              <p
                className="login-brand-sub"
                style={{
                  marginTop: 10,
                  padding: "10px 12px",
                  borderRadius: 8,
                  background: "#eff6ff",
                  border: "1px solid #bfdbfe",
                  color: "#1e3a8a",
                  fontSize: 13,
                }}
              >
                Demo · stai vedendo il form di registrazione del cliente sul locale{" "}
                <strong>{tenant.nome || "selezionato"}</strong>
                {fidelityAttivo ? `, con iscrizione opzionale a ${fidelityNome}` : ""}.
              </p>
            ) : null}
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
                <ClienteIndirizzoMappaField
                  tenant={tenant}
                  indirizzo={indirizzo}
                  onIndirizzoChange={setIndirizzo}
                  coords={coords}
                  onCoordsChange={setCoords}
                  inputId="reg-ind"
                  label="Indirizzo (utile per consegne)"
                />
              </div>
              <div className="login-field">
                <label className="login-label" htmlFor="reg-note">
                  Note per la consegna
                </label>
                <textarea
                  id="reg-note"
                  className="login-input login-textarea"
                  value={noteConsegna}
                  onChange={(e) => setNoteConsegna(e.target.value)}
                  placeholder="Es. codice citofono, piano, scala, lasciare al portiere, campanello non funzionante…"
                  rows={3}
                  maxLength={500}
                />
                <p className="login-brand-sub" style={{ fontSize: 12, marginTop: 6, lineHeight: 1.45 }}>
                  Informazioni utili al rider: accesso al palazzo, citofono, orari particolari o altre istruzioni per il
                  recapito.
                </p>
              </div>
              <div className="login-field">
                <label className="login-label" htmlFor="reg-pw">
                  Password
                </label>
                <div style={{ position: "relative" }}>
                  <input
                    id="reg-pw"
                    type={showPassword ? "text" : "password"}
                    className="login-input"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    autoComplete="new-password"
                    style={{ paddingRight: 44 }}
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
              {fidelityAttivo ? (
                <div
                  className="login-field"
                  style={{
                    padding: "12px 14px",
                    borderRadius: 10,
                    border: "1px solid #e9d5ff",
                    background: "linear-gradient(135deg, #faf5ff 0%, #f3e8ff 100%)",
                  }}
                >
                  <label
                    htmlFor="reg-fidelity"
                    style={{
                      display: "flex",
                      gap: 10,
                      alignItems: "flex-start",
                      cursor: "pointer",
                      margin: 0,
                    }}
                  >
                    <input
                      id="reg-fidelity"
                      type="checkbox"
                      checked={iscriviFidelity}
                      onChange={(e) => setIscriviFidelity(e.target.checked)}
                      style={{ marginTop: 3, width: 18, height: 18, flexShrink: 0 }}
                    />
                    <span>
                      <strong style={{ display: "block", fontSize: 14, color: "#5b21b6", marginBottom: 4 }}>
                        Iscrivimi a {fidelityNome}
                      </strong>
                      <span style={{ fontSize: 13, color: "#6b21a8", lineHeight: 1.45 }}>
                        Guadagni punti o timbri sugli ordini del locale. Puoi disattivare la casella se preferisci
                        non iscriverti ora.
                      </span>
                    </span>
                  </label>
                </div>
              ) : null}
              {error ? (
                <p className="login-error" role="alert">
                  {error}
                </p>
              ) : null}
              <p className="login-brand-sub" style={{ fontSize: 13, color: "#64748b", marginBottom: 12, lineHeight: 1.5 }}>
                Registrandoti confermi di aver letto l&apos;{" "}
                <Link to="/privacy" style={{ color: "#c0392b", fontWeight: 600 }}>
                  informativa sulla privacy
                </Link>{" "}
                e la{" "}
                <Link to="/cookie" style={{ color: "#c0392b", fontWeight: 600 }}>
                  cookie policy
                </Link>
                . Ti invieremo un&apos;email per confermare l&apos;indirizzo prima di poter ordinare online.
              </p>
              <button type="submit" className="login-submit" disabled={busy}>
                {busy ? "Registrazione…" : "Registrati"}
              </button>
            </form>
          )}

          <div className="login-footer-links">
            <Link to={loginTo} className="login-back">
              Hai già un account? Accedi
            </Link>
            <Link to={menuTo} className="login-back">
              ← Menù
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
