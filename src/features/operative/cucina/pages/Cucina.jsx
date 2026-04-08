import { useEffect, useState, useCallback, useRef } from "react"
import { useTenant } from "@/app/contexts/TenantContext"
import {
  getOrders,
  getOrderDetail,
  getProdottiByIds,
  updateOrderStato,
} from "@/features/admin/services/adminService"
import OrderDetailModal from "@/features/operative/components/OrderDetailModal"
import { isDeliveryUrgentForno } from "@/utils/riderDeliveryConfig"

const STATO_PREPARAZIONE = "IN_PREPARAZIONE"
const STATO_PRONTO = "PRONTO"
const POLL_MS = 10000

export default function Cucina() {
  const { tenantId, tenantData } = useTenant()
  const parametri = tenantData?.parametri_operativi || {}
  const partenzaConsegneMinuti = Number(parametri.pizzaiolo_partenza_consegne_minuti) || 30
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [detailOrder, setDetailOrder] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const loadSeqRef = useRef(0)

  const loadOrders = useCallback(async (opts = {}) => {
    const silent = opts.silent === true
    if (!tenantId) return
    const seq = ++loadSeqRef.current
    if (!silent) {
      setLoading(true)
      setError(null)
    }
    try {
      const data = await getOrders(tenantId, { stato: STATO_PREPARAZIONE, todayOnly: true, limit: 50 })
      if (seq !== loadSeqRef.current) return
      setOrders(data || [])
      setError(null)
    } catch (err) {
      console.error(err)
      if (seq === loadSeqRef.current && !silent) {
        setError("Errore nel caricamento ordini.")
      }
    } finally {
      if (seq === loadSeqRef.current && !silent) setLoading(false)
    }
  }, [tenantId])

  useEffect(() => {
    loadOrders()
    const t = setInterval(() => loadOrders({ silent: true }), POLL_MS)
    return () => clearInterval(t)
  }, [loadOrders])

  const openDetail = useCallback(
    async (ordineId) => {
      if (!tenantId || !ordineId) return
      setDetailOrder(null)
      setDetailLoading(true)
      try {
        const detail = await getOrderDetail(ordineId)
        const prodIds = [...new Set((detail.righe || []).map((r) => r.prodottoId ?? r.prodotto_id).filter(Boolean))]
        const prodotti = prodIds.length ? await getProdottiByIds(tenantId, prodIds) : []
        const productNames = (prodotti || []).reduce((acc, p) => ({ ...acc, [p.id]: p.nome || "—" }), {})
        setDetailOrder({ ...detail, productNames })
      } catch (err) {
        console.error(err)
        setError("Errore nel caricamento dettaglio.")
      } finally {
        setDetailLoading(false)
      }
    },
    [tenantId]
  )

  const markAsPronto = useCallback(
    async (ordineId) => {
      if (!ordineId) return
      setActionLoading(true)
      try {
        await updateOrderStato(ordineId, STATO_PRONTO)
        setOrders((prev) => prev.filter((o) => o.id !== ordineId))
        setDetailOrder(null)
      } catch (err) {
        console.error(err)
        setError("Errore aggiornamento ordine.")
      } finally {
        setActionLoading(false)
      }
    },
    []
  )

  return (
    <div style={styles.wrapper}>
      <h1 style={styles.title}>Cucina</h1>
      <p style={styles.subtitle}>Ordini in preparazione</p>

      {error && <div style={styles.error}>{error}</div>}

      {loading && orders.length === 0 ? (
        <p style={styles.muted}>Caricamento...</p>
      ) : orders.length === 0 ? (
        <p style={styles.muted}>Nessun ordine in preparazione.</p>
      ) : (
        <ul style={styles.list}>
          {orders.map((ord) => {
            const urg =
              (ord.tipo_ordine || "").toLowerCase() === "delivery" &&
              isDeliveryUrgentForno(ord, parametri, partenzaConsegneMinuti)
            return (
            <li
              key={ord.id}
              style={{
                ...styles.card,
                ...(urg
                  ? {
                      border: "2px solid #e65100",
                      background: "#fff8e1",
                      boxShadow: "0 0 0 1px rgba(230,81,0,0.35)",
                    }
                  : {}),
              }}
              onClick={() => openDetail(ord.id)}
              onKeyDown={(e) => e.key === "Enter" && openDetail(ord.id)}
              role="button"
              tabIndex={0}
              aria-label={`Ordine ${ord.numero}, totale ${Number(ord.totale ?? 0).toFixed(2)} euro`}
            >
              <div style={styles.cardHeader}>
                <strong>Ordine #{ord.numero}</strong>
                <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {urg ? (
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 800,
                        color: "#bf360c",
                        background: "#ffe0b2",
                        padding: "2px 8px",
                        borderRadius: 6,
                      }}
                      title="Consegna: mandare al forno con urgenza (finestra critica)"
                    >
                      FORNO URGENTE
                    </span>
                  ) : null}
                  <span style={styles.totale}>€ {Number(ord.totale ?? 0).toFixed(2)}</span>
                </span>
              </div>
              <div style={styles.cardMeta}>
                {ord.nome_cliente && (
                  <span style={styles.metaItem}>Cliente: {ord.nome_cliente}</span>
                )}
                {ord.orario_ritiro && (
                  <span style={styles.metaItem}>Ritiro: {ord.orario_ritiro}</span>
                )}
                {ord.note && <span style={styles.note}>Note: {ord.note}</span>}
              </div>
              <span style={styles.tapHint}>Tocca per dettaglio</span>
            </li>
            )
          })}
        </ul>
      )}

      {(detailOrder || detailLoading) && (
        <OrderDetailModal
          order={detailOrder}
          loading={detailLoading}
          onClose={() => !actionLoading && setDetailOrder(null)}
          actionLabel={actionLoading ? "Salvataggio..." : "Segna come pronto"}
          onAction={markAsPronto}
          actionDisabled={actionLoading}
        />
      )}
    </div>
  )
}

const styles = {
  wrapper: { padding: 24 },
  title: { fontSize: 22, marginBottom: 4 },
  subtitle: { color: "#666", marginBottom: 16 },
  error: {
    padding: 12,
    background: "#ffebee",
    color: "#c62828",
    borderRadius: 8,
    marginBottom: 16,
  },
  muted: { color: "#888", marginTop: 16 },
  list: { listStyle: "none", padding: 0, margin: 0 },
  card: {
    border: "1px solid #e0e0e0",
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    background: "#fff",
    cursor: "pointer",
  },
  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  totale: { fontWeight: 600, color: "#2e7d32" },
  cardMeta: { marginBottom: 8, fontSize: 13, color: "#555", display: "flex", flexWrap: "wrap", gap: "8px 16px" },
  metaItem: {},
  note: { fontStyle: "italic", width: "100%" },
  tapHint: { fontSize: 12, color: "#999" },
}
