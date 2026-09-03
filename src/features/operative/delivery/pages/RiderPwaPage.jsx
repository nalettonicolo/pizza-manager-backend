import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "@/app/contexts/AuthContext"
import DeliveryDashboard from "@/features/operative/delivery/pages/DeliveryDashboard"
import { riderSetNomeDisplay, riderEnsureMe } from "@/features/admin/services/adminService"
import { useTenant } from "@/app/contexts/TenantContext"

const RIDER_NAME_SESSION_KEY = "pm_rider_nome_confermato_v1"
const HEADER_COLOR = "#0f172a"

/**
 * Vista rider mobile-first: stesso flusso delivery, layout ottimizzato per smartphone / PWA.
 * Al login chiede il nome del pony (aggiorna core.rider.nome_display, così la cassa lo vede
 * sulla mappa live). Se l'utente non è un rider mappato o il nome non parte, non blocca l'uso.
 * Ogni pony ha il proprio account/login: un solo record rider per utente autenticato.
 */
export default function RiderPwaPage() {
  const navigate = useNavigate()
  const { logout } = useAuth()
  const { tenantId } = useTenant()
  const [nomeConfermato, setNomeConfermato] = useState("")

  const [askName, setAskName] = useState(false)
  const [nome, setNome] = useState("")
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)

  useEffect(() => {
    const prev = document.body.style.background
    document.body.style.background = "#f1f5f9"
    const link = document.createElement("link")
    link.rel = "manifest"
    link.href = "/manifest-rider.webmanifest"
    document.head.appendChild(link)
    return () => {
      document.body.style.background = prev
      link.remove()
    }
  }, [])

  useEffect(() => {
    try {
      const stored = window.sessionStorage.getItem(RIDER_NAME_SESSION_KEY)
      if (!stored) {
        setAskName(true)
      } else {
        if (stored === "1") {
          setAskName(true)
        } else {
          setNomeConfermato(stored)
          setAskName(false)
        }
      }
    } catch {
      setAskName(true)
    }
  }, [])

  useEffect(() => {
    if (!tenantId || !nomeConfermato) return undefined
    let cancelled = false
    ;(async () => {
      try {
        await riderEnsureMe(tenantId, nomeConfermato)
        await riderSetNomeDisplay(nomeConfermato)
      } catch {
        if (!cancelled) {
          /* il nome resta in sessione; il prossimo «In consegna» ritenta */
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [tenantId, nomeConfermato])

  const confirmNome = async () => {
    const value = nome.trim()
    if (!value) return
    setSaving(true)
    setSaveError(null)
    try {
      if (tenantId) {
        await riderEnsureMe(tenantId, value)
      }
      await riderSetNomeDisplay(value)
      try {
        window.sessionStorage.setItem(RIDER_NAME_SESSION_KEY, value)
      } catch {
        /* storage non disponibile: rimane solo lo stato in memoria */
      }
      setNomeConfermato(value)
      setAskName(false)
    } catch (err) {
      setSaveError(err?.message || "Impossibile salvare il nome. Riprova.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rider-pwa-root">
      <header className="rider-pwa-header" style={{ background: HEADER_COLOR }}>
        <strong style={{ fontSize: 16 }}>
          {nomeConfermato || "In consegna"}
        </strong>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            type="button"
            onClick={() => void logout().then(() => navigate("/login", { replace: true }))}
            style={{
              border: "1px solid rgba(255,255,255,0.45)",
              background: "transparent",
              color: "#fff",
              fontWeight: 700,
              fontSize: 12,
              padding: "6px 10px",
              borderRadius: 8,
              cursor: "pointer",
            }}
          >
            Esci
          </button>
        </div>
      </header>

      {askName ? (
        <div
          role="dialog"
          aria-labelledby="rider-name-title"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            background: "rgba(15,23,42,0.72)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
        >
          <div style={{ width: "100%", maxWidth: 360, background: "#fff", borderRadius: 14, padding: 20 }}>
            <h2 id="rider-name-title" style={{ margin: "0 0 6px", fontSize: 18 }}>
              Chi è in consegna?
            </h2>
            <p style={{ margin: "0 0 14px", fontSize: 13, color: "#64748b", lineHeight: 1.5 }}>
              Scrivi il tuo nome: comparirà sul motorino nella mappa della cassa, così sanno sempre chi sei.
            </p>
            <input
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && confirmNome()}
              placeholder="Es. Marco"
              autoFocus
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: "12px 14px",
                fontSize: 16,
                borderRadius: 10,
                border: "1px solid #cbd5e1",
                marginBottom: 12,
              }}
            />
            {saveError ? (
              <p style={{ margin: "0 0 12px", color: "#b91c1c", fontSize: 13 }}>{saveError}</p>
            ) : null}
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                onClick={confirmNome}
                disabled={saving || !nome.trim()}
                style={{
                  flex: 1,
                  padding: "12px 14px",
                  fontSize: 15,
                  fontWeight: 700,
                  color: "#fff",
                  background: saving || !nome.trim() ? "#94a3b8" : "#1d4ed8",
                  border: "none",
                  borderRadius: 10,
                  cursor: saving || !nome.trim() ? "default" : "pointer",
                }}
              >
                {saving ? "Salvo…" : "Inizio il turno"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <DeliveryDashboard riderView ponyNome={nomeConfermato} />
    </div>
  )
}
