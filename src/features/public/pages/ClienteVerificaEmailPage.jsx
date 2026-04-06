import { useState } from "react"
import { Link } from "react-router-dom"
import { supabase } from "@/lib/supabaseClient"
import { useAuth } from "@/app/contexts/AuthContext"

export default function ClienteVerificaEmailPage() {
  const { user } = useAuth()
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)
  const [err, setErr] = useState(null)

  const resend = async () => {
    if (!user?.email) return
    setBusy(true)
    setErr(null)
    setMsg(null)
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: user.email,
        options: {
          emailRedirectTo: typeof window !== "undefined" ? `${window.location.origin}/` : undefined,
        },
      })
      if (error) throw error
      setMsg("Ti abbiamo reinviato l’email di conferma. Controlla anche lo spam.")
    } catch (e) {
      setErr(e?.message || "Invio non riuscito.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ maxWidth: 520, margin: "0 auto", padding: "32px 16px 48px" }}>
      <h1 style={{ fontSize: 22, marginBottom: 12 }}>Conferma la tua email</h1>
      <p style={{ fontSize: 15, color: "#475569", lineHeight: 1.6, marginBottom: 16 }}>
        Per ordinare online serve un account con email verificata. Abbiamo inviato un messaggio a{" "}
        <strong>{user?.email || "—"}</strong>: apri il link nell’email per attivare l’account.
      </p>
      {msg ? (
        <p style={{ padding: 12, background: "#ecfdf5", border: "1px solid #a7f3d0", borderRadius: 8, color: "#166534" }}>
          {msg}
        </p>
      ) : null}
      {err ? (
        <p style={{ padding: 12, background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, color: "#991b1b" }}>
          {err}
        </p>
      ) : null}
      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 20 }}>
        <button
          type="button"
          onClick={() => void resend()}
          disabled={busy}
          style={{
            padding: "12px 18px",
            borderRadius: 8,
            border: "1px solid #cbd5e1",
            background: busy ? "#e2e8f0" : "#fff",
            fontWeight: 600,
            cursor: busy ? "default" : "pointer",
          }}
        >
          {busy ? "Invio…" : "Reinvia email di conferma"}
        </button>
        <Link to="/" style={{ color: "#c0392b", fontWeight: 600 }}>
          ← Torna al menù
        </Link>
        <Link to="/login" style={{ color: "#64748b", fontWeight: 500 }}>
          Torna al login
        </Link>
      </div>
    </div>
  )
}
