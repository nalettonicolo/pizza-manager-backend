import { useEffect, useState, useCallback, useMemo, useRef } from "react"
import { useTenant } from "@/app/contexts/TenantContext"
import {
  getOrders,
  getOrderDetail,
  getProdottiByIds,
  getRigheAggregateByOrdineIds,
  getRigheByOrdineIds,
  getProductIngredientiBatch,
  updateOrderStato,
} from "@/features/admin/services/adminService"
import OrderDetailModal from "@/features/operative/components/OrderDetailModal"
import {
  filterOrdiniVisibili,
  sortOrdiniByOrario,
  getRitardoMinuti,
  slotPizzeCount,
  sortedSlotLabels,
} from "@/features/operative/pizzaiolo/utils/pizzaioloUtils"
import { PLANNING_GRID_SLOT_MINUTES } from "@/features/operative/cassa/utils/planningUtils"

const STATO_PRONTO = "PRONTO"
const STATO_CONSEGNATO = "CONSEGNATO"
const POLL_MS = 10000

export default function Bancone() {
  const { tenantId, tenantData } = useTenant()
  const [orders, setOrders] = useState([])
  const [pizzePerOrdine, setPizzePerOrdine] = useState({})
  const [righePerOrdine, setRighePerOrdine] = useState({})
  const [productNames, setProductNames] = useState({})
  const [ingredientsByProduct, setIngredientsByProduct] = useState({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [detailOrder, setDetailOrder] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const loadSeqRef = useRef(0)

  const parametri = tenantData?.parametri_operativi || {}
  const minutiVisibili = Number(parametri.pizzaiolo_ordini_visibili_minuti) || 45
  const partenzaConsegneMinuti = Number(parametri.pizzaiolo_partenza_consegne_minuti) || 30
  const tempoViaggioMinuti = Number(parametri.pizzaiolo_tempo_viaggio_minuti) || partenzaConsegneMinuti
  const slotMinutes = Number(parametri.ritiro_ogni_min) || Number(parametri.consegne_ogni_min) || 15

  const loadOrders = useCallback(async (opts = {}) => {
    const silent = opts.silent === true
    if (!tenantId) return
    const seq = ++loadSeqRef.current
    if (!silent) {
      setLoading(true)
      setError(null)
    }
    try {
      const data = await getOrders(tenantId, { stato: STATO_PRONTO, todayOnly: true, limit: 100 })
      const ids = (data || []).map((o) => o.id).filter(Boolean)
      const [pizze, righe] = await Promise.all([
        ids.length ? getRigheAggregateByOrdineIds(ids) : {},
        ids.length ? getRigheByOrdineIds(ids) : [],
      ])
      if (seq !== loadSeqRef.current) return
      setOrders(data || [])
      setPizzePerOrdine(pizze)

      const righePerOrd = {}
      const prodIds = new Set()
      for (const r of righe || []) {
        const oid = r.ordineId
        if (!righePerOrd[oid]) righePerOrd[oid] = []
        righePerOrd[oid].push(r)
        const pid = r.prodottoId ?? r.prodotto_id
        if (pid) prodIds.add(pid)
      }
      setRighePerOrdine(righePerOrd)

      const pIds = [...prodIds]
      const [prodotti, ingBatch] = await Promise.all([
        pIds.length ? getProdottiByIds(tenantId, pIds) : [],
        pIds.length ? getProductIngredientiBatch(tenantId, pIds) : {},
      ])
      if (seq !== loadSeqRef.current) return
      setProductNames((prodotti || []).reduce((acc, p) => ({ ...acc, [p.id]: p.nome || "—" }), {}))
      const ingMap = {}
      for (const pid of pIds) {
        ingMap[pid] = (ingBatch[pid] || []).map((ing) => ({
          nome: ing.nome,
          vaInCottura: ing.vaInCottura === true,
        }))
      }
      setIngredientsByProduct(ingMap)
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

  const ordiniVisibili = useMemo(() => {
    const base = filterOrdiniVisibili(orders, minutiVisibili)
    return [...base].sort((a, b) => {
      const ta = new Date(a.updatedAt ?? a.updated_at ?? a.createdAt ?? a.created_at).getTime() || 0
      const tb = new Date(b.updatedAt ?? b.updated_at ?? b.createdAt ?? b.created_at).getTime() || 0
      return ta - tb
    })
  }, [orders, minutiVisibili])

  const slotPizze = useMemo(
    () => slotPizzeCount(ordiniVisibili, pizzePerOrdine, PLANNING_GRID_SLOT_MINUTES),
    [ordiniVisibili, pizzePerOrdine]
  )
  const slotLabels = useMemo(
    () => sortedSlotLabels(slotPizze).filter((label) => (slotPizze[label] || 0) > 0),
    [slotPizze]
  )

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

  const markAsConsegnato = useCallback(
    async (ordineId) => {
      if (!ordineId) return
      setActionLoading(true)
      try {
        await updateOrderStato(ordineId, STATO_CONSEGNATO)
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

  const renderCard = (ord, isDelivery) => {
    const ritardo = getRitardoMinuti(ord, partenzaConsegneMinuti)
    const righe = righePerOrdine[ord.id] || []
    const pagamento = (ord.tipo_pagamento || "").trim()
    return (
      <div key={ord.id} style={styles.card}>
        <div style={styles.cardRow}>
          <button
            type="button"
            style={{
              ...styles.btnRitirato,
              ...(ritardo > 0 ? styles.btnRitiratoRitardo : {}),
            }}
            onClick={(e) => { e.stopPropagation(); markAsConsegnato(ord.id); }}
            disabled={actionLoading}
            title={ritardo > 0 ? `${ritardo} min in attesa` : "Segna come consegnato"}
          >
            {ritardo > 0 ? `${ritardo} min in attesa` : "Consegnato"}
          </button>
          <div
            style={styles.clienteBox}
            onClick={() => openDetail(ord.id)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === "Enter" && openDetail(ord.id)}
          >
            <strong>{ord.nome_cliente || "—"}</strong>
            {ord.orario_ritiro && (
              <span style={styles.orarioPagamentoRow}>
                <span style={styles.orarioCard}>{ord.orario_ritiro}</span>
                {pagamento && <span style={styles.pagamentoCard}> · {pagamento}</span>}
              </span>
            )}
            {isDelivery && ord.indirizzo_consegna && (
              <div style={styles.indirizzo}>{ord.indirizzo_consegna}</div>
            )}
          </div>
        </div>
        {righe.length > 0 && (() => {
          const key = (r) => `${r.prodottoId ?? r.prodotto_id}|${r.formatoNome ?? r.formato_nome ?? ""}`
          const aggregated = {}
          for (const r of righe) {
            const k = key(r)
            if (!aggregated[k]) {
              aggregated[k] = { pid: r.prodottoId ?? r.prodotto_id, formato: r.formatoNome ?? r.formato_nome, qta: 0, righe: [] }
            }
            aggregated[k].qta += Number(r.quantita) || 1
            aggregated[k].righe.push(r)
          }
          const list = Object.values(aggregated)
          return (
            <div style={styles.righeWrap}>
              {list.map((item, idx) => {
                const nomeBase = productNames[item.pid] ?? "—"
                const nomeCompleto = item.formato ? `${nomeBase} (${item.formato})` : nomeBase
                const qtyLabel = `${item.qta}×`
                const ingListBase = Array.isArray(ingredientsByProduct[item.pid])
                  ? ingredientsByProduct[item.pid]
                  : []
                const summaries = Array.from(
                  new Set(
                    (item.righe || [])
                      .map((r) => r.ingredientiCotturaSummary ?? r.ingredienti_cottura_summary ?? "")
                      .filter(Boolean)
                  )
                )
                return (
                  <div key={item.pid + (item.formato || "") + idx} style={styles.rigaRow}>
                    <div style={styles.rigaTop}>
                      <span style={styles.rigaQty}>{qtyLabel}</span>
                      <span style={styles.rigaNome}>{nomeCompleto}</span>
                    </div>
                    {summaries.length > 0 ? (
                      <div style={styles.rigaIngredienti}>
                        {summaries.map((txt, i) => (
                          <span key={i} style={styles.ingNormal}>
                            {txt}
                            {i < summaries.length - 1 ? " · " : ""}
                          </span>
                        ))}
                      </div>
                    ) : ingListBase.length > 0 ? (
                      <div style={styles.rigaIngredienti}>
                        {ingListBase.map((ing, i) => {
                          const isBold = ing.vaInCottura === false
                          return (
                            <span
                              key={ing.nome + i}
                              style={isBold ? styles.ingBold : styles.ingNormal}
                            >
                              {ing.nome}
                              {i < ingListBase.length - 1 ? ", " : ""}
                            </span>
                          )
                        })}
                      </div>
                    ) : null}
                  </div>
                )
              })}
            </div>
          )
        })()}
      </div>
    )
  }

  return (
    <div style={styles.wrapper}>
      <h1 style={styles.title}>Bancone</h1>
      <p style={styles.subtitle}>Ordini pronti per il ritiro</p>

      {error && <div style={styles.error}>{error}</div>}

      {slotLabels.length > 0 && (
        <div style={styles.slotsWrap}>
          {slotLabels.map((label) => (
            <div key={label} style={styles.slotBox}>
              <span style={styles.slotTime}>{label}</span>
              <span style={styles.slotCount}>{slotPizze[label]}</span>
            </div>
          ))}
        </div>
      )}

      {loading && ordiniVisibili.length === 0 ? (
        <p style={styles.muted}>Caricamento...</p>
      ) : ordiniVisibili.length === 0 ? (
        <p style={styles.muted}>Nessun ordine pronto.</p>
      ) : (
        <div style={styles.singleColumn}>
          {ordiniVisibili.map((ord) =>
            renderCard(ord, (ord.tipo_ordine || "").toLowerCase() === "delivery")
          )}
        </div>
      )}

      {(detailOrder || detailLoading) && (
        <OrderDetailModal
          order={detailOrder}
          loading={detailLoading}
          onClose={() => !actionLoading && setDetailOrder(null)}
          actionLabel={actionLoading ? "Salvataggio..." : "Consegnato"}
          onAction={markAsConsegnato}
          actionDisabled={actionLoading}
          ingredientsByProduct={ingredientsByProduct}
        />
      )}
    </div>
  )
}

const styles = {
  wrapper: { padding: 16 },
  title: { fontSize: 22, marginBottom: 4 },
  subtitle: { color: "#666", marginBottom: 16 },
  error: { padding: 12, background: "#ffebee", color: "#c62828", borderRadius: 8, marginBottom: 16 },
  slotsWrap: { display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 },
  slotBox: {
    padding: "4px 8px",
    background: "#e8f5e9",
    border: "1px solid #a5d6a7",
    borderRadius: 6,
    minWidth: 44,
    textAlign: "center",
  },
  slotTime: { display: "block", fontWeight: 600, fontSize: 11 },
  slotCount: { display: "block", fontSize: 13, fontWeight: 700, color: "#2e7d32" },
  singleColumn: { marginTop: 8, display: "flex", flexDirection: "column", gap: 10 },
  muted: { color: "#888", marginTop: 8 },
  card: { border: "1px solid #e0e0e0", borderRadius: 8, padding: 12, marginBottom: 10, background: "#fff" },
  cardRow: { display: "flex", alignItems: "stretch", gap: 10 },
  btnRitirato: {
    flexShrink: 0,
    padding: "10px 14px",
    background: "#2e7d32",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    cursor: "pointer",
    fontWeight: 600,
    fontSize: 13,
  },
  btnRitiratoRitardo: { background: "#c62828", color: "#fff" },
  clienteBox: {
    flex: 1,
    padding: "8px 10px",
    background: "#f5f5f5",
    borderRadius: 8,
    border: "1px solid #e0e0e0",
    cursor: "pointer",
    fontSize: 14,
  },
  orarioPagamentoRow: { marginLeft: 4, fontSize: 12, color: "#555" },
  orarioCard: { },
  pagamentoCard: { },
  indirizzo: { fontSize: 12, color: "#555", marginTop: 4 },
  righeWrap: { marginTop: 10, paddingTop: 10, borderTop: "1px solid #eee" },
  rigaRow: { marginBottom: 8 },
  rigaTop: { display: "flex", alignItems: "baseline", gap: 8 },
  rigaQty: { fontSize: 13, color: "#555", minWidth: 32 },
  rigaNome: { fontSize: 15, fontWeight: 700, color: "#222" },
  rigaIngredienti: { display: "block", fontSize: 11, color: "#444", marginTop: 2 },
  ingBold: { fontWeight: 700 },
  ingNormal: { fontWeight: 400 },
}
