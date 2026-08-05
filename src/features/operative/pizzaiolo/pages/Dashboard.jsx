import { useState, useCallback, useMemo, useRef } from "react"
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
  orarioToMinutes,
} from "@/features/operative/pizzaiolo/utils/pizzaioloUtils"
import { PLANNING_GRID_SLOT_MINUTES } from "@/features/operative/cassa/utils/planningUtils"
import { isDeliveryUrgentForno } from "@/utils/riderDeliveryConfig"
import { formatIndirizzoDisplayItaliano } from "@/utils/formatIndirizzoItaliano"
import { useRepartiQuadTest } from "@/features/operative/contexts/RepartiQuadTestContext"
import { useOperativeOrdersLiveRefresh } from "@/features/operative/hooks/useOperativeOrdersLiveRefresh"
import { canRepartoStampareRicevutaCortesia } from "@/utils/stampaOperativaConfig"
import { printRicevutaCortesiaFromDetail } from "@/features/operative/cassa/utils/stampaRicevutaCortesia"

const STATO_PREPARAZIONE = "IN_PREPARAZIONE"
const STATO_PRONTO = "PRONTO"
/** Polling di sicurezza se Realtime non arriva */
const POLL_FALLBACK_MS = 30000

function googleMapsUrl(indirizzo) {
  if (!indirizzo || !indirizzo.trim()) return null
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(indirizzo.trim())}`
}

export default function PizzaioloDashboard() {
  const quad = useRepartiQuadTest()
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
  const [cortesiaBusy, setCortesiaBusy] = useState(false)
  const loadSeqRef = useRef(0)

  const parametri = tenantData?.parametri_operativi || {}
  const showPrintCortesia = canRepartoStampareRicevutaCortesia(parametri, "pizzaiolo")
  const minutiVisibili = Number(parametri.pizzaiolo_ordini_visibili_minuti) || 45
  const partenzaConsegneMinuti = Number(parametri.pizzaiolo_partenza_consegne_minuti) || 30
  const loadOrders = useCallback(async (opts = {}) => {
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
          id: ing.id,
          nome: ing.nome,
          vaInCottura: ing.vaInCottura === true,
          prepCucina: ing.prepCucina === true,
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

  useOperativeOrdersLiveRefresh({
    tenantId,
    onRefresh: () => loadOrders({ silent: true }),
    pollMs: POLL_FALLBACK_MS,
  })

  const ordiniVisibili = useMemo(
    () => sortOrdiniByOrario(filterOrdiniVisibili(orders, minutiVisibili)),
    [orders, minutiVisibili]
  )
  const ordiniNegozio = useMemo(
    () => ordiniVisibili.filter((o) => (o.tipo_ordine || "").toLowerCase() !== "delivery"),
    [ordiniVisibili]
  )
  const ordiniDelivery = useMemo(
    () => ordiniVisibili.filter((o) => (o.tipo_ordine || "").toLowerCase() === "delivery"),
    [ordiniVisibili]
  )

  /* Riepilogo pizze per slot: tutti gli ordini in cottura del giorno (come carico API), non solo la finestra oraria delle colonne. */
  const slotPizze = useMemo(
    () => slotPizzeCount(orders, pizzePerOrdine, PLANNING_GRID_SLOT_MINUTES),
    [orders, pizzePerOrdine],
  )
  const slotLabels = useMemo(
    () => sortedSlotLabels(slotPizze).filter((label) => (slotPizze[label] || 0) > 0),
    [slotPizze],
  )
  const pizzeSenzaOrarioSlot = useMemo(() => {
    let n = 0
    for (const o of orders || []) {
      if (orarioToMinutes(o.orario_ritiro ?? o.orarioRitiro) == null) n += pizzePerOrdine[o.id] ?? 0
    }
    return n
  }, [orders, pizzePerOrdine])

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

  const renderCard = (ord, isDelivery) => {
    const ritardo = getRitardoMinuti(ord, partenzaConsegneMinuti)
    const urgForno = isDelivery && isDeliveryUrgentForno(ord, parametri, partenzaConsegneMinuti)
    const mapsUrl = isDelivery ? googleMapsUrl(ord.indirizzo_consegna) : null
    const righe = righePerOrdine[ord.id] || []
    const pagamento = (ord.tipo_pagamento || "").trim()
    return (
      <div
        key={ord.id}
        style={{
          ...styles.card,
          ...(urgForno
            ? {
                border: "2px solid #e65100",
                background: "#fff8e1",
                boxShadow: "0 0 0 1px rgba(230,81,0,0.35)",
              }
            : {}),
        }}
      >
        <div style={styles.cardRow}>
          <button
            type="button"
            style={{
              ...styles.btnInForno,
              ...(ritardo > 0 ? styles.btnInFornoRitardo : {}),
            }}
            onClick={(e) => { e.stopPropagation(); markAsPronto(ord.id); }}
            disabled={actionLoading}
            title={ritardo > 0 ? `${ritardo} min ritardo` : "Segna come pronto"}
          >
            {ritardo > 0 ? `${ritardo} min ritardo` : "In forno"}
          </button>
          <div
            style={styles.clienteBox}
            onClick={() => openDetail(ord.id)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === "Enter" && openDetail(ord.id)}
          >
            {isDelivery && mapsUrl ? (
              <>
                <a href={mapsUrl} target="_blank" rel="noopener noreferrer" style={styles.mapsLink} onClick={(e) => e.stopPropagation()}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <strong>{ord.nome_cliente || "—"}</strong>
                    {urgForno ? (
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
                  </div>
                  <br />
                  <span style={styles.indirizzo}>
                    {ord.indirizzo_consegna ? formatIndirizzoDisplayItaliano(ord.indirizzo_consegna) : "—"}
                  </span>
                </a>
              </>
            ) : (
              <>
                <strong>{ord.nome_cliente || "—"}</strong>
                {ord.orario_ritiro && (
                  <span style={styles.orarioPagamentoRow}>
                    <span style={styles.orarioCard}>{ord.orario_ritiro}</span>
                    {pagamento && <span style={styles.pagamentoCard}> · {pagamento}</span>}
                  </span>
                )}
              </>
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
                          const isBold = ing.vaInCottura === true
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
    <div className="pizzaiolo-dashboard-root">
      {!quad ? <h1 style={styles.title}>Pizzaiolo</h1> : null}

      {error && <div style={styles.error}>{error}</div>}

      {/* Riquadri orari con numero pizze (tutti gli ordini IN_PREPARAZIONE caricati) */}
      {(slotLabels.length > 0 || pizzeSenzaOrarioSlot > 0) && (
        <div style={styles.slotsWrap}>
          {slotLabels.map((label) => (
            <div key={label} style={styles.slotBox}>
              <span style={styles.slotTime}>{label}</span>
              <span style={styles.slotCount}>{slotPizze[label]}</span>
              <span style={styles.slotUnit}>pizze</span>
            </div>
          ))}
          {pizzeSenzaOrarioSlot > 0 ? (
            <div key="no-time" style={{ ...styles.slotBox, background: "#fff3e0", borderColor: "#ffcc80" }}>
              <span style={styles.slotTime}>Senza orario</span>
              <span style={{ ...styles.slotCount, color: "#e65100" }}>{pizzeSenzaOrarioSlot}</span>
              <span style={styles.slotUnit}>pizze</span>
            </div>
          ) : null}
        </div>
      )}

      {/* Due colonne */}
      <div className="pizzaiolo-dashboard-columns">
        <div style={styles.column}>
          {!quad ? <h2 style={styles.columnTitle}>In negozio</h2> : null}
          {loading && ordiniNegozio.length === 0 ? (
            quad ? null : <p style={styles.muted}>Caricamento...</p>
          ) : ordiniNegozio.length === 0 ? (
            quad ? null : <p style={styles.muted}>Nessun ordine in preparazione.</p>
          ) : (
            ordiniNegozio.map((ord) => renderCard(ord, false))
          )}
        </div>
        <div style={styles.column}>
          {!quad ? <h2 style={styles.columnTitle}>A domicilio</h2> : null}
          {loading && ordiniDelivery.length === 0 ? (
            quad ? null : <p style={styles.muted}>Caricamento...</p>
          ) : ordiniDelivery.length === 0 ? (
            quad ? null : <p style={styles.muted}>Nessun ordine in preparazione.</p>
          ) : (
            ordiniDelivery.map((ord) => renderCard(ord, true))
          )}
        </div>
      </div>

      {(detailOrder || detailLoading) && (
        <OrderDetailModal
          order={detailOrder}
          loading={detailLoading}
          onClose={() => !actionLoading && !cortesiaBusy && setDetailOrder(null)}
          actionLabel={actionLoading ? "Salvataggio..." : "Segna come pronto"}
          onAction={markAsPronto}
          actionDisabled={actionLoading || cortesiaBusy}
          ingredientsByProduct={ingredientsByProduct}
          showPrintCortesia={showPrintCortesia}
          printCortesiaBusy={cortesiaBusy}
          onPrintCortesia={() => {
            if (!detailOrder || cortesiaBusy) return
            setCortesiaBusy(true)
            try {
              printRicevutaCortesiaFromDetail(detailOrder, tenantData)
            } finally {
              setCortesiaBusy(false)
            }
          }}
        />
      )}
    </div>
  )
}

const styles = {
  title: { fontSize: 22, margin: "0 0 12px", flexShrink: 0 },
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
  slotCount: { display: "block", fontSize: 16, fontWeight: 700, color: "#2e7d32", lineHeight: 1.2 },
  slotUnit: { display: "block", fontSize: 9, color: "#558b2f", fontWeight: 500 },
  column: { minWidth: 0 },
  columnTitle: { margin: "0 0 12px", fontSize: 16 },
  muted: { color: "#888", marginTop: 8 },
  card: { border: "1px solid #e0e0e0", borderRadius: 8, padding: 12, marginBottom: 10, background: "#fff" },
  cardRow: { display: "flex", alignItems: "stretch", gap: 10 },
  btnInForno: {
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
  btnInFornoRitardo: { background: "#c62828", color: "#fff" },
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
  mapsLink: { color: "#1565c0", textDecoration: "none" },
  indirizzo: { fontSize: 12, color: "#555" },
  righeWrap: { marginTop: 10, paddingTop: 10, borderTop: "1px solid #eee" },
  rigaRow: { marginBottom: 8 },
  rigaTop: { display: "flex", alignItems: "baseline", gap: 8 },
  rigaQty: { fontSize: 13, color: "#555", minWidth: 32 },
  rigaNome: { fontSize: 15, fontWeight: 700, color: "#222" },
  rigaIngredienti: { display: "block", fontSize: 11, color: "#444", marginTop: 2 },
  ingBold: { fontWeight: 700 },
  ingNormal: { fontWeight: 400 },
}
