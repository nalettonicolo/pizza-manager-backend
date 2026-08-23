import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import { useTenant } from "@/app/contexts/TenantContext"
import {
  getOrders,
  getOrderDetail,
  getProdottiByIds,
  getRigheAggregateByOrdineIds,
  getRigheByOrdineIds,
  getProductIngredientiBatch,
  getIngredients,
  updateOrderStato,
  updateOrderCucinaPrepStato,
} from "@/features/admin/services/adminService"
import OrderDetailModal from "@/features/operative/components/OrderDetailModal"
import {
  filterOrdiniVisibili,
  sortOrdiniByOrario,
  getRitardoMinuti,
  slotPizzeCount,
  sortedSlotLabels,
  orarioToMinutes,
  minutesToOrario,
  kitchenDeadlineMinutes,
  readPizzaioloLeadTimeConsegnaMin,
} from "@/features/operative/pizzaiolo/utils/pizzaioloUtils"
import { PLANNING_GRID_SLOT_MINUTES } from "@/features/operative/cassa/utils/planningUtils"
import { isDeliveryUrgentForno } from "@/utils/riderDeliveryConfig"
import { formatIndirizzoDisplayItaliano } from "@/utils/formatIndirizzoItaliano"
import { useRepartiQuadTest } from "@/features/operative/contexts/RepartiQuadTestContext"
import { useOperativeOrdersLiveRefresh } from "@/features/operative/hooks/useOperativeOrdersLiveRefresh"
import { canRepartoStampareRicevutaCortesia } from "@/utils/stampaOperativaConfig"
import { printRicevutaCortesiaFromDetail } from "@/features/operative/cassa/utils/stampaRicevutaCortesia"
import {
  buildCucinaPrepTasks,
  slotTabLabel,
  sortedCucinaSlotTabs,
  aggregatePrepTasksBySlot,
  markAggregatedPrepDone,
} from "@/features/operative/cucina/utils/cucinaPrepTasks"
import {
  mergeCucinaPrepColorsFromParametri,
  resolvePrepTaskBackgroundColor,
} from "@/utils/cucinaPrepCategoryTheme"

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
  const [righeAll, setRigheAll] = useState([])
  const [productNames, setProductNames] = useState({})
  const [productPrepCucinaById, setProductPrepCucinaById] = useState({})
  const [productPrepMetaById, setProductPrepMetaById] = useState({})
  const [ingredientsByProduct, setIngredientsByProduct] = useState({})
  const [ingredientiGlobali, setIngredientiGlobali] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [detailOrder, setDetailOrder] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [cortesiaBusy, setCortesiaBusy] = useState(false)

  /** Catalogo ingredienti completo (nome→categoria/colore): fallback per gli "extra" aggiunti a
   * una riga che non fanno parte della ricetta base di nessun prodotto già caricato (altrimenti
   * risultano grigi "comune" nel pannello "Ingredienti fuori linea" anche se in anagrafica hanno
   * una categoria impostata). Cambia raramente: un fetch per tenant, non ad ogni refresh ordini. */
  useEffect(() => {
    if (!tenantId) return
    let cancelled = false
    getIngredients(tenantId)
      .then((list) => {
        if (!cancelled) setIngredientiGlobali(Array.isArray(list) ? list : [])
      })
      .catch((e) => console.warn("[Pizzaiolo] getIngredients:", e))
    return () => {
      cancelled = true
    }
  }, [tenantId])
  const [prepActionKey, setPrepActionKey] = useState(null)
  const loadSeqRef = useRef(0)

  const parametri = tenantData?.parametri_operativi || {}
  const showPrintCortesia = canRepartoStampareRicevutaCortesia(parametri, "pizzaiolo")
  const minutiVisibili = Number(parametri.pizzaiolo_ordini_visibili_minuti) || 45
  const leadTimeConsegnaMin = readPizzaioloLeadTimeConsegnaMin(parametri)
  const prepCategoryColors = useMemo(
    () => mergeCucinaPrepColorsFromParametri(tenantData?.parametri_operativi),
    [tenantData?.parametri_operativi],
  )
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
        ids.length ? getRigheAggregateByOrdineIds(ids, tenantId) : {},
        ids.length ? getRigheByOrdineIds(ids) : [],
      ])
      if (seq !== loadSeqRef.current) return
      setOrders(data || [])
      setPizzePerOrdine(pizze)
      setRigheAll(righe || [])

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
      setProductPrepCucinaById(
        (prodotti || []).reduce(
          (acc, p) => ({ ...acc, [p.id]: p.prep_cucina === true || p.prepCucina === true }),
          {},
        ),
      )
      setProductPrepMetaById(
        (prodotti || []).reduce(
          (acc, p) => ({
            ...acc,
            [p.id]: { categoria: p.prep_categoria || p.prepCategoria || "", colore: p.prep_colore || p.prepColore || "" },
          }),
          {},
        ),
      )
      // Forma grezza (id/nome/categoria/colore/vaInCottura/prepCucina): serve sia al riepilogo
      // ingredienti per riga qui sotto sia al pannello "fuori linea" (buildCucinaPrepTasks).
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
    () => slotPizzeCount(orders, pizzePerOrdine, PLANNING_GRID_SLOT_MINUTES, leadTimeConsegnaMin),
    [orders, pizzePerOrdine, leadTimeConsegnaMin],
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

  /**
   * Ingredienti "fuori linea" (congelati, affettati, dolci, fritti, generici — stessa logica
   * colore/rilevamento di Cucina): il pizzaiolo li vede per non dimenticarli, anche se la
   * preparazione fisica spetta a Cucina/Bancone. Click = "pronto", stesso `cucina_prep_stato`
   * dell'ordine: coordinato con Cucina/Bancone, non una checklist separata.
   */
  const tasksBySlot = useMemo(
    () =>
      buildCucinaPrepTasks(
        orders,
        righeAll,
        productNames,
        ingredientsByProduct,
        PLANNING_GRID_SLOT_MINUTES,
        productPrepCucinaById,
        productPrepMetaById,
        ingredientiGlobali,
      ),
    [orders, righeAll, productNames, ingredientsByProduct, productPrepCucinaById, productPrepMetaById, ingredientiGlobali],
  )
  const fuoriLineaBySlot = useMemo(() => aggregatePrepTasksBySlot(tasksBySlot), [tasksBySlot])
  const fuoriLineaSlotKeys = useMemo(() => sortedCucinaSlotTabs(tasksBySlot), [tasksBySlot])
  const hasFuoriLinea = useMemo(
    () => Object.values(fuoriLineaBySlot).some((arr) => (arr || []).some((a) => (a.count || 0) > (a.doneCount || 0))),
    [fuoriLineaBySlot],
  )

  const handleMarkFuoriLineaDone = useCallback(
    async (agg) => {
      if (!agg?.pendingTasks?.length) return
      setPrepActionKey(agg.pickKey)
      try {
        const { nextByOrdineId } = markAggregatedPrepDone(orders, agg.pendingTasks)
        const entries = Object.entries(nextByOrdineId)
        await Promise.all(entries.map(([oid, next]) => updateOrderCucinaPrepStato(oid, next)))
        setOrders((prev) =>
          prev.map((o) => (nextByOrdineId[o.id] ? { ...o, cucina_prep_stato: nextByOrdineId[o.id] } : o)),
        )
      } catch (err) {
        console.error(err)
        setError("Errore nell'aggiornamento preparazione.")
      } finally {
        setPrepActionKey(null)
      }
    },
    [orders],
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
    const ritardo = getRitardoMinuti(ord, leadTimeConsegnaMin)
    const urgForno = isDelivery && isDeliveryUrgentForno(ord, parametri, leadTimeConsegnaMin)
    const mapsUrl = isDelivery ? googleMapsUrl(ord.indirizzo_consegna) : null
    const righe = righePerOrdine[ord.id] || []
    const pagamento = (ord.tipo_pagamento || "").trim()
    const orarioCliente = ord.orario_ritiro ?? ord.orarioRitiro
    const deadlineMin = isDelivery ? kitchenDeadlineMinutes(ord, leadTimeConsegnaMin) : null
    const orarioPronte = deadlineMin != null ? minutesToOrario(deadlineMin) : null
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
            title={
              ritardo > 0
                ? `${ritardo} min oltre la scadenza forno${orarioPronte ? ` (${orarioPronte})` : ""}`
                : isDelivery && orarioPronte
                  ? `Pronte entro ${orarioPronte} (consegna ${orarioCliente || "—"})`
                  : "Segna come pronto"
            }
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
                  title={
                    orarioPronte
                      ? `Mandare al forno: pizze pronte entro ${orarioPronte}`
                      : "Consegna: mandare al forno con urgenza (finestra critica)"
                  }
                >
                  FORNO URGENTE
                </span>
              ) : null}
            </div>
            {orarioCliente ? (
              <span style={styles.orarioPagamentoRow}>
                <span style={styles.orarioCard}>{orarioCliente}</span>
                {isDelivery && orarioPronte ? (
                  <span style={styles.pagamentoCard}> · forno ≤ {orarioPronte}</span>
                ) : null}
                {pagamento ? <span style={styles.pagamentoCard}> · {pagamento}</span> : null}
              </span>
            ) : pagamento ? (
              <span style={styles.orarioPagamentoRow}>
                <span style={styles.pagamentoCard}>{pagamento}</span>
              </span>
            ) : null}
            {isDelivery && mapsUrl ? (
              <a
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={styles.mapsLink}
                onClick={(e) => e.stopPropagation()}
              >
                <span style={styles.indirizzo}>
                  {ord.indirizzo_consegna ? formatIndirizzoDisplayItaliano(ord.indirizzo_consegna) : "—"}
                </span>
              </a>
            ) : isDelivery && ord.indirizzo_consegna ? (
              <div style={styles.indirizzo}>{formatIndirizzoDisplayItaliano(ord.indirizzo_consegna)}</div>
            ) : null}
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

      {/* Riquadri orari con numero pizze (tutti gli ordini IN_PREPARAZIONE caricati) — i riquadri
          stessi bastano a far capire che ci sono ordini più avanti, senza bisogno di un testo. */}
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

      {/* Ingredienti fuori linea (congelati, affettati, dolci, fritti, generici — stessi colori
          e stato "pronto" condiviso con Cucina/Bancone; per non dimenticarli in fase di stesura). */}
      {hasFuoriLinea && !quad ? (
        <div style={styles.fuoriLineaWrap}>
          <h2 style={styles.fuoriLineaTitle}>Ingredienti fuori linea</h2>
          {fuoriLineaSlotKeys.map((slot) => {
            const pending = (fuoriLineaBySlot[slot] || []).filter((a) => (a.count || 0) > (a.doneCount || 0))
            if (pending.length === 0) return null
            return (
              <div key={slot} style={styles.fuoriLineaSlotRow}>
                <span style={styles.fuoriLineaSlotLabel}>{slotTabLabel(slot)}</span>
                <div style={styles.pickChipWrap}>
                  {pending.map((agg) => {
                    const bg = resolvePrepTaskBackgroundColor(
                      { ingredienteColore: agg.colore, ingredienteCategoria: agg.categoria },
                      prepCategoryColors,
                    )
                    const busy = prepActionKey === agg.pickKey
                    const remaining = Math.max(0, (agg.count || 0) - (agg.doneCount || 0))
                    return (
                      <button
                        key={agg.pickKey}
                        type="button"
                        disabled={busy}
                        onClick={() => handleMarkFuoriLineaDone(agg)}
                        style={{ ...styles.fuoriLineaChip, background: bg }}
                        title="Tocca quando l'hai preso/preparato."
                      >
                        {remaining > 1 ? `${remaining}× ` : ""}
                        {agg.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      ) : null}

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
  fuoriLineaWrap: {
    marginBottom: 14,
    padding: 12,
    background: "#fafafa",
    border: "1px solid #e0e0e0",
    borderRadius: 8,
  },
  fuoriLineaTitle: { margin: "0 0 8px", fontSize: 14, fontWeight: 700, color: "#334155" },
  fuoriLineaSlotRow: { marginBottom: 8 },
  fuoriLineaSlotLabel: { display: "block", fontSize: 11, fontWeight: 700, color: "#64748b", marginBottom: 4 },
  pickChipWrap: { display: "flex", flexWrap: "wrap", gap: 6 },
  fuoriLineaChip: {
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid #cbd5e1",
    fontSize: 12,
    fontWeight: 600,
    color: "#1a1a1a",
    cursor: "pointer",
  },
}
