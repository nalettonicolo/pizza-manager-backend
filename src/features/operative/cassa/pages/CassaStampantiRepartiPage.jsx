import { useCallback, useEffect, useState } from "react"
import { Link, Navigate } from "react-router-dom"
import { useAuth } from "@/app/contexts/AuthContext"
import { useTenant } from "@/app/contexts/TenantContext"
import { useTenantServizi } from "@/app/hooks/useTenantServizi"
import { useOperativeSaDemoAccess } from "@/app/hooks/useOperativeSaDemoAccess"
import { getTenantSettings, updateTenantSettings, getRuoliPizzeria } from "@/features/admin/services/adminService"
import {
  normalizeComandaRepartiStampanti,
  validateRepartiStampantiForSave,
  isValidIPv4,
  formatRepartoStampanteDest,
} from "@/utils/comandaRepartiStampanti"
import { printComandaStampanteTest } from "@/features/operative/cassa/utils/printComanda"

function newRow() {
  return {
    id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `rep-${Date.now()}`,
    nome: "",
    tipo_connessione: "usb",
    indirizzo_ip: "",
    porta: 9100,
    nome_dispositivo: "",
  }
}

const inputBase = {
  width: "100%",
  padding: "8px 10px",
  borderRadius: 6,
  border: "1px solid #ccc",
  boxSizing: "border-box",
}

export default function CassaStampantiRepartiPage() {
  const { user, permessiAree } = useAuth()
  const { tenantId, tenantData } = useTenant()
  const { hasServizio, enforcementActive } = useTenantServizi()
  const { permessiAreeEffective, canEditParametri: canEditParametriFn, fullDemoAccess } =
    useOperativeSaDemoAccess()
  const okCassa = fullDemoAccess || permessiAreeEffective?.cassa === true || permessiAree?.cassa === true

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [rows, setRows] = useState([])
  const [staffPuoModificare, setStaffPuoModificare] = useState(false)
  const [error, setError] = useState(null)
  const [savedOk, setSavedOk] = useState(false)
  const [testHint, setTestHint] = useState(null)

  const canEditParametri = canEditParametriFn(staffPuoModificare)
  const stampaManca = !fullDemoAccess && enforcementActive && !hasServizio("stampa_comanda")

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
      setStaffPuoModificare(false)
      return
    }
    if (fullDemoAccess) {
      setStaffPuoModificare(true)
      return
    }
    let c = false
    getRuoliPizzeria(tenantId)
      .then((list) => {
        if (c) return
        const me = (list || []).find((r) => r.email === user.email)
        setStaffPuoModificare(Boolean(me?.puo_modificare_parametri))
      })
      .catch(() => {
        if (!c) setStaffPuoModificare(false)
      })
    return () => {
      c = true
    }
  }, [tenantId, user?.email, fullDemoAccess])

  const updateRow = (id, field, value) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r
        const next = { ...r, [field]: value }
        if (field === "tipo_connessione") {
          if (value === "usb") {
            next.indirizzo_ip = ""
            next.porta = 9100
          } else {
            next.nome_dispositivo = ""
          }
        }
        return next
      }),
    )
    setSavedOk(false)
    setTestHint(null)
  }

  const removeRow = (id) => {
    setRows((prev) => prev.filter((r) => r.id !== id))
    setSavedOk(false)
    setTestHint(null)
  }

  const addRow = () => {
    setRows((prev) => [...prev, newRow()])
    setSavedOk(false)
    setTestHint(null)
  }

  const handleTestPrint = (row) => {
    setError(null)
    setTestHint(null)
    const isUsb = row.tipo_connessione === "usb"
    if (isUsb && !String(row.nome_dispositivo || "").trim()) {
      setError("Per il test USB indica il nome stampante (es. POS-58), poi riprova.")
      return
    }
    if (!isUsb && !isValidIPv4(row.indirizzo_ip)) {
      setError("Per il test rete indica un IP valido (es. 192.168.1.50), poi riprova.")
      return
    }
    const ok = printComandaStampanteTest(row, tenantData?.nome)
    if (!ok) return
    const dest = formatRepartoStampanteDest(row)
    setTestHint(
      isUsb
        ? `Dialogo aperto. Scegli la stampante «${String(row.nome_dispositivo).trim()}» (${dest}).`
        : `Dialogo aperto. Scegli la stampante di sistema collegata a ${String(row.indirizzo_ip).trim()} (${dest}).`,
    )
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
    <div style={{ maxWidth: 920 }}>
      <p style={{ margin: "0 0 12px 0" }}>
        <Link to="/operative/cassa" style={{ color: "#1565c0", fontSize: 14 }}>
          ← Torna a Cassa
        </Link>
      </p>

      <h1 className="dashboard-page-title" style={{ marginBottom: 8 }}>
        Stampanti per reparto
      </h1>
      <p style={{ color: "#64748b", fontSize: 14, lineHeight: 1.55, marginBottom: 16 }}>
        Per ogni <strong>reparto</strong> (cucina, forno, bancone, …) scegli come è collegata la stampante:
      </p>
      <ul style={{ color: "#64748b", fontSize: 14, lineHeight: 1.55, margin: "0 0 16px", paddingLeft: 20 }}>
        <li>
          <strong>USB / locale</strong> — nome della stampante come in Windows (es. <code>POS-58</code>). Nel dialogo di
          stampa del browser selezioni quella stampante.
        </li>
        <li>
          <strong>Rete (IP)</strong> — indirizzo IP statico e porta (di solito <code>9100</code>). Sul PC crea una
          stampante di sistema che punta a quell&apos;IP.
        </li>
      </ul>
      <p style={{ color: "#64748b", fontSize: 14, lineHeight: 1.55, marginBottom: 16 }}>
        PizzaManager apre il dialogo di stampa del browser (non invia byte ESC/POS diretti sul cavo). Con{" "}
        <strong>«Stampa per reparto»</strong> in cassa si apre una finestra per ogni riga, con destinazione indicata
        sull&apos;intestazione della comanda.
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
          {savedOk && <div style={{ marginBottom: 12, fontSize: 14, color: "#2e7d32" }}>Salvato.</div>}
          {testHint && (
            <div
              style={{
                marginBottom: 12,
                padding: 10,
                borderRadius: 8,
                background: "#e3f2fd",
                color: "#0d47a1",
                fontSize: 14,
              }}
            >
              {testHint}
            </div>
          )}

          <div style={{ overflowX: "auto", border: "1px solid #e0e0e0", borderRadius: 8 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr style={{ background: "#f5f5f5", textAlign: "left" }}>
                  <th style={{ padding: "10px 12px", borderBottom: "1px solid #e0e0e0" }}>Reparto</th>
                  <th style={{ padding: "10px 12px", borderBottom: "1px solid #e0e0e0", width: 130 }}>Connessione</th>
                  <th style={{ padding: "10px 12px", borderBottom: "1px solid #e0e0e0" }}>Dettaglio (IP o nome USB)</th>
                  <th style={{ padding: "10px 12px", borderBottom: "1px solid #e0e0e0", width: 168 }} />
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ padding: 16, color: "#888" }}>
                      Nessun reparto. Esempio: Cucina → USB → POS-58, oppure Forno → Rete → 192.168.1.50.
                    </td>
                  </tr>
                ) : (
                  rows.map((r) => {
                    const isUsb = r.tipo_connessione === "usb"
                    const ipOk = !r.indirizzo_ip?.trim() || isValidIPv4(r.indirizzo_ip)
                    return (
                      <tr key={r.id}>
                        <td style={{ padding: "8px 12px", borderBottom: "1px solid #eee", verticalAlign: "top" }}>
                          <input
                            type="text"
                            placeholder="es. Cucina"
                            value={r.nome}
                            disabled={!canEditParametri}
                            onChange={(e) => updateRow(r.id, "nome", e.target.value)}
                            style={{ ...inputBase, maxWidth: 180 }}
                          />
                        </td>
                        <td style={{ padding: "8px 12px", borderBottom: "1px solid #eee", verticalAlign: "top" }}>
                          <select
                            value={isUsb ? "usb" : "ip"}
                            disabled={!canEditParametri}
                            onChange={(e) => updateRow(r.id, "tipo_connessione", e.target.value)}
                            style={{ ...inputBase, cursor: canEditParametri ? "pointer" : "not-allowed" }}
                            aria-label={`Tipo connessione ${r.nome || "reparto"}`}
                          >
                            <option value="usb">USB / locale</option>
                            <option value="ip">Rete (IP)</option>
                          </select>
                        </td>
                        <td style={{ padding: "8px 12px", borderBottom: "1px solid #eee", verticalAlign: "top" }}>
                          {isUsb ? (
                            <div>
                              <input
                                type="text"
                                placeholder="es. POS-58"
                                value={r.nome_dispositivo || ""}
                                disabled={!canEditParametri}
                                onChange={(e) => updateRow(r.id, "nome_dispositivo", e.target.value)}
                                style={inputBase}
                              />
                              <div style={{ fontSize: 11, color: "#888", marginTop: 4, lineHeight: 1.35 }}>
                                Nome esatto da Impostazioni Windows → Stampanti (dopo aver collegato il cavo USB).
                              </div>
                            </div>
                          ) : (
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "flex-start" }}>
                              <input
                                type="text"
                                placeholder="192.168.1.50"
                                value={r.indirizzo_ip}
                                disabled={!canEditParametri}
                                onChange={(e) => updateRow(r.id, "indirizzo_ip", e.target.value)}
                                style={{
                                  ...inputBase,
                                  maxWidth: 180,
                                  border: ipOk ? "1px solid #ccc" : "1px solid #e53935",
                                  fontFamily: "monospace",
                                }}
                              />
                              <input
                                type="number"
                                min={1}
                                max={65535}
                                title="Porta RAW"
                                value={r.porta}
                                disabled={!canEditParametri}
                                onChange={(e) =>
                                  updateRow(
                                    r.id,
                                    "porta",
                                    Math.min(65535, Math.max(1, Number(e.target.value) || 9100)),
                                  )
                                }
                                style={{ ...inputBase, maxWidth: 88 }}
                              />
                              <div style={{ flexBasis: "100%", fontSize: 11, color: "#888", lineHeight: 1.35 }}>
                                IP + porta (9100 tipica). Sul PC: stampante di rete verso quell&apos;IP.
                              </div>
                            </div>
                          )}
                        </td>
                        <td style={{ padding: "8px 12px", borderBottom: "1px solid #eee", verticalAlign: "top" }}>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                            <button
                              type="button"
                              onClick={() => handleTestPrint(r)}
                              title="Apre il dialogo di stampa con una comanda di prova"
                              style={{
                                padding: "6px 10px",
                                fontSize: 13,
                                cursor: "pointer",
                                border: "1px solid #1565c0",
                                borderRadius: 6,
                                background: "#e3f2fd",
                                color: "#0d47a1",
                                fontWeight: 600,
                              }}
                            >
                              Test
                            </button>
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
                          </div>
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
