import { useEffect, useState, useCallback, useMemo, useRef } from "react"
import { useTenant } from "@/app/contexts/TenantContext"
import {
  getOrders,
  getOrderDetail,
  getProdottiByIds,
  getRigheAggregateByOrdineIds,
  getRigheByOrdineIds,
  getProductIngredientiBatch,
  getCategorieByIds,
  updateOrderStato,
} from "@/features/admin/services/adminService"
import {
  aggregateBanconeBibiteBySlot,
  aggregateBanconeIngredientsBySlot,
  banconeIngredientPickedColor,
  banconeSlotsFromOrders,
  BANCONE_BIBITE_PICKED_BG,
} from "@/features/operative/bancone/utils/banconeSlotPick"
import OrderDetailModal from "@/features/operative/components/OrderDetailModal"
import {
  filterOrdiniVisibili,
  getRitardoMinuti,
  slotPizzeCount,
  sortedSlotLabels,
} from "@/features/operative/pizzaiolo/utils/pizzaioloUtils"
import { PLANNING_GRID_SLOT_MINUTES } from "@/features/operative/cassa/utils/planningUtils"
import { isDeliveryUrgentPartenzaBancone } from "@/utils/riderDeliveryConfig"
import { formatIndirizzoDisplayItaliano } from "@/utils/formatIndirizzoItaliano"
import { useRepartiQuadTest } from "@/features/operative/contexts/RepartiQuadTestContext"
import { useOperativeOrdersLiveRefresh } from "@/features/operative/hooks/useOperativeOrdersLiveRefresh"

const STATO_PRONTO = "PRONTO"
const STATO_CONSEGNATO = "CONSEGNATO"
const POLL_FALLBACK_MS = 30000
const BANCONE_PICK_STORAGE_PREFIX = "pm_bancone_picked_v1"

function getBanconePickStorageKey(tenantId) {
  if (!tenantId) return null
  return `${BANCONE_PICK_STORAGE_PREFIX}:${tenantId}`
}

export default function Bancone() {
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
  const [bibiteProductIds, setBibiteProductIds] = useState(() => new Set())
  /** Chiave ingrediente/bibita/summary preso in busta (inverso cucina: parte grigio, tap = colore). */
  const [pickedBanconeKeys, setPickedBanconeKeys] = useState(() => new Set())
  const [lastPickResetReason, setLastPickResetReason] = useState("")
  const loadSeqRef = useRef(0)
  const prevOrderIdsKeyRef = useRef("")

  const parametri = tenantData?.parametri_operativi || {}
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

      const catIds = [...new Set((prodotti || []).map((p) => p.categoria_id ?? p.categoriaId).filter(Boolean))]
      let bibitePids = new Set()
      if (catIds.length) {
        try {
          const cats = await getCategorieByIds(tenantId, catIds)
          const bibiteCatIds = new Set(
            (cats || []).filter((c) => (c.slug || "").toLowerCase() === "bibite").map((c) => c.id)
          )
          bibitePids = new Set(
            (prodotti || []).filter((p) => bibiteCatIds.has(p.categoria_id ?? p.categoriaId)).map((p) => p.id)
          )
        } catch (e) {
          console.warn("Bancone categorie bibite:", e)
        }
      }
      if (seq !== loadSeqRef.current) return
      setBibiteProductIds(bibitePids)

      const ingMap = {}
      for (const pid of pIds) {
        ingMap[pid] = (ingBatch[pid] || []).map((ing) => ({
          id: ing.id,
          nome: ing.nome,
          prepCucina: ing.prepCucina === true,
          vaInCottura: ing.vaInCottura === true,
          categoria: ing.categoria,
          colore: ing.colore,
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

  useEffect(() => {
    const storageKey = getBanconePickStorageKey(tenantId)
    if (!storageKey) return
    try {
      const raw = window.localStorage.getItem(storageKey)
      if (!raw) {
        setPickedBanconeKeys(new Set())
        setLastPickResetReason("")
        return
      }
      const parsed = JSON.parse(raw)
      const keys = Array.isArray(parsed?.keys) ? parsed.keys.filter((k) => typeof k === "string" && k.trim() !== "") : []
      setPickedBanconeKeys(new Set(keys))
      setLastPickResetReason(parsed?.reason ? String(parsed.reason) : "")
    } catch {
      setPickedBanconeKeys(new Set())
      setLastPickResetReason("Ripristino stato non disponibile (dati locali non validi).")
    }
  }, [tenantId])

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

  const orderStateKey = useMemo(
    () =>
      ordiniVisibili
        .map((o) => {
          const prep = JSON.stringify(o?.cucina_prep_stato ?? o?.cucinaPrepStato ?? {})
          return `${o.id}:${prep}`
        })
        .filter(Boolean)
        .sort()
        .join(","),
    [ordiniVisibili]
  )

  const banconeSlotOrder = useMemo(
    () => banconeSlotsFromOrders(ordiniVisibili, PLANNING_GRID_SLOT_MINUTES),
    [ordiniVisibili]
  )

  const ingredientsBySlot = useMemo(
    () =>
      aggregateBanconeIngredientsBySlot(
        ordiniVisibili,
        righePerOrdine,
        ingredientsByProduct,
        PLANNING_GRID_SLOT_MINUTES
      ),
    [ordiniVisibili, righePerOrdine, ingredientsByProduct]
  )

  const bibiteBySlot = useMemo(
    () =>
      aggregateBanconeBibiteBySlot(
        ordiniVisibili,
        righePerOrdine,
        productNames,
        bibiteProductIds,
        PLANNING_GRID_SLOT_MINUTES
      ),
    [ordiniVisibili, righePerOrdine, productNames, bibiteProductIds]
  )

  const availablePickKeys = useMemo(() => {
    const set = new Set()
    for (const slot of Object.keys(ingredientsBySlot || {})) {
      for (const item of ingredientsBySlot[slot] || []) {
        if (item?.pickKey) set.add(item.pickKey)
      }
    }
    for (const slot of Object.keys(bibiteBySlot || {})) {
      for (const item of bibiteBySlot[slot] || []) {
        if (item?.pickKey) set.add(item.pickKey)
      }
    }
    return set
  }, [ingredientsBySlot, bibiteBySlot])

  useEffect(() => {
    if (prevOrderIdsKeyRef.current === orderStateKey) return
    prevOrderIdsKeyRef.current = orderStateKey
    setPickedBanconeKeys((prev) => {
      if (!prev?.size) return prev
      const pruned = [...prev].filter((k) => availablePickKeys.has(k))
      if (pruned.length === prev.size) return prev
      const removed = prev.size - pruned.length
      setLastPickResetReason(
        removed > 0
          ? `Aggiornamento ordini: rimossi ${removed} check non più validi.`
          : "",
      )
      return new Set(pruned)
    })
  }, [orderStateKey, availablePickKeys])

  useEffect(() => {
    const storageKey = getBanconePickStorageKey(tenantId)
    if (!storageKey) return
    try {
      const payload = {
        keys: [...pickedBanconeKeys],
        reason: lastPickResetReason || "",
        savedAt: new Date().toISOString(),
      }
      window.localStorage.setItem(storageKey, JSON.stringify(payload))
    } catch {
      // storage pieno/disabilitato: non bloccare il servizio
    }
  }, [tenantId, pickedBanconeKeys, lastPickResetReason])

  const togglePickedBancone = useCallback((pickKey) => {
    if (!pickKey) return
    setPickedBanconeKeys((prev) => {
      const next = new Set(prev)
      if (next.has(pickKey)) next.delete(pickKey)
      else next.add(pickKey)
      return next
    })
  }, [])

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
    const urgPartenza = isDelivery && isDeliveryUrgentPartenzaBancone(ord, parametri)
    const righe = righePerOrdine[ord.id] || []
    const pagamento = (ord.tipo_pagamento || "").trim()
    return (
      <div
        key={ord.id}
        style={{
          ...styles.card,
          ...(urgPartenza
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
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <strong>{ord.nome_cliente || "—"}</strong>
              {urgPartenza ? (
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 800,
                    color: "#bf360c",
                    background: "#ffe0b2",
                    padding: "2px 8px",
                    borderRadius: 6,
                  }}
                  title="Consegna: partenza rider in finestra critica"
                >
                  PARTENZA URGENTE
                </span>
              ) : null}
            </div>
            {ord.orario_ritiro && (
              <span style={styles.orarioPagamentoRow}>
                <span style={styles.orarioCard}>{ord.orario_ritiro}</span>
                {pagamento && <span style={styles.pagamentoCard}> · {pagamento}</span>}
              </span>
            )}
            {isDelivery && ord.indirizzo_consegna && (
              <div style={styles.indirizzo}>{formatIndirizzoDisplayItaliano(ord.indirizzo_consegna)}</div>
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
    <div style={styles.wrapper} className="operative-mobile-pad">
      {!quad ? (
        <>
          <h1 style={styles.title}>Bancone</h1>
          <p style={styles.subtitle}>Ordini pronti per il ritiro</p>
        </>
      ) : null}

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
        quad ? null : <p style={styles.muted}>Caricamento...</p>
      ) : ordiniVisibili.length === 0 ? (
        quad ? null : <p style={styles.muted}>Nessun ordine pronto.</p>
      ) : (
        <div style={styles.mainRow} className="bancone-layout-main">
          <aside
            className="bancone-layout-aside"
            style={styles.leftPickColumn}
            aria-label="Check ingredienti per fascia oraria"
          >
            {!quad ? (
              <>
                <h2 style={styles.pickColumnTitle}>Ingredienti per orario</h2>
                <p style={styles.pickHint}>
                  Elenco basato su &quot;Prep. cucina&quot;: grigio = da prendere per la busta, tocca quando l&apos;hai messo.
                </p>
              </>
            ) : null}
            {lastPickResetReason && !quad ? <p style={styles.pickResetHint}>{lastPickResetReason}</p> : null}
            {banconeSlotOrder.map((slot) => {
              const ingList = ingredientsBySlot[slot] || []
              const bibList = bibiteBySlot[slot] || []
              return (
                <div key={slot} style={styles.slotPickBox}>
                  <div style={styles.slotPickTime}>{slot}</div>
                  {ingList.length === 0 && bibList.length === 0 ? (
                    quad ? null : <p style={styles.slotPickEmpty}>Nessun ingrediente in elenco per questa fascia.</p>
                  ) : null}
                  {ingList.length > 0 ? (
                    <div style={styles.pickChipWrap}>
                      {ingList.map((item) => {
                        const picked = pickedBanconeKeys.has(item.pickKey)
                        const fullBg = banconeIngredientPickedColor(item)
                        const nonCottura = item.nonCottura !== false
                        const kitchenPrepared = Number(item.doneCount || 0) > 0
                        const disabledForCottura = !nonCottura
                        return (
                          <button
                            key={item.pickKey}
                            type="button"
                            style={{
                              ...styles.pickChip,
                              ...(picked
                                ? { background: fullBg, color: "#1a1a1a", borderColor: "#9e9e9e", fontWeight: 600 }
                                : styles.pickChipTodo),
                              ...(kitchenPrepared ? styles.pickChipFromKitchen : {}),
                              ...(disabledForCottura ? styles.pickChipDisabled : {}),
                            }}
                            onClick={() => {
                              if (disabledForCottura) return
                              togglePickedBancone(item.pickKey)
                            }}
                            title={
                              disabledForCottura
                                ? "Ingrediente in cottura: il pick Bancone è disponibile solo per voci fuori cottura."
                                : kitchenPrepared
                                  ? "Preparato in cucina: ora risulta in grigio su Bancone. Tocca per segnarlo preso al bancone."
                                  : "Tocca quando l'hai messo in busta."
                            }
                          >
                            {item.count > 1 ? `${item.count}× ` : ""}
                            {item.label}
                            {kitchenPrepared ? " · da cucina" : ""}
                          </button>
                        )
                      })}
                    </div>
                  ) : null}
                  {bibList.length > 0 ? (
                    <>
                      {!quad ? <div style={styles.bibiteSubheading}>Bibite</div> : null}
                      <div style={styles.pickChipWrap}>
                        {bibList.map((item) => {
                          const picked = pickedBanconeKeys.has(item.pickKey)
                          return (
                            <button
                              key={item.pickKey}
                              type="button"
                              style={{
                                ...styles.pickChip,
                                ...(picked
                                  ? {
                                      background: BANCONE_BIBITE_PICKED_BG,
                                      color: "#01579b",
                                      borderColor: "#4fc3f7",
                                      fontWeight: 600,
                                    }
                                  : styles.pickChipTodo),
                              }}
                              onClick={() => togglePickedBancone(item.pickKey)}
                            >
                              {item.count > 1 ? `${item.count}× ` : ""}
                              {item.label}
                            </button>
                          )
                        })}
                      </div>
                    </>
                  ) : null}
                </div>
              )
            })}
          </aside>
          <div style={styles.rightOrdersColumn}>
            {ordiniVisibili.map((ord) =>
              renderCard(ord, (ord.tipo_ordine || "").toLowerCase() === "delivery")
            )}
          </div>
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
  wrapper: { padding: "clamp(12px, 3vw, 16px)", boxSizing: "border-box", maxWidth: "100%" },
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
  mainRow: {
    marginTop: 8,
    display: "flex",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
    alignItems: "flex-start",
  },
  leftPickColumn: {
    flex: "0 1 300px",
    minWidth: 260,
    maxWidth: 420,
    padding: 12,
    background: "#fafafa",
    border: "1px solid #e0e0e0",
    borderRadius: 10,
    alignSelf: "stretch",
  },
  pickColumnTitle: { fontSize: 16, margin: "0 0 6px 0", fontWeight: 700 },
  pickHint: { fontSize: 11, color: "#666", margin: "0 0 12px 0", lineHeight: 1.35 },
  pickResetHint: {
    fontSize: 11,
    color: "#92400e",
    margin: "0 0 10px 0",
    lineHeight: 1.35,
    background: "#fffbeb",
    border: "1px solid #fde68a",
    borderRadius: 6,
    padding: "6px 8px",
  },
  slotPickBox: {
    marginBottom: 14,
    padding: 10,
    background: "#fff",
    border: "1px solid #eee",
    borderRadius: 8,
  },
  slotPickTime: { fontWeight: 800, fontSize: 14, marginBottom: 8, color: "#1b5e20" },
  slotPickEmpty: { fontSize: 12, color: "#9e9e9e", margin: 0 },
  pickChipWrap: { display: "flex", flexWrap: "wrap", gap: 6 },
  pickChip: {
    fontSize: 12,
    padding: "6px 10px",
    borderRadius: 6,
    border: "1px solid #bdbdbd",
    cursor: "pointer",
    textAlign: "left",
    lineHeight: 1.25,
  },
  pickChipTodo: {
    background: "#e8e8e8",
    color: "#616161",
    fontWeight: 500,
    borderColor: "#bdbdbd",
  },
  pickChipFromKitchen: {
    background: "#e2e8f0",
    color: "#475569",
    borderColor: "#94a3b8",
  },
  pickChipDisabled: {
    opacity: 0.65,
    cursor: "not-allowed",
  },
  bibiteSubheading: {
    fontSize: 11,
    fontWeight: 700,
    color: "#0277bd",
    marginTop: 10,
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  },
  rightOrdersColumn: { flex: "1 1 320px", minWidth: 0, display: "flex", flexDirection: "column", gap: 10 },
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
