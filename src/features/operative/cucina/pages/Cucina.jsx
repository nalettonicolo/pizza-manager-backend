import { useEffect, useState, useCallback, useRef, useMemo } from "react"
import { useTenant } from "@/app/contexts/TenantContext"
import {
  getOrders,
  getOrderDetail,
  getProdottiByIds,
  getRigheByOrdineIds,
  getProductIngredientiBatch,
  updateOrderStato,
  updateOrderCucinaPrepStato,
} from "@/features/admin/services/adminService"
import OrderDetailModal from "@/features/operative/components/OrderDetailModal"
import { isDeliveryUrgentForno } from "@/utils/riderDeliveryConfig"
import { PLANNING_GRID_SLOT_MINUTES } from "@/features/operative/cassa/utils/planningUtils"
import {
  buildCucinaPrepTasks,
  sortedCucinaSlotTabs,
  slotTabLabel,
  markIngredientPrepDone,
} from "@/features/operative/cucina/utils/cucinaPrepTasks"

const STATO_PREPARAZIONE = "IN_PREPARAZIONE"
const STATO_PRONTO = "PRONTO"
const POLL_MS = 10000

export default function Cucina() {
  const { tenantId, tenantData } = useTenant()
  const parametri = tenantData?.parametri_operativi || {}
  const partenzaConsegneMinuti = Number(parametri.pizzaiolo_partenza_consegne_minuti) || 30
  const [orders, setOrders] = useState([])
  const [righeAll, setRigheAll] = useState([])
  const [productNames, setProductNames] = useState({})
  const [ingredientsByProduct, setIngredientsByProduct] = useState({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [detailOrder, setDetailOrder] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [prepActionId, setPrepActionId] = useState(null)
  const [activeSlot, setActiveSlot] = useState(null)
  const loadSeqRef = useRef(0)

  const loadOrders = useCallback(
    async (opts = {}) => {
      const silent = opts.silent === true
      if (!tenantId) return
      const seq = ++loadSeqRef.current
      if (!silent) {
        setLoading(true)
        setError(null)
      }
      try {
        const data = await getOrders(tenantId, { stato: STATO_PREPARAZIONE, todayOnly: true, limit: 100 })
        const ids = (data || []).map((o) => o.id).filter(Boolean)
        const righe = ids.length ? await getRigheByOrdineIds(ids) : []
        const prodIds = new Set()
        for (const r of righe || []) {
          const pid = r.prodottoId ?? r.prodotto_id
          if (pid) prodIds.add(pid)
        }
        const pIds = [...prodIds]
        const [prodotti, ingBatch] = await Promise.all([
          pIds.length ? getProdottiByIds(tenantId, pIds) : [],
          pIds.length ? getProductIngredientiBatch(tenantId, pIds) : {},
        ])
        if (seq !== loadSeqRef.current) return
        setOrders(data || [])
        setRigheAll(righe || [])
        setProductNames((prodotti || []).reduce((acc, p) => ({ ...acc, [p.id]: p.nome || "—" }), {}))
        setIngredientsByProduct(ingBatch || {})
        setError(null)
      } catch (err) {
        console.error(err)
        if (seq === loadSeqRef.current && !silent) {
          setError("Errore nel caricamento ordini.")
        }
      } finally {
        if (seq === loadSeqRef.current && !silent) setLoading(false)
      }
    },
    [tenantId],
  )

  useEffect(() => {
    loadOrders()
    const t = setInterval(() => loadOrders({ silent: true }), POLL_MS)
    return () => clearInterval(t)
  }, [loadOrders])

  const tasksBySlot = useMemo(
    () => buildCucinaPrepTasks(orders, righeAll, productNames, ingredientsByProduct, PLANNING_GRID_SLOT_MINUTES),
    [orders, righeAll, productNames, ingredientsByProduct],
  )

  const slotTabs = useMemo(() => sortedCucinaSlotTabs(tasksBySlot), [tasksBySlot])

  useEffect(() => {
    if (!slotTabs.length) {
      setActiveSlot(null)
      return
    }
    if (activeSlot && slotTabs.includes(activeSlot)) return
    /* Prima tab con almeno un task da fare, altrimenti la prima */
    const withPending = slotTabs.find((s) => (tasksBySlot[s] || []).some((t) => !t.done))
    setActiveSlot(withPending ?? slotTabs[0])
  }, [slotTabs, tasksBySlot, activeSlot])

  const openDetail = useCallback(
    async (ordineId) => {
      if (!tenantId || !ordineId) return
      setDetailOrder(null)
      setDetailLoading(true)
      try {
        const detail = await getOrderDetail(ordineId)
        const prodIds = [...new Set((detail.righe || []).map((r) => r.prodottoId ?? r.prodotto_id).filter(Boolean))]
        const prodotti = prodIds.length ? await getProdottiByIds(tenantId, prodIds) : []
        const pn = (prodotti || []).reduce((acc, p) => ({ ...acc, [p.id]: p.nome || "—" }), {})
        setDetailOrder({ ...detail, productNames: pn })
      } catch (err) {
        console.error(err)
        setError("Errore nel caricamento dettaglio.")
      } finally {
        setDetailLoading(false)
      }
    },
    [tenantId],
  )

  const markAsPronto = useCallback(async (ordineId) => {
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
  }, [])

  const handleMarkPrepDone = useCallback(
    async (task) => {
      if (!task?.ordineId || task.done) return
      const ord = orders.find((o) => o.id === task.ordineId)
      if (!ord) return
      const actionKey = `${task.ordineId}:${task.rigaId}:${task.ingredienteId}`
      setPrepActionId(actionKey)
      try {
        const next = markIngredientPrepDone(ord.cucina_prep_stato ?? ord.cucinaPrepStato, task.rigaId, task.ingredienteId)
        await updateOrderCucinaPrepStato(task.ordineId, next)
        setOrders((prev) => prev.map((o) => (o.id === task.ordineId ? { ...o, cucina_prep_stato: next } : o)))
      } catch (err) {
        console.error(err)
        setError("Errore salvataggio preparazione. Verifica di aver eseguito sql_upgrade (colonna cucina_prep_stato).")
      } finally {
        setPrepActionId(null)
      }
    },
    [orders],
  )

  const tasksInTab = activeSlot ? tasksBySlot[activeSlot] || [] : []
  const pendingInTab = tasksInTab.filter((t) => !t.done)
  const doneInTab = tasksInTab.filter((t) => t.done)
  const totalPrepPending = useMemo(
    () =>
      Object.values(tasksBySlot).reduce((acc, list) => acc + (list || []).filter((t) => !t.done).length, 0),
    [tasksBySlot],
  )

  return (
    <div style={styles.wrapper}>
      <h1 style={styles.title}>Cucina</h1>
      <p style={styles.subtitle}>Ordini in preparazione</p>

      {error && <div style={styles.error}>{error}</div>}

      {slotTabs.length > 0 && (
        <section style={styles.prepSection} aria-label="Preparazioni per fascia oraria">
          <h2 style={styles.prepTitle}>Da preparare in cucina</h2>
          <p style={styles.prepHint}>
            Ingredienti con flag &quot;Prep. cucina&quot; in Admin → Ingredienti. Tocca una riga quando è pronta (ogni ordine / riga è separato).
            {totalPrepPending > 0 ? ` · ${totalPrepPending} da fare` : ""}
          </p>
          <div style={styles.tabRow}>
            {slotTabs.map((slot) => {
              const pend = (tasksBySlot[slot] || []).filter((t) => !t.done).length
              const isActive = slot === activeSlot
              return (
                <button
                  key={slot}
                  type="button"
                  style={{
                    ...styles.tabBtn,
                    ...(isActive ? styles.tabBtnActive : {}),
                  }}
                  onClick={() => setActiveSlot(slot)}
                >
                  {slotTabLabel(slot)}
                  {pend > 0 ? <span style={styles.tabBadge}>{pend}</span> : null}
                </button>
              )
            })}
          </div>
          <div style={styles.taskList}>
            {pendingInTab.length === 0 && doneInTab.length === 0 ? (
              <p style={styles.mutedSmall}>Nessuna preparazione per questa fascia.</p>
            ) : null}
            {pendingInTab.map((t) => {
              const key = `${t.ordineId}:${t.rigaId}:${t.ingredienteId}`
              const busy = prepActionId === key
              const titoloProdotto = t.formatoNome ? `${t.prodottoNome} (${t.formatoNome})` : t.prodottoNome
              return (
                <button
                  key={key}
                  type="button"
                  style={styles.taskBtn}
                  disabled={busy}
                  onClick={() => handleMarkPrepDone(t)}
                >
                  <span style={styles.taskMain}>
                    <strong>{t.ingredienteNome}</strong>
                    {t.qty > 1 ? <span style={styles.qtyBadge}>×{t.qty}</span> : null}
                  </span>
                  <span style={styles.taskSub}>
                    Ordine #{t.ordineNumero}
                    {t.nomeCliente ? ` · ${t.nomeCliente}` : ""} · {titoloProdotto}
                  </span>
                  <span style={styles.taskAction}>{busy ? "Salvo…" : "Tocca quando pronto"}</span>
                </button>
              )
            })}
            {doneInTab.length > 0 ? (
              <div style={styles.doneBlock}>
                <span style={styles.doneLabel}>Completati in questa fascia</span>
                {doneInTab.map((t) => {
                  const titoloProdotto = t.formatoNome ? `${t.prodottoNome} (${t.formatoNome})` : t.prodottoNome
                  return (
                    <div key={`d-${t.ordineId}:${t.rigaId}:${t.ingredienteId}`} style={styles.doneRow}>
                      <span style={styles.doneStrike}>
                        {t.ingredienteNome}
                        {t.qty > 1 ? ` ×${t.qty}` : ""}
                      </span>
                      <span style={styles.doneMeta}>
                        #{t.ordineNumero} · {titoloProdotto}
                      </span>
                    </div>
                  )
                })}
              </div>
            ) : null}
          </div>
        </section>
      )}

      {slotTabs.length === 0 && !loading && orders.length > 0 ? (
        <p style={styles.muted}>
          Nessun ingrediente con &quot;Prep. cucina&quot; negli ordini attuali. Configura il flag in Admin → Ingredienti (es. spinaci
          congelati).
        </p>
      ) : null}

      <h2 style={styles.listHeading}>Ordini</h2>
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
                  {ord.nome_cliente && <span style={styles.metaItem}>Cliente: {ord.nome_cliente}</span>}
                  {ord.orario_ritiro && <span style={styles.metaItem}>Ritiro: {ord.orario_ritiro}</span>}
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
  listHeading: { fontSize: 17, margin: "20px 0 10px" },
  error: {
    padding: 12,
    background: "#ffebee",
    color: "#c62828",
    borderRadius: 8,
    marginBottom: 16,
  },
  muted: { color: "#888", marginTop: 16 },
  mutedSmall: { color: "#888", fontSize: 13, margin: "8px 0 0" },
  prepSection: {
    marginBottom: 20,
    padding: 14,
    background: "#f1f8e9",
    border: "1px solid #c5e1a5",
    borderRadius: 10,
  },
  prepTitle: { margin: "0 0 6px", fontSize: 17 },
  prepHint: { margin: "0 0 12px", fontSize: 13, color: "#33691e", lineHeight: 1.4 },
  tabRow: { display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  tabBtn: {
    padding: "8px 12px",
    borderRadius: 8,
    border: "1px solid #aed581",
    background: "#fff",
    cursor: "pointer",
    fontWeight: 600,
    fontSize: 13,
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
  },
  tabBtnActive: {
    background: "#33691e",
    color: "#fff",
    borderColor: "#33691e",
  },
  tabBadge: {
    fontSize: 11,
    background: "#ff7043",
    color: "#fff",
    padding: "2px 7px",
    borderRadius: 10,
    fontWeight: 700,
  },
  taskList: { display: "flex", flexDirection: "column", gap: 8 },
  taskBtn: {
    textAlign: "left",
    padding: 12,
    borderRadius: 8,
    border: "1px solid #dce775",
    background: "#fff",
    cursor: "pointer",
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  taskMain: { fontSize: 15, display: "flex", alignItems: "center", gap: 8 },
  qtyBadge: {
    fontSize: 12,
    fontWeight: 700,
    background: "#e8f5e9",
    padding: "2px 8px",
    borderRadius: 6,
  },
  taskSub: { fontSize: 12, color: "#555" },
  taskAction: { fontSize: 11, color: "#2e7d32", fontWeight: 600 },
  doneBlock: { marginTop: 10, paddingTop: 10, borderTop: "1px dashed #aed581" },
  doneLabel: { fontSize: 12, color: "#689f38", fontWeight: 600, display: "block", marginBottom: 6 },
  doneRow: { fontSize: 13, marginBottom: 4, display: "flex", flexDirection: "column" },
  doneStrike: { textDecoration: "line-through", color: "#757575" },
  doneMeta: { fontSize: 11, color: "#9e9e9e" },
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
