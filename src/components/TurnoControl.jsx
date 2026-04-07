import { useState, useEffect, useCallback } from "react"
import { turniCassaAperto, turniCassaApri, turniCassaChiudi } from "@/features/admin/services/adminService"

function mapTurnoRpcError(err) {
  const m = String(err?.message || err?.hint || "").toLowerCase()
  if (m.includes("tenant_forbidden")) return "Non hai permesso per questo tenant."
  if (m.includes("not_authenticated")) return "Sessione non valida: effettua di nuovo l’accesso."
  if (m.includes("punto_vendita_obbligatorio")) return "Seleziona un punto vendita attivo."
  if (m.includes("punto_vendita_non_valido")) return "Punto vendita non valido per questo tenant."
  if (m.includes("turno_aperto_altro_pv")) return "Hai già un turno aperto su un altro punto vendita: chiudilo prima."
  if (m.includes("fondo_contato_obbligatorio")) return "Indica il fondo cassa contato."
  if (m.includes("nessun_turno_aperto")) return "Nessun turno aperto da chiudere."
  return err?.message || "Errore imprevisto."
}

function formatDt(iso) {
  if (!iso) return "—"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleString("it-IT", { dateStyle: "short", timeStyle: "short" })
}

export default function TurnoControl({ tenantId, puntoVenditaId, pvList }) {
  const [loading, setLoading] = useState(false)
  const [turno, setTurno] = useState(null)
  const [loadErr, setLoadErr] = useState(null)
  const [chiudiOpen, setChiudiOpen] = useState(false)
  const [fondoStr, setFondoStr] = useState("")
  const [attesoStr, setAttesoStr] = useState("")
  const [noteChiusura, setNoteChiusura] = useState("")

  const pvNome = (id) => {
    if (!id || !Array.isArray(pvList)) return null
    const p = pvList.find((x) => String(x.id) === String(id))
    return p?.nome || null
  }

  const refresh = useCallback(async () => {
    if (!tenantId) return
    setLoadErr(null)
    try {
      const row = await turniCassaAperto(tenantId)
      setTurno(row && row.id != null ? row : null)
    } catch (err) {
      setTurno(null)
      setLoadErr(mapTurnoRpcError(err))
    }
  }, [tenantId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const apriTurno = async () => {
    if (!tenantId || !puntoVenditaId) {
      alert("Seleziona un punto vendita attivo.")
      return
    }
    try {
      setLoading(true)
      await turniCassaApri(tenantId, puntoVenditaId)
      await refresh()
      alert("Turno aperto.")
    } catch (err) {
      alert(mapTurnoRpcError(err))
    } finally {
      setLoading(false)
    }
  }

  const confermaChiudi = async () => {
    if (!tenantId) return
    const fondo = Number(String(fondoStr).replace(",", ".").trim())
    if (!Number.isFinite(fondo)) {
      alert("Indica un importo valido per il fondo cassa.")
      return
    }
    let atteso = null
    if (String(attesoStr).trim() !== "") {
      const a = Number(String(attesoStr).replace(",", ".").trim())
      if (!Number.isFinite(a)) {
        alert("Importo incasso atteso non valido.")
        return
      }
      atteso = a
    }
    try {
      setLoading(true)
      await turniCassaChiudi(tenantId, {
        fondoContatoEuro: fondo,
        incassoAttesoEuro: atteso,
        note: noteChiusura.trim() || null,
      })
      setChiudiOpen(false)
      setFondoStr("")
      setAttesoStr("")
      setNoteChiusura("")
      await refresh()
      alert("Turno chiuso e riconciliazione registrata.")
    } catch (err) {
      alert(mapTurnoRpcError(err))
    } finally {
      setLoading(false)
    }
  }

  const aperto = Boolean(turno?.id)
  const pvLabel = turno?.punto_vendita_id ? pvNome(turno.punto_vendita_id) || String(turno.punto_vendita_id).slice(0, 8) : "—"

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div
        style={{
          padding: 14,
          borderRadius: 10,
          border: "1px solid #e2e8f0",
          background: aperto ? "#f0fdf4" : "#f8fafc",
          fontSize: 14,
          lineHeight: 1.5,
        }}
      >
        <div style={{ fontWeight: 700, marginBottom: 6 }}>Stato turno</div>
        {loadErr ? (
          <p style={{ color: "#b91c1c", margin: 0 }}>{loadErr}</p>
        ) : (
          <>
            <p style={{ margin: "0 0 8px", color: "#334155" }}>
              {aperto ? (
                <>
                  <strong>Aperto</strong> dal {formatDt(turno.aperto_il)}
                  <br />
                  Punto vendita: {pvLabel}
                </>
              ) : (
                <>Nessun turno aperto per il tuo utente su questo tenant.</>
              )}
            </p>
          </>
        )}
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
        <button type="button" onClick={apriTurno} disabled={loading || !puntoVenditaId || aperto}>
          Apri turno
        </button>
        <button
          type="button"
          onClick={() => setChiudiOpen(true)}
          disabled={loading || !aperto}
        >
          Chiudi turno
        </button>
        <button type="button" onClick={() => void refresh()} disabled={loading}>
          Aggiorna
        </button>
      </div>

      {!puntoVenditaId ? (
        <p style={{ margin: 0, fontSize: 13, color: "#b45309" }}>
          Nessun punto vendita attivo: non puoi aprire un turno finché non ne selezioni uno.
        </p>
      ) : null}

      {chiudiOpen ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15,23,42,0.45)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="chiudi-turno-title"
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 12,
              padding: 20,
              maxWidth: 420,
              width: "100%",
              boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="chiudi-turno-title" style={{ margin: "0 0 12px", fontSize: 18 }}>
              Chiusura turno e riconciliazione
            </h2>
            <p style={{ margin: "0 0 14px", fontSize: 14, color: "#475569" }}>
              Indica il fondo cassa contato. Opzionalmente l&apos;incasso atteso (es. da sistema) per calcolare lo scostamento.
            </p>
            <label style={{ display: "block", marginBottom: 10, fontSize: 14 }}>
              Fondo cassa contato (€) *
              <input
                type="text"
                inputMode="decimal"
                value={fondoStr}
                onChange={(e) => setFondoStr(e.target.value)}
                style={{ display: "block", marginTop: 6, padding: "8px 10px", width: "100%", boxSizing: "border-box" }}
                autoComplete="off"
              />
            </label>
            <label style={{ display: "block", marginBottom: 10, fontSize: 14 }}>
              Incasso atteso (€), opzionale
              <input
                type="text"
                inputMode="decimal"
                value={attesoStr}
                onChange={(e) => setAttesoStr(e.target.value)}
                style={{ display: "block", marginTop: 6, padding: "8px 10px", width: "100%", boxSizing: "border-box" }}
                autoComplete="off"
              />
            </label>
            <label style={{ display: "block", marginBottom: 10, fontSize: 14 }}>
              Note
              <textarea
                rows={2}
                value={noteChiusura}
                onChange={(e) => setNoteChiusura(e.target.value)}
                style={{ display: "block", marginTop: 6, padding: "8px 10px", width: "100%", boxSizing: "border-box", resize: "vertical" }}
              />
            </label>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
              <button type="button" onClick={() => setChiudiOpen(false)} disabled={loading}>
                Annulla
              </button>
              <button type="button" onClick={() => void confermaChiudi()} disabled={loading}>
                {loading ? "Salvataggio…" : "Conferma chiusura"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
