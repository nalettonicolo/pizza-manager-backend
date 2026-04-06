import { useEffect, useState, useCallback, useRef } from "react"
import { useOutletContext } from "react-router-dom"
import { useTenant } from "@/app/contexts/TenantContext"
import { getOrders, updateOrder, updateOrderStato } from "@/features/admin/services/adminService"

const STATO_PRONTO = "PRONTO"
const STATO_CONSEGNATO = "CONSEGNATO"
const POLL_MS = 10000

function ordineNomeCliente(o) {
  return String(o?.nome_cliente ?? o?.nomeCliente ?? "").trim()
}

function ordineIndirizzoConsegna(o) {
  return String(o?.indirizzo_consegna ?? o?.indirizzoConsegna ?? "").trim()
}

function ordineStatoConsegna(o) {
  return String(o?.stato_consegna ?? o?.statoConsegna ?? "").trim()
}

function ordineConsegnaLat(o) {
  const v = o?.consegna_lat ?? o?.consegnaLat
  return v != null && Number.isFinite(Number(v)) ? Number(v) : null
}

function ordineConsegnaLng(o) {
  const v = o?.consegna_lng ?? o?.consegnaLng
  return v != null && Number.isFinite(Number(v)) ? Number(v) : null
}

export default function DeliveryDashboard() {
  const { operatoreLabel } = useOutletContext() || {}
  const { tenantId } = useTenant()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(false)
  const loadSeqRef = useRef(0)

  const loadOrders = useCallback(async (opts = {}) => {
    const silent = opts.silent === true
    if (!tenantId) return
    const seq = ++loadSeqRef.current
    if (!silent) setLoading(true)
    try {
      const data = await getOrders(tenantId, { stato: STATO_PRONTO, todayOnly: true, limit: 40 })
      if (seq !== loadSeqRef.current) return
      setOrders(data || [])
    } catch (err) {
      console.error(err)
    } finally {
      if (seq === loadSeqRef.current && !silent) setLoading(false)
    }
  }, [tenantId])

  useEffect(() => {
    loadOrders()
    const t = setInterval(() => loadOrders({ silent: true }), POLL_MS)
    return () => clearInterval(t)
  }, [loadOrders])

  const setInViaggio = async (ordineId) => {
    if (!ordineId) return
    try {
      await updateOrder(ordineId, { stato_consegna: "IN_VIAGGIO" })
      await loadOrders({ silent: true })
    } catch (err) {
      console.error(err)
    }
  }

  const markConsegnato = async (ordineId) => {
    if (!ordineId) return
    try {
      await updateOrder(ordineId, { stato_consegna: "CONSEGNATO" })
      await updateOrderStato(ordineId, STATO_CONSEGNATO)
      setOrders((prev) => prev.filter((o) => o.id !== ordineId))
    } catch (err) {
      console.error(err)
    }
  }

  return (
    <div style={{ padding: 24 }}>
      <h1 className="dashboard-page-title">Delivery{operatoreLabel ? ` — ${operatoreLabel}` : ""}</h1>
      <p style={{ color: "#666", marginBottom: 16, lineHeight: 1.55 }}>
        Ordini pronti per la consegna (oggi). Stato consegna su DB: <code>stato_consegna</code> — utile per rider e report operativi.
        {operatoreLabel ? ` · ${operatoreLabel}` : ""}
      </p>

      {loading && orders.length === 0 ? (
        <p style={{ color: "#888" }}>Caricamento...</p>
      ) : orders.length === 0 ? (
        <p style={{ color: "#888" }}>Nessun ordine da consegnare.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {orders.map((ord) => {
            const nome = ordineNomeCliente(ord)
            const ind = ordineIndirizzoConsegna(ord)
            const sc = ordineStatoConsegna(ord)
            const lat = ordineConsegnaLat(ord)
            const lng = ordineConsegnaLng(ord)
            const mapsUrl = lat != null && lng != null ? `https://www.google.com/maps?q=${lat},${lng}` : null
            const inViaggio = sc === "IN_VIAGGIO"
            return (
              <li key={ord.id} style={{ border: "1px solid #e0e0e0", borderRadius: 8, padding: 16, marginBottom: 12, background: "#fff" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, gap: 12, flexWrap: "wrap" }}>
                  <strong>Ordine #{ord.numero ?? ord.id?.slice?.(0, 8) ?? "—"}</strong>
                  <span style={{ fontWeight: 600, color: "#2e7d32" }}>€ {Number(ord.totale ?? 0).toFixed(2)}</span>
                </div>
                {nome ? <p style={{ fontSize: 14, margin: "0 0 6px", fontWeight: 600 }}>{nome}</p> : null}
                {ind ? <p style={{ fontSize: 13, color: "#444", margin: "0 0 8px", lineHeight: 1.45 }}>{ind}</p> : null}
                {mapsUrl ? (
                  <p style={{ margin: "0 0 10px" }}>
                    <a href={mapsUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: "#1565c0" }}>
                      Apri in Maps
                    </a>
                  </p>
                ) : null}
                <p style={{ fontSize: 12, color: "#64748b", margin: "0 0 10px" }}>
                  Stato consegna: <strong>{sc || "— (non impostato)"}</strong>
                </p>
                {ord.note ? <p style={{ fontSize: 13, color: "#555", marginBottom: 10 }}>Note: {ord.note}</p> : null}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {!inViaggio ? (
                    <button
                      type="button"
                      onClick={() => setInViaggio(ord.id)}
                      style={{ padding: "8px 16px", background: "#ff9800", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600 }}
                    >
                      In viaggio
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => markConsegnato(ord.id)}
                    style={{ padding: "8px 16px", background: "#2196f3", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600 }}
                  >
                    Segna consegnato
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
