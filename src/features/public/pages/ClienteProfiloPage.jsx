import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { supabase } from "@/lib/supabaseClient"
import { useAuth } from "@/app/contexts/AuthContext"
import Loader from "@/components/feedback/Loader"
import { getIsSaaSClient } from "@/utils/saasHost"
import { getPublicTenantInfo } from "@/features/services/publicService"
import { updateClienteProfilo, getClienteFidelityProfile } from "@/features/public/services/clienteAuthService"
import ClienteIndirizzoMappaField from "@/features/public/components/ClienteIndirizzoMappaField"
import "@/styles/login.css"

export default function ClienteProfiloPage() {
  const { user } = useAuth()
  const [tenant, setTenant] = useState(null)
  const [row, setRow] = useState(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)
  const [fidelity, setFidelity] = useState(null)
  const [form, setForm] = useState({
    nome: "",
    telefono: "",
    indirizzo: "",
    noteConsegna: "",
    coords: null,
  })

  useEffect(() => {
    getPublicTenantInfo().then((t) => setTenant(t && typeof t === "object" ? t : null))
  }, [])

  useEffect(() => {
    if (!user?.id) {
      setLoading(false)
      return
    }
    let c = false
    supabase
      .from("clienti")
      .select("nome, email, telefono, indirizzo, note_consegna, latitudine, longitudine, tenant_id")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!c) {
          if (!error && data) {
            setRow(data)
            const lat = data.latitudine != null ? Number(data.latitudine) : null
            const lng = data.longitudine != null ? Number(data.longitudine) : null
            setForm({
              nome: data.nome || "",
              telefono: data.telefono || "",
              indirizzo: data.indirizzo || "",
              noteConsegna: data.note_consegna || "",
              coords:
                Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null,
            })
          }
          setLoading(false)
        }
      })
    return () => {
      c = true
    }
  }, [user?.id])

  useEffect(() => {
    if (!user?.id) return
    let c = false
    getClienteFidelityProfile().then(({ data }) => {
      if (!c && data) setFidelity(data)
    })
    return () => {
      c = true
    }
  }, [user?.id])

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    setMessage(null)
    const { error } = await updateClienteProfilo({
      nome: form.nome,
      telefono: form.telefono,
      indirizzo: form.indirizzo,
      noteConsegna: form.noteConsegna,
      latitudine: form.coords?.lat ?? null,
      longitudine: form.coords?.lng ?? null,
    })
    setSaving(false)
    if (error) {
      setMessage({ type: "error", text: error.message || "Salvataggio non riuscito." })
      return
    }
    setRow((prev) =>
      prev
        ? {
            ...prev,
            nome: form.nome.trim(),
            telefono: form.telefono.trim(),
            indirizzo: form.indirizzo.trim(),
            note_consegna: form.noteConsegna.trim(),
            latitudine: form.coords?.lat ?? null,
            longitudine: form.coords?.lng ?? null,
          }
        : prev,
    )
    setEditing(false)
    setMessage({ type: "ok", text: "Profilo aggiornato." })
  }

  if (loading) return <Loader />

  return (
    <div style={{ maxWidth: 560, margin: "0 auto", padding: "24px 16px 48px" }}>
      <h1 style={{ fontSize: 22, marginBottom: 16 }}>Profilo</h1>

      {message ? (
        <p
          role="status"
          style={{
            margin: "0 0 16px",
            padding: "10px 12px",
            borderRadius: 8,
            fontSize: 14,
            background: message.type === "ok" ? "#ecfdf5" : "#fef2f2",
            color: message.type === "ok" ? "#166534" : "#b91c1c",
            border: `1px solid ${message.type === "ok" ? "#bbf7d0" : "#fecaca"}`,
          }}
        >
          {message.text}
        </p>
      ) : null}

      <dl style={{ fontSize: 14, lineHeight: 1.7, marginBottom: editing ? 16 : 24 }}>
        <dt style={{ color: "#64748b", fontWeight: 600 }}>Email (accesso)</dt>
        <dd style={{ margin: "0 0 12px" }}>{user?.email || row?.email || "—"}</dd>
      </dl>

      {editing ? (
        <form onSubmit={handleSave} className="login-form" style={{ marginBottom: 24 }}>
          <label className="login-label">
            Nome
            <input
              className="login-input"
              value={form.nome}
              onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
              autoComplete="name"
            />
          </label>
          <label className="login-label">
            Telefono
            <input
              className="login-input"
              type="tel"
              value={form.telefono}
              onChange={(e) => setForm((f) => ({ ...f, telefono: e.target.value }))}
              autoComplete="tel"
            />
          </label>
          <div className="login-field">
            <ClienteIndirizzoMappaField
              tenant={tenant}
              indirizzo={form.indirizzo}
              onIndirizzoChange={(v) => setForm((f) => ({ ...f, indirizzo: v }))}
              coords={form.coords}
              onCoordsChange={(coords) => setForm((f) => ({ ...f, coords }))}
              inputId="profilo-indirizzo"
            />
          </div>
          <label className="login-label">
            Note per la consegna
            <textarea
              className="login-input login-textarea"
              rows={3}
              value={form.noteConsegna}
              onChange={(e) => setForm((f) => ({ ...f, noteConsegna: e.target.value }))}
              placeholder="Citofono, piano, campanello…"
            />
          </label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
            <button type="submit" className="login-submit" disabled={saving}>
              {saving ? "Salvataggio…" : "Salva"}
            </button>
            <button
              type="button"
              className="login-submit"
              style={{ background: "#64748b" }}
              disabled={saving}
              onClick={() => {
                setEditing(false)
                const lat = row?.latitudine != null ? Number(row.latitudine) : null
                const lng = row?.longitudine != null ? Number(row.longitudine) : null
                setForm({
                  nome: row?.nome || "",
                  telefono: row?.telefono || "",
                  indirizzo: row?.indirizzo || "",
                  noteConsegna: row?.note_consegna || "",
                  coords:
                    Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null,
                })
              }}
            >
              Annulla
            </button>
          </div>
        </form>
      ) : (
        <>
          <dl style={{ fontSize: 14, lineHeight: 1.7, marginBottom: 16 }}>
            <dt style={{ color: "#64748b", fontWeight: 600 }}>Nome</dt>
            <dd style={{ margin: "0 0 12px" }}>{row?.nome || "—"}</dd>
            <dt style={{ color: "#64748b", fontWeight: 600 }}>Telefono</dt>
            <dd style={{ margin: "0 0 12px" }}>{row?.telefono || "—"}</dd>
            <dt style={{ color: "#64748b", fontWeight: 600 }}>Indirizzo</dt>
            <dd style={{ margin: "0 0 12px" }}>{row?.indirizzo || "—"}</dd>
            <dt style={{ color: "#64748b", fontWeight: 600 }}>Note consegna</dt>
            <dd style={{ margin: "0 0 12px", whiteSpace: "pre-wrap" }}>{row?.note_consegna || "—"}</dd>
          </dl>
          <button
            type="button"
            className="login-submit"
            style={{ marginBottom: 16, width: "auto", padding: "10px 20px" }}
            onClick={() => setEditing(true)}
          >
            Modifica profilo
          </button>
        </>
      )}

      {fidelity?.attivo ? (
        <section
          style={{
            marginBottom: 24,
            padding: 16,
            borderRadius: 10,
            border: "1px solid #bbf7d0",
            background: "#f0fdf4",
          }}
        >
          <h2 style={{ margin: "0 0 8px", fontSize: 16, color: "#14532d" }}>Fedeltà</h2>
          <p style={{ margin: 0, fontSize: 24, fontWeight: 700, color: "#166534" }}>
            {Number(fidelity.punti ?? 0)} punti
          </p>
          {fidelity.codice_carta ? (
            <p style={{ margin: "8px 0 0", fontSize: 13, color: "#15803d" }}>
              Tessera: <strong>{fidelity.codice_carta}</strong>
            </p>
          ) : null}
          {Array.isArray(fidelity.movimenti) && fidelity.movimenti.length > 0 ? (
            <ul style={{ margin: "12px 0 0", paddingLeft: 18, fontSize: 13, color: "#166534" }}>
              {fidelity.movimenti.slice(0, 8).map((m, i) => (
                <li key={`${m.created_at}-${i}`}>
                  {m.punti > 0 ? "+" : ""}
                  {m.punti} pt — {m.tipo || "movimento"}
                  {m.created_at
                    ? ` (${new Date(m.created_at).toLocaleDateString("it-IT")})`
                    : ""}
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      <p style={{ fontSize: 13, color: "#94a3b8", marginBottom: 16 }}>
        Per cambiare l’email di accesso contatta la pizzeria.
        {!getIsSaaSClient() ? (
          <>
            {" "}
            La password si reimposta da <Link to="/password-dimenticata">Password dimenticata</Link>.
          </>
        ) : null}
      </p>
      <Link to="/cliente/dashboard" style={{ color: "#c0392b", fontWeight: 600 }}>
        ← Torna all’area cliente
      </Link>
    </div>
  )
}
