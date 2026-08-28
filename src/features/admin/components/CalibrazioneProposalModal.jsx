import { useCallback, useEffect, useState } from "react"
import Modal from "@/components/dashboard/Modal"
import { useTenant } from "@/app/contexts/TenantContext"
import {
  getProposteCalibrazionePending,
  puoDecidereCalibrazione,
  applicaCalibrazioneProposta,
  rifiutaCalibrazioneProposta,
} from "@/features/admin/services/adminService"

/**
 * Popup centrale per le proposte settimanali dell'AI sui parametri sensibili (capacità forno).
 * Mostrato in Admin (AdminLayout) e in Cassa (CassaPage) — chi ha il permesso di decidere vede i
 * pulsanti Autorizza/Rifiuta; chi non ce l'ha vede solo l'avviso, per conoscenza.
 * Nessuna modifica avviene senza una scelta esplicita: chiudere il popup (X) lascia la proposta
 * "in attesa", ricompare al prossimo accesso finché qualcuno non decide.
 */
export default function CalibrazioneProposalModal() {
  const { tenantId } = useTenant()
  const [proposta, setProposta] = useState(null)
  const [puoDecidere, setPuoDecidere] = useState(false)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [errore, setErrore] = useState(null)

  const load = useCallback(async () => {
    if (!tenantId) return
    try {
      const [p, decide] = await Promise.all([
        getProposteCalibrazionePending(tenantId),
        puoDecidereCalibrazione(tenantId),
      ])
      setProposta(p)
      setPuoDecidere(decide)
      setOpen(Boolean(p))
    } catch {
      // Silenzioso: non è un blocco critico, il popup semplicemente non compare stavolta.
    }
  }, [tenantId])

  useEffect(() => {
    void load()
  }, [load])

  async function handleAutorizza() {
    if (!proposta) return
    setBusy(true)
    setErrore(null)
    try {
      await applicaCalibrazioneProposta(proposta.id)
      setOpen(false)
    } catch (err) {
      setErrore(err?.message || "Autorizzazione non riuscita.")
    } finally {
      setBusy(false)
    }
  }

  async function handleRifiuta() {
    if (!proposta) return
    setBusy(true)
    setErrore(null)
    try {
      await rifiutaCalibrazioneProposta(proposta.id)
      setOpen(false)
    } catch (err) {
      setErrore(err?.message || "Operazione non riuscita.")
    } finally {
      setBusy(false)
    }
  }

  if (!proposta) return null

  const stat = proposta.statistiche || {}

  return (
    <Modal open={open} onClose={() => setOpen(false)} title="⚠️ Proposta AI su un parametro sensibile">
      <div style={{ padding: "4px 0" }}>
        <div
          style={{
            display: "flex",
            gap: 10,
            padding: "12px 14px",
            background: "#fffbeb",
            border: "1px solid #fde68a",
            borderRadius: 10,
            marginBottom: 16,
          }}
        >
          <span style={{ fontSize: 20, lineHeight: 1 }}>⚠️</span>
          <p style={{ margin: 0, fontSize: 13.5, color: "#92400e", lineHeight: 1.5 }}>
            Questo tocca la <strong>capacità del forno</strong> ("pizze ogni 15 minuti"): condiziona quanti ordini
            online il sistema accetta per fascia oraria. Non è stato applicato nulla — decidi tu.
          </p>
        </div>

        <p style={{ margin: "0 0 6px", fontSize: 14, fontWeight: 700, color: "#0f172a" }}>Cosa propone e perché</p>
        <p style={{ margin: "0 0 14px", fontSize: 14, color: "#334155", lineHeight: 1.55 }}>{proposta.motivo}</p>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            padding: "12px 14px",
            background: "#f8fafc",
            border: "1px solid #e2e8f0",
            borderRadius: 10,
            marginBottom: 14,
          }}
        >
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase" }}>Attuale</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: "#0f172a" }}>{proposta.valore_attuale}</div>
          </div>
          <div style={{ fontSize: 20, color: "#94a3b8" }}>→</div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase" }}>Proposto</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: "#0f766e" }}>{proposta.valore_proposto}</div>
          </div>
          <div style={{ marginLeft: "auto", fontSize: 12, color: "#64748b" }}>pizze / 15 min</div>
        </div>

        {stat.tasso_saturazione_ore_punta !== undefined ? (
          <p style={{ margin: "0 0 14px", fontSize: 12, color: "#94a3b8" }}>
            Basato su {stat.n_slot_totali_settimana} fasce orarie osservate negli ultimi 7 giorni — saturazione media
            nelle ore di punta: {Math.round(stat.tasso_saturazione_ore_punta * 100)}%.
          </p>
        ) : null}

        <p style={{ margin: "0 0 16px", fontSize: 12.5, color: "#64748b", lineHeight: 1.5 }}>
          Se autorizzi e poi cambi idea, puoi sempre tornare al valore precedente da Impostazioni → Parametri
          operativi → Calibrazione AI tempi.
        </p>

        {errore ? (
          <p style={{ margin: "0 0 12px", fontSize: 13, color: "#b91c1c" }} role="alert">
            {errore}
          </p>
        ) : null}

        {puoDecidere ? (
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button type="button" className="dashboard-settings-btn-secondary" disabled={busy} onClick={handleRifiuta}>
              Rifiuta
            </button>
            <button type="button" className="btn-primary-dashboard" disabled={busy} onClick={() => void handleAutorizza()}>
              {busy ? "Applico…" : "Autorizza il cambio"}
            </button>
          </div>
        ) : (
          <p style={{ margin: 0, fontSize: 13, color: "#64748b", fontStyle: "italic" }}>
            Solo un admin (o chi può modificare i parametri) può autorizzare o rifiutare questa proposta.
          </p>
        )}
      </div>
    </Modal>
  )
}
