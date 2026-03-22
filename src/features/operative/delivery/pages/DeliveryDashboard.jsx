import { useEffect, useState, useCallback, useRef } from "react"
import { useOutletContext } from "react-router-dom"
import { useTenant } from "@/app/contexts/TenantContext"
import { getOrders, updateOrderStato } from "@/features/admin/services/adminService"

const STATO_PRONTO = "PRONTO"
const STATO_CONSEGNATO = "CONSEGNATO"
const POLL_MS = 10000

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
      const data = await getOrders(tenantId, { stato: STATO_PRONTO, todayOnly: true, limit: 30 })
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

  const markConsegnato = async (ordineId) => {
    if (!ordineId) return
    try {
      await updateOrderStato(ordineId, STATO_CONSEGNATO)
      setOrders((prev) => prev.filter((o) => o.id !== ordineId))
    } catch (err) {
      console.error(err)
    }
  }

  return (
    <div style={{ padding: 24 }}>
      <h1 className="dashboard-page-title">Delivery{operatoreLabel ? ` — ${operatoreLabel}` : ""}</h1>
      <p style={{ color: "#666", marginBottom: 16 }}>Ordini da consegnare (Delivery / Pony){operatoreLabel ? ` · ${operatoreLabel}` : ""}</p>

      {loading && orders.length === 0 ? (
        <p style={{ color: "#888" }}>Caricamento...</p>
      ) : orders.length === 0 ? (
        <p style={{ color: "#888" }}>Nessun ordine da consegnare.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {orders.map((ord) => (
            <li key={ord.id} style={{ border: "1px solid #e0e0e0", borderRadius: 8, padding: 16, marginBottom: 12, background: "#fff" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <strong>Ordine #{ord.numero}</strong>
                <span style={{ fontWeight: 600, color: "#2e7d32" }}>€ {Number(ord.totale ?? 0).toFixed(2)}</span>
              </div>
              {ord.note && <p style={{ fontSize: 13, color: "#555", marginBottom: 8 }}>Note: {ord.note}</p>}
              <button type="button" onClick={() => markConsegnato(ord.id)} style={{ padding: "8px 16px", background: "#2196f3", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600 }}>
                Segna consegnato
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
