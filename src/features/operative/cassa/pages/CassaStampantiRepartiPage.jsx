import { useCallback, useEffect, useState } from "react"
import { Link, Navigate } from "react-router-dom"
import { useAuth } from "@/app/contexts/AuthContext"
import { useTenant } from "@/app/contexts/TenantContext"
import { useTenantServizi } from "@/app/hooks/useTenantServizi"
import { getTenantSettings, updateTenantSettings, getRuoliPizzeria } from "@/features/admin/services/adminService"
import {
  normalizeComandaRepartiStampanti,
  validateRepartiStampantiForSave,
  isValidIPv4,
} from "@/utils/comandaRepartiStampanti"

function newRow() {
  return {
    id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `rep-${Date.now()}`,
    nome: "",
    indirizzo_ip: "",
    porta: 9100,
  }
}

export default function CassaStampantiRepartiPage() {
  const { user, permessiAree } = useAuth()
  const { tenantId } = useTenant()
  const { hasServizio, enforcementActive } = useTenantServizi()
  const okCassa = permessiAree?.cassa === true

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [rows, setRows] = useState([])
  const [canEditParametri, setCanEditParametri] = useState(false)
  const [error, setError] = useState(null)
  const [savedOk, setSavedOk] = useState(false)

  const stampaManca = enforcementActive && !hasServizio("stampa_comanda")

  const load = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    setError(null)
    try {
      const s = await getTenantSettings(tenantId)
      const po = s?.parametri_operativi && typeof s.parametri_operativi === "object" ? s.parametri_operativi : {}
      const list = normalizeComandaRepartiStampanti(po.comanda_reparti_stampanti)
      setRows(list.length ? list.map((r) => ({ ...r, porta: r.porta || 9100 })) : [])
    } catch (e) {
      console.error(e)
      setError(e?.message ?? "Errore caricamento impostazioni.")
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [tenantId])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!tenantId || !user?.email) {
      setCanEditParametri(false)
      return
    }
    let c = false
    getRuoliPizzeria(tenantId)
      .then((list) => {
        if (c) return
        const me = (list || []).find((r) => r.email === user.email)
        setCanEditParametri(Boolean(me?.puo_modificare_parametri))
      })
      .catch(() => {
        if (!c) setCanEditParametri(false)
      })
    return () => {
      c = true
    }
  }, [tenantId, user?.email])

  const updateRow = (id, field, value) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)))
    setSavedOk(false)
  }

  const removeRow = (id) => {
    setRows((prev) => prev.filter((r) => r.id !== id))
    setSavedOk(false)
  }

  const addRow = () => {
    setRows((prev) => [...prev, newRow()])
    setSavedOk(false)
  }

  const handleSave = async () => {
    if (!tenantId || !canEditParametri) return
    const normalized = normalizeComandaRepartiStampanti(rows)
    const v = validateRepartiStampantiForSave(normalized)
    if (!v.ok) {
      setError(v.message)
      return
    }
    setError(null)
    setSaving(true)
    try {
      const s = await getTenantSettings(tenantId)
      const existing = s?.parametri_operativi && typeof s.parametri_operativi === "object" ? s.parametri_operativi : {}
      await updateTenantSettings(tenantId, {
        parametri_operativi: {
          ...existing,
          comanda_reparti_stampanti: normalized,
        },
      })
      setSavedOk(true)
      setRows(normalized)
    } catch (e) {
      console.error(e)
      setError(e?.message ?? "Salvataggio non riuscito.")
    } finally {
      setSaving(false)
    }
  }

  if (!okCassa) {
    return <Navigate to="/operative/cassa" replace />
  }

  return (
    <div style={{ maxWidth: 720 }}>
      <p style={{ margin: "0 0 12px 0" }}>
        <Link to="/operative/cassa" style={{ color: "#1565c0", fontSize: 14 }}>
          ← Torna a Cassa
        </Link>
      </p>

      <h1 className="dashboard-page-title" style={{ marginBottom: 8 }}>
        Stampanti per reparto
      </h1>
      <p style={{ color: "#64748b", fontSize: 14, lineHeight: 1.55, marginBottom: 16 }}>
        Associa ogni <strong>reparto</strong> (cucina, forno, bancone fritti, …) all&apos;
        <strong>indirizzo IP statico</strong> della stampante di rete (porta predefinita{" "}
        <code>9100</code>, RAW spesso usato dalle termiche). La stampa dal browser apre il dialogo di sistema: sul PC
        va creata una stampante che punti a quell&apos;IP; sulla comanda comparirà il reparto e l&apos;IP per scegliere la
        stampante corretta. Puoi anche usare <strong>«Stampa per reparto»</strong> in cassa per aprire una finestra di
        stampa per ogni riga configurata.
      </p>

      {stampaManca && (
        <div
          style={{
            marginBottom: 16,
            padding: 12,
            borderRadius: 8,
            background: "#fff8e1",
            border: "1px solid #ffcc80",
            fontSize: 13,
          }}
        >
          Il servizio <code>stampa_comanda</code> non risulta abilitato sul piano: la pagina resta utilizzabile, ma in
          produzione verifica catalogo servizi / piano tenant.
        </div>
      )}

      {loading ? (
        <p style={{ color: "#666" }}>Caricamento…</p>
      ) : (
        <>
          {error && (
            <div
              style={{
                marginBottom: 12,
                padding: 10,
                borderRadius: 8,
                background: "#ffebee",
                color: "#b71c1c",
                fontSize: 14,
              }}
            >
              {error}
            </div>
          )}
          {savedOk && (
            <div style={{ marginBottom: 12, fontSize: 14, color: "#2e7d32" }}>Salvato.</div>
          )}

          <div style={{ overflowX: "auto", border: "1px solid #e0e0e0", borderRadius: 8 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr style={{ background: "#f5f5f5", textAlign: "left" }}>
                  <th style={{ padding: "10px 12px", borderBottom: "1px solid #e0e0e0" }}>Reparto</th>
                  <th style={{ padding: "10px 12px", borderBottom: "1px solid #e0e0e0" }}>IP statico</th>
                  <th style={{ padding: "10px 12px", borderBottom: "1px solid #e0e0e0", width: 100 }}>Porta</th>
                  <th style={{ padding: "10px 12px", borderBottom: "1px solid #e0e0e0", width: 88 }} />
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ padding: 16, color: "#888" }}>
                      Nessun reparto. Aggiungi una riga per ogni stampante (es. Cucina → 192.168.1.50).
                    </td>
                  </tr>
                ) : (
                  rows.map((r) => {
                    const ipOk = !r.indirizzo_ip?.trim() || isValidIPv4(r.indirizzo_ip)
                    return (
                      <tr key={r.id}>
                        <td style={{ padding: "8px 12px", borderBottom: "1px solid #eee", verticalAlign: "middle" }}>
                          <input
                            type="text"
                            placeholder="es. Cucina"
                            value={r.nome}
                            disabled={!canEditParametri}
                            onChange={(e) => updateRow(r.id, "nome", e.target.value)}
                            style={{
                              width: "100%",
                              maxWidth: 220,
                              padding: "8px 10px",
                              borderRadius: 6,
                              border: "1px solid #ccc",
                              boxSizing: "border-box",
                            }}
                          />
                        </td>
                        <td style={{ padding: "8px 12px", borderBottom: "1px solid #eee", verticalAlign: "middle" }}>
                          <input
                            type="text"
                            placeholder="192.168.1.50"
                            value={r.indirizzo_ip}
                            disabled={!canEditParametri}
                            onChange={(e) => updateRow(r.id, "indirizzo_ip", e.target.value)}
                            style={{
                              width: "100%",
                              maxWidth: 200,
                              padding: "8px 10px",
                              borderRadius: 6,
                              border: ipOk ? "1px solid #ccc" : "1px solid #e53935",
                              boxSizing: "border-box",
                              fontFamily: "monospace",
                            }}
                          />
                        </td>
                        <td style={{ padding: "8px 12px", borderBottom: "1px solid #eee", verticalAlign: "middle" }}>
                          <input
                            type="number"
                            min={1}
                            max={65535}
                            value={r.porta}
                            disabled={!canEditParametri}
                            onChange={(e) =>
                              updateRow(r.id, "porta", Math.min(65535, Math.max(1, Number(e.target.value) || 9100)))
                            }
                            style={{
                              width: "100%",
                              padding: "8px 10px",
                              borderRadius: 6,
                              border: "1px solid #ccc",
                              boxSizing: "border-box",
                            }}
                          />
                        </td>
                        <td style={{ padding: "8px 12px", borderBottom: "1px solid #eee", verticalAlign: "middle" }}>
                          <button
                            type="button"
                            disabled={!canEditParametri}
                            onClick={() => removeRow(r.id)}
                            style={{
                              padding: "6px 10px",
                              fontSize: 13,
                              cursor: canEditParametri ? "pointer" : "not-allowed",
                              border: "1px solid #ddd",
                              borderRadius: 6,
                              background: "#fafafa",
                            }}
                          >
                            Rimuovi
                          </button>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 16, alignItems: "center" }}>
            <button
              type="button"
              disabled={!canEditParametri}
              onClick={addRow}
              style={{
                padding: "10px 16px",
                borderRadius: 8,
                border: "1px solid #1976d2",
                background: canEditParametri ? "#e3f2fd" : "#f5f5f5",
                color: "#0d47a1",
                fontWeight: 600,
                cursor: canEditParametri ? "pointer" : "not-allowed",
              }}
            >
              Aggiungi reparto
            </button>
            <button
              type="button"
              disabled={!canEditParametri || saving}
              onClick={() => void handleSave()}
              style={{
                padding: "10px 20px",
                borderRadius: 8,
                border: "none",
                background: canEditParametri ? "#1565c0" : "#bdbdbd",
                color: "#fff",
                fontWeight: 600,
                cursor: canEditParametri && !saving ? "pointer" : "not-allowed",
              }}
            >
              {saving ? "Salvataggio…" : "Salva"}
            </button>
            {!canEditParametri && (
              <span style={{ fontSize: 13, color: "#888" }}>
                Solo utenti con permesso «modifica parametri» in Ruoli pizzeria possono salvare.
              </span>
            )}
          </div>
        </>
      )}
    </div>
  )
}
