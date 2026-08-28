import { useEffect, useState, useCallback, useRef, useMemo } from "react"
import { Navigate } from "react-router-dom"
import { useTenant } from "@/app/contexts/TenantContext"
import {
  getOrders,
  getProdottiByIds,
  getRigheByOrdineIds,
  getProductIngredientiBatch,
  getIngredients,
  updateOrderCucinaPrepStato,
} from "@/features/admin/services/adminService"
import { PLANNING_GRID_SLOT_MINUTES } from "@/features/operative/cassa/utils/planningUtils"
import {
  buildCucinaPrepTasks,
  slotTabLabel,
  sortedCucinaSlotTabs,
  aggregatePrepTasksBySlot,
  markAggregatedPrepDone,
} from "@/features/operative/cucina/utils/cucinaPrepTasks"
import { useRepartiQuadTest } from "@/features/operative/contexts/RepartiQuadTestContext"
import LiveClock from "@/components/LiveClock"
import {
  mergeCucinaPrepColorsFromParametri,
  resolvePrepTaskBackgroundColor,
} from "@/utils/cucinaPrepCategoryTheme"
import { useOperativeOrdersLiveRefresh } from "@/features/operative/hooks/useOperativeOrdersLiveRefresh"
import { isCucinaTabletAbilitato } from "@/utils/cucinaTabletConfig"

const STATO_PREPARAZIONE = "IN_PREPARAZIONE"
const POLL_FALLBACK_MS = 1000

export default function Cucina() {
  const quad = useRepartiQuadTest()
  const { tenantId, tenantData } = useTenant()
  const cucinaTabletOn = isCucinaTabletAbilitato(tenantData?.parametri_operativi)
  const prepCategoryColors = useMemo(
    () => mergeCucinaPrepColorsFromParametri(tenantData?.parametri_operativi),
    [tenantData?.parametri_operativi],
  )
  const [orders, setOrders] = useState([])
  const [righeAll, setRigheAll] = useState([])
  const [productNames, setProductNames] = useState({})
  const [productPrepCucinaById, setProductPrepCucinaById] = useState({})
  const [productPrepMetaById, setProductPrepMetaById] = useState({})
  const [ingredientsByProduct, setIngredientsByProduct] = useState({})
  const [ingredientiGlobali, setIngredientiGlobali] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [prepActionKey, setPrepActionKey] = useState(null)
  const [activeSlot, setActiveSlot] = useState(null)
  const loadSeqRef = useRef(0)

  /** Catalogo ingredienti completo (nome→categoria/colore): fallback per gli "extra" aggiunti a
   * una riga che non fanno parte della ricetta base di nessun prodotto già caricato (altrimenti
   * risultano grigi "comune" anche se in anagrafica hanno una categoria impostata). Cambia raramente:
   * un fetch per tenant, non ad ogni refresh ordini. */
  useEffect(() => {
    if (!tenantId) return
    let cancelled = false
    getIngredients(tenantId)
      .then((list) => {
        if (!cancelled) setIngredientiGlobali(Array.isArray(list) ? list : [])
      })
      .catch((e) => console.warn("[Cucina] getIngredients:", e))
    return () => {
      cancelled = true
    }
  }, [tenantId])

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

  useOperativeOrdersLiveRefresh({
    tenantId,
    onRefresh: () => loadOrders({ silent: true }),
    pollMs: POLL_FALLBACK_MS,
  })

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

  const aggregatedBySlot = useMemo(() => aggregatePrepTasksBySlot(tasksBySlot), [tasksBySlot])

  const slotTabs = useMemo(() => sortedCucinaSlotTabs(tasksBySlot), [tasksBySlot])

  useEffect(() => {
    if (!slotTabs.length) {
      setActiveSlot(null)
      return
    }
    if (activeSlot && slotTabs.includes(activeSlot)) return
    const withPending = slotTabs.find((s) =>
      (aggregatedBySlot[s] || []).some((a) => (a.count || 0) > (a.doneCount || 0)),
    )
    setActiveSlot(withPending ?? slotTabs[0])
  }, [slotTabs, aggregatedBySlot, activeSlot])

  const handleMarkAggregatedDone = useCallback(
    async (agg) => {
      if (!agg?.pendingTasks?.length) return
      setPrepActionKey(agg.pickKey)
      const { nextByOrdineId } = markAggregatedPrepDone(orders, agg.pendingTasks)
      setOrders((prev) =>
        prev.map((o) => (nextByOrdineId[o.id] ? { ...o, cucina_prep_stato: nextByOrdineId[o.id] } : o)),
      )
      try {
        const entries = Object.entries(nextByOrdineId)
        await Promise.all(entries.map(([oid, next]) => updateOrderCucinaPrepStato(oid, next)))
      } catch (err) {
        console.error(err)
        setError("Errore salvataggio preparazione. Verifica di aver eseguito sql_upgrade (colonna cucina_prep_stato).")
      } finally {
        setPrepActionKey(null)
      }
    },
    [orders],
  )

  const itemsInTab = activeSlot ? aggregatedBySlot[activeSlot] || [] : []
  const pendingInTab = itemsInTab.filter((a) => (a.count || 0) > (a.doneCount || 0))
  const doneInTab = itemsInTab.filter((a) => (a.doneCount || 0) >= (a.count || 0) && (a.count || 0) > 0)

  if (!cucinaTabletOn && !quad) {
    return <Navigate to="/operative/bancone" replace />
  }

  return (
    <div style={styles.wrapper} className="operative-mobile-pad">
      {!quad ? <h1 style={styles.title}>Cucina</h1> : null}
      {!quad ? (
        <p style={styles.subtitle}>
          Ingredienti da preparare per fascia oraria (conteggio). Tocca quando pronti. Nessun riepilogo pizza: quello
          resta al forno (Pizzaioli).
        </p>
      ) : (
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 6 }}>
          <LiveClock style={{ fontSize: 11, padding: "2px 8px", minHeight: 22, borderRadius: 6 }} />
        </div>
      )}

      {error && <div style={styles.error}>{error}</div>}

      {loading && orders.length === 0 ? (
        quad ? null : <p style={styles.muted}>Caricamento...</p>
      ) : orders.length === 0 ? (
        quad ? null : <p style={styles.muted}>Nessuna lavorazione in coda.</p>
      ) : slotTabs.length === 0 ? (
        quad ? null : (
          <p style={styles.muted}>Nessuna preparazione speciale nelle fasce attuali.</p>
        )
      ) : (
        <>
          <div style={styles.tabRow} role="tablist" aria-label="Fasce orarie">
            {slotTabs.map((slot) => {
              const pendQty = (aggregatedBySlot[slot] || []).reduce(
                (s, a) => s + Math.max(0, (a.count || 0) - (a.doneCount || 0)),
                0,
              )
              const isActive = slot === activeSlot
              return (
                <button
                  key={slot}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  style={{
                    ...styles.tabBtn,
                    ...(isActive ? styles.tabBtnActive : {}),
                  }}
                  onClick={() => setActiveSlot(slot)}
                >
                  {slotTabLabel(slot)}
                  {pendQty > 0 ? <span style={styles.tabBadgePrep}>{pendQty}</span> : null}
                </button>
              )
            })}
          </div>

          {activeSlot ? (
            <section style={styles.prepSection} aria-label="Preparazioni cucina">
              {!quad ? <h2 style={styles.sectionTitle}>Da preparare</h2> : null}
              {pendingInTab.length === 0 && doneInTab.length === 0 ? (
                quad ? null : (
                  <p style={styles.mutedSmall}>Nessuna preparazione speciale in questa fascia.</p>
                )
              ) : (
                <div style={styles.taskList}>
                  {pendingInTab.map((a) => {
                    const remaining = Math.max(0, (a.count || 0) - (a.doneCount || 0))
                    const busy = prepActionKey === a.pickKey
                    const prepBg = resolvePrepTaskBackgroundColor(
                      {
                        ingredienteCategoria: a.categoria,
                        ingredienteColore: a.colore,
                        kind: a.kind,
                      },
                      prepCategoryColors,
                    )
                    return (
                      <button
                        key={a.pickKey}
                        type="button"
                        style={{
                          ...styles.taskBtn,
                          background: prepBg,
                          border: "1px solid #d1d5db",
                        }}
                        disabled={busy}
                        onClick={() => handleMarkAggregatedDone(a)}
                      >
                        <span style={styles.taskMain}>
                          <strong>{a.label}</strong>
                          <span style={styles.qtyBadge}>×{remaining}</span>
                          {a.categoria ? (
                            <span
                              style={{
                                marginLeft: 8,
                                fontSize: 11,
                                fontWeight: 700,
                                padding: "2px 8px",
                                borderRadius: 6,
                                background: prepBg,
                                border: "1px solid rgba(0,0,0,0.12)",
                                textTransform: "capitalize",
                              }}
                            >
                              {a.categoria}
                            </span>
                          ) : null}
                        </span>
                        <span style={styles.taskAction}>{busy ? "Salvo…" : "Tocca quando pronto"}</span>
                      </button>
                    )
                  })}
                  {doneInTab.length > 0 ? (
                    <div style={styles.doneBlock}>
                      <span style={styles.doneLabel}>Completate (questa fascia)</span>
                      {doneInTab.map((a) => (
                        <div key={`d-${a.pickKey}`} style={styles.doneRow}>
                          <span style={styles.doneStrike}>
                            {a.label} ×{a.count}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              )}
            </section>
          ) : null}
        </>
      )}
    </div>
  )
}

const styles = {
  wrapper: { padding: "clamp(12px, 3vw, 24px)", boxSizing: "border-box", maxWidth: "100%" },
  title: { fontSize: 22, marginBottom: 4 },
  subtitle: { color: "#666", marginBottom: 16, lineHeight: 1.45, fontSize: 14 },
  sectionTitle: { margin: "0 0 8px", fontSize: 17 },
  error: {
    padding: 12,
    background: "#ffebee",
    color: "#c62828",
    borderRadius: 8,
    marginBottom: 16,
  },
  muted: { color: "#888", marginTop: 16 },
  mutedSmall: { color: "#888", fontSize: 13, margin: "8px 0 0" },
  tabRow: { display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 },
  tabBtn: {
    padding: "8px 12px",
    borderRadius: 8,
    border: "1px solid #90a4ae",
    background: "#fff",
    cursor: "pointer",
    fontSize: 14,
    fontWeight: 600,
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
  },
  tabBtnActive: { background: "#455a64", color: "#fff", border: "1px solid #455a64" },
  tabBadgePrep: {
    minWidth: 20,
    height: 20,
    padding: "0 6px",
    borderRadius: 999,
    background: "#ef6c00",
    color: "#fff",
    fontSize: 12,
    fontWeight: 700,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  },
  prepSection: { marginBottom: 20 },
  taskList: { display: "flex", flexDirection: "column", gap: 8 },
  taskBtn: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    gap: 4,
    padding: "12px 14px",
    borderRadius: 10,
    border: "1px solid #d1d5db",
    cursor: "pointer",
    textAlign: "left",
    width: "100%",
    boxSizing: "border-box",
  },
  taskMain: { display: "inline-flex", alignItems: "center", flexWrap: "wrap", gap: 4, fontSize: 16 },
  qtyBadge: {
    marginLeft: 6,
    fontSize: 14,
    fontWeight: 800,
    background: "rgba(0,0,0,0.08)",
    padding: "2px 8px",
    borderRadius: 6,
  },
  taskAction: { fontSize: 12, fontWeight: 700, color: "#2e7d32", marginTop: 2 },
  doneBlock: { marginTop: 12, paddingTop: 10, borderTop: "1px dashed #cfd8dc" },
  doneLabel: { display: "block", fontSize: 12, color: "#78909c", marginBottom: 6, fontWeight: 600 },
  doneRow: { display: "flex", gap: 8, fontSize: 13, color: "#78909c", marginBottom: 4 },
  doneStrike: { textDecoration: "line-through" },
}
