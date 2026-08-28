import { useCallback, useEffect, useState } from "react"
import { useTenant } from "@/app/contexts/TenantContext"
import {
  getStoricoCalibrazioneProposte,
  puoDecidereCalibrazione,
  ripristinaCalibrazioneProposta,
} from "@/features/admin/services/adminService"

const STATO_LABEL = {
  in_attesa: { label: "In attesa di decisione", color: "#92400e", bg: "#fffbeb" },
  approvata: { label: "Approvata", color: "#166534", bg: "#ecfdf5" },
  rifiutata: { label: "Rifiutata", color: "#64748b", bg: "#f8fafc" },
  ripristinata: { label: "Ripristinata", color: "#1d4ed8", bg: "#eff6ff" },
  scaduta: { label: "Scaduta", color: "#64748b", bg: "#f8fafc" },
}

/** Storico delle proposte AI di calibrazione tempi + rollback delle approvate. Vedi CalibrazioneProposalModal per il popup di decisione. */
export default function CalibrazioneStoricoSection() {
  const { tenantId } = useTenant()
  const [storico, setStorico] = useState([])
  const [puoDecidere, setPuoDecidere] = useState(false)
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState(null)

  const load = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    try {
      const [rows, decide] = await Promise.all([
        getStoricoCalibrazioneProposte(tenantId, 15),
        puoDecidereCalibrazione(tenantId),
      ])
      setStorico(rows)
      setPuoDecidere(decide)
    } catch {
      setStorico([])
    } finally {
      setLoading(false)
    }
  }, [tenantId])

  useEffect(() => {
    void load()
  }, [load])

  async function handleRipristina(id) {
    if (!confirm("Ripristinare il valore di pizze_ogni_15_min precedente a questa proposta?")) return
    setBusyId(id)
    try {
      await ripristinaCalibrazioneProposta(id)
      await load()
    } catch (err) {
      alert(err?.message || "Ripristino non riuscito.")
    } finally {
      setBusyId(null)
    }
  }

  if (loading || storico.length === 0) return null

  return (
    <section className="dashboard-box dashboard-settings-section" style={{ marginTop: 24 }}>
      <h3 style={{ margin: "0 0 8px", fontSize: 16 }}>Calibrazione AI tempi</h3>
      <p style={{ margin: "0 0 12px", fontSize: 13, color: "#64748b" }}>
        Storico delle proposte settimanali sulla capacità forno (pizze ogni 15 minuti). Ogni riga approvata può
        essere ripristinata al valore precedente.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {storico.map((r) => {
          const stato = STATO_LABEL[r.stato] || STATO_LABEL.scaduta
          return (
            <div
              key={r.id}
              style={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                gap: 10,
                padding: "10px 14px",
                border: "1px solid #e2e8f0",
                borderRadius: 8,
                fontSize: 13,
              }}
            >
              <span
                style={{
                  padding: "3px 8px",
                  borderRadius: 999,
                  fontSize: 11,
                  fontWeight: 700,
                  color: stato.color,
                  background: stato.bg,
                }}
              >
                {stato.label}
              </span>
              <span style={{ color: "#0f172a" }}>
                {r.valore_attuale} → <strong>{r.valore_proposto}</strong> pizze/15min
              </span>
              <span style={{ color: "#94a3b8", fontSize: 12 }}>
                {new Date(r.creato_il).toLocaleDateString("it-IT")}
              </span>
              <span style={{ flex: "1 1 100%", color: "#64748b", fontSize: 12.5 }}>{r.motivo}</span>
              {r.stato === "approvata" && puoDecidere ? (
                <button
                  type="button"
                  className="dashboard-settings-btn-secondary"
                  style={{ marginLeft: "auto", fontSize: 12, padding: "4px 10px" }}
                  disabled={busyId === r.id}
                  onClick={() => handleRipristina(r.id)}
                >
                  {busyId === r.id ? "Ripristino…" : "Ripristina precedente"}
                </button>
              ) : null}
            </div>
          )
        })}
      </div>
    </section>
  )
}
