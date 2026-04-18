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
  slotTabLabel,
  markIngredientPrepDone,
  groupOrdersBySlot,
  mergeCucinaSlotKeys,
} from "@/features/operative/cucina/utils/cucinaPrepTasks"
import { useRepartiQuadTest } from "@/features/operative/contexts/RepartiQuadTestContext"

const STATO_PREPARAZIONE = "IN_PREPARAZIONE"
const STATO_PRONTO = "PRONTO"
const POLL_MS = 10000
const PREP_CATEGORIA_COLORI_DEFAULT = {
  congelato: "#dbeafe",
  affettato: "#dcfce7",
  bibite: "#ffffff",
  fritto: "#fef9c3",
  comune: "#fce7f3",
}

function resolvePrepTaskColor(task) {
  const custom = String(task?.ingredienteColore || "").trim()
  if (custom) return custom
  const cat = String(task?.ingredienteCategoria || "").trim().toLowerCase()
  if (cat.includes("congel")) return PREP_CATEGORIA_COLORI_DEFAULT.congelato
  if (cat.includes("affett")) return PREP_CATEGORIA_COLORI_DEFAULT.affettato
  if (cat.includes("bibit")) return PREP_CATEGORIA_COLORI_DEFAULT.bibite
  if (cat.includes("fritt")) return PREP_CATEGORIA_COLORI_DEFAULT.fritto
  return PREP_CATEGORIA_COLORI_DEFAULT.comune
}

function rigaGroupKey(r) {
  return `${r.prodottoId ?? r.prodotto_id}|${r.formatoNome ?? r.formato_nome ?? ""}`
}

/** Righe ordine aggregate come in vista Pizzaiolo: qty, nome, riepilogo ingredienti / lista ricetta. */
function CucinaRigheComposizione({ righe, productNames, ingredientsByProduct }) {
  const quad = useRepartiQuadTest()
  if (!righe?.length) return quad ? null : <p style={fornoStyles.mutedRighe}>Nessuna riga prodotto.</p>

  const aggregated = {}
  for (const r of righe) {
    const k = rigaGroupKey(r)
    if (!aggregated[k]) {
      aggregated[k] = {
        pid: r.prodottoId ?? r.prodotto_id,
        formato: r.formatoNome ?? r.formato_nome,
        qta: 0,
        righe: [],
      }
    }
    aggregated[k].qta += Number(r.quantita) || 1
    aggregated[k].righe.push(r)
  }
  const list = Object.values(aggregated)

  return (
    <div style={fornoStyles.righeWrap}>
      {list.map((item, idx) => {
        const nomeBase = productNames[item.pid] ?? "—"
        const nomeCompleto = item.formato ? `${nomeBase} (${item.formato})` : nomeBase
        const qtyLabel = `${item.qta}×`
        const ingListBase = Array.isArray(ingredientsByProduct[item.pid]) ? ingredientsByProduct[item.pid] : []
        const summaries = Array.from(
          new Set(
            (item.righe || [])
              .map((r) => r.ingredientiCotturaSummary ?? r.ingredienti_cottura_summary ?? "")
              .filter(Boolean),
          ),
        )
        return (
          <div key={String(item.pid) + (item.formato || "") + idx} style={fornoStyles.rigaRow}>
            <div style={fornoStyles.rigaTop}>
              <span style={fornoStyles.rigaQty}>{qtyLabel}</span>
              <span style={fornoStyles.rigaNome}>{nomeCompleto}</span>
            </div>
            {summaries.length > 0 ? (
              <div style={fornoStyles.rigaIngredienti}>
                {summaries.map((txt, i) => (
                  <span key={i} style={fornoStyles.ingNormal}>
                    {txt}
                    {i < summaries.length - 1 ? " · " : ""}
                  </span>
                ))}
              </div>
            ) : ingListBase.length > 0 ? (
              <div style={fornoStyles.rigaIngredienti}>
                {ingListBase.map((ing, i) => {
                  const isBold = ing.vaInCottura === true
                  return (
                    <span key={(ing.nome || "") + i} style={isBold ? fornoStyles.ingBold : fornoStyles.ingNormal}>
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
}

export default function Cucina() {
  const quad = useRepartiQuadTest()
  const { tenantId, tenantData } = useTenant()
  const parametri = tenantData?.parametri_operativi || {}
  const partenzaConsegneMinuti = Number(parametri.pizzaiolo_partenza_consegne_minuti) || 30
  const [orders, setOrders] = useState([])
  const [righeAll, setRigheAll] = useState([])
  const [productNames, setProductNames] = useState({})
  /** Prodotto.prep_cucina (fritti, bibite, dolci con task in cucina). */
  const [productPrepCucinaById, setProductPrepCucinaById] = useState({})
  const [ingredientsByProduct, setIngredientsByProduct] = useState({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [detailOrder, setDetailOrder] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [prepActionId, setPrepActionId] = useState(null)
  const [activeSlot, setActiveSlot] = useState(null)
  /** Se valorizzata, mostra la sezione «composizione in forno» (dettaglio ordini) per quella fascia. */
  const [compositionSlot, setCompositionSlot] = useState(null)
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
        setProductPrepCucinaById(
          (prodotti || []).reduce(
            (acc, p) => ({ ...acc, [p.id]: p.prep_cucina === true || p.prepCucina === true }),
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

  useEffect(() => {
    loadOrders()
    const t = setInterval(() => loadOrders({ silent: true }), POLL_MS)
    return () => clearInterval(t)
  }, [loadOrders])

  const righeByOrdineId = useMemo(() => {
    const m = {}
    for (const r of righeAll || []) {
      const oid = r.ordineId ?? r.ordine_id
      if (!oid) continue
      if (!m[oid]) m[oid] = []
      m[oid].push(r)
    }
    return m
  }, [righeAll])

  const tasksBySlot = useMemo(
    () =>
      buildCucinaPrepTasks(
        orders,
        righeAll,
        productNames,
        ingredientsByProduct,
        PLANNING_GRID_SLOT_MINUTES,
        productPrepCucinaById,
      ),
    [orders, righeAll, productNames, ingredientsByProduct, productPrepCucinaById],
  )

  const ordersBySlot = useMemo(
    () => groupOrdersBySlot(orders, PLANNING_GRID_SLOT_MINUTES),
    [orders],
  )

  const slotTabs = useMemo(() => mergeCucinaSlotKeys(tasksBySlot, ordersBySlot), [tasksBySlot, ordersBySlot])

  useEffect(() => {
    if (!slotTabs.length) {
      setActiveSlot(null)
      return
    }
    if (activeSlot && slotTabs.includes(activeSlot)) return
    const withPending = slotTabs.find((s) => (tasksBySlot[s] || []).some((t) => !t.done))
    setActiveSlot(withPending ?? slotTabs[0])
  }, [slotTabs, tasksBySlot, activeSlot])

  useEffect(() => {
    if (compositionSlot && !slotTabs.includes(compositionSlot)) {
      setCompositionSlot(null)
    }
  }, [slotTabs, compositionSlot])

  const handleSlotTabClick = useCallback((slot) => {
    setActiveSlot(slot)
    setCompositionSlot((prev) => {
      if (prev === slot) return null
      return slot
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
    () => Object.values(tasksBySlot).reduce((acc, list) => acc + (list || []).filter((t) => !t.done).length, 0),
    [tasksBySlot],
  )

  return (
    <div style={styles.wrapper} className="operative-mobile-pad">
      {!quad ? (
        <>
          <h1 style={styles.title}>Cucina</h1>
          <p style={styles.subtitle}>
            Vista predefinita: solo <strong>preparazioni in cucina</strong> per la fascia selezionata. Tocca una{" "}
            <strong>fascia oraria</strong> qui sotto per aprire il <strong>dettaglio ordini e piatti in forno</strong> per quella fascia; un secondo
            tocco sulla <strong>stessa</strong> fascia lo nasconde (passando a un’altra fascia il dettaglio segue la fascia selezionata).
          </p>
        </>
      ) : null}

      {error && <div style={styles.error}>{error}</div>}

      {loading && orders.length === 0 ? (
        quad ? null : <p style={styles.muted}>Caricamento...</p>
      ) : orders.length === 0 ? (
        quad ? null : <p style={styles.muted}>Nessuna lavorazione in coda (nessun ordine in preparazione).</p>
      ) : slotTabs.length === 0 ? (
        quad ? null : <p style={styles.muted}>Nessuna fascia oraria disponibile.</p>
      ) : (
        <>
          <div style={styles.tabRow} role="tablist" aria-label="Fasce orarie">
            {slotTabs.map((slot) => {
              const pend = (tasksBySlot[slot] || []).filter((t) => !t.done).length
              const nPiatti = (ordersBySlot[slot] || []).length
              const isActive = slot === activeSlot
              const compositionOpen = compositionSlot === slot
              return (
                <button
                  key={slot}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  aria-expanded={compositionOpen}
                  title={
                    compositionOpen
                      ? "Tocca di nuovo per nascondere il dettaglio ordini"
                      : "Tocca per vedere composizione piatti e ordini in questa fascia"
                  }
                  style={{
                    ...styles.tabBtn,
                    ...(isActive ? styles.tabBtnActive : {}),
                    ...(compositionOpen ? styles.tabBtnCompositionOpen : {}),
                  }}
                  onClick={() => handleSlotTabClick(slot)}
                >
                  {slotTabLabel(slot)}
                  {pend > 0 ? <span style={styles.tabBadgePrep}>{pend}</span> : null}
                  {nPiatti > 0 ? <span style={styles.tabBadgeForno}>{nPiatti}</span> : null}
                </button>
              )
            })}
          </div>
          {!quad ? (
            <p style={styles.tabHint} role="note">
              {compositionSlot
                ? `Dettaglio ordini per ${slotTabLabel(compositionSlot)}: tocca di nuovo la stessa fascia (bordo arancione) per chiudere.`
                : "Tocca una fascia oraria per mostrare piatti in forno e righe ordine; altrimenti resta solo l’elenco preparazioni."}
            </p>
          ) : null}

          <section style={styles.prepSection} aria-label="Preparazioni cucina">
            {!quad ? (
              <>
                <h2 style={styles.sectionTitle}>Da preparare (cucina)</h2>
                <p style={styles.prepHint}>
                  Ingredienti: flag &quot;Prep. cucina&quot; in Admin → Ingredienti. Fritti, bibite e dolci: stesso flag sul prodotto in Admin →
                  Fritti / Bibite / Dolci. Tocca quando la preparazione è pronta.
                  {totalPrepPending > 0 ? ` · ${totalPrepPending} totali da fare` : ""}
                </p>
                <p style={styles.prepLegend}>
                  Colori base preparazione: congelato blu, affettato verde, bibite bianco, fritto giallo, comuni rosa.
                  Se un ingrediente ha un colore personalizzato in anagrafica, qui viene usato quello.
                </p>
              </>
            ) : null}
            <div style={styles.taskList}>
              {pendingInTab.length === 0 && doneInTab.length === 0 ? (
                quad ? null : <p style={styles.mutedSmall}>Nessuna preparazione per questa fascia.</p>
              ) : null}
              {pendingInTab.map((t) => {
                const key = `${t.ordineId}:${t.rigaId}:${t.ingredienteId}`
                const busy = prepActionId === key
                const titoloProdotto = t.formatoNome ? `${t.prodottoNome} (${t.formatoNome})` : t.prodottoNome
                const isVoceProdotto = t.kind === "prodotto"
                const prepBg = resolvePrepTaskColor(t)
                return (
                  <button
                    key={key}
                    type="button"
                    style={{
                      ...styles.taskBtn,
                      background: prepBg,
                      borderColor: "#d1d5db",
                    }}
                    disabled={busy}
                    onClick={() => handleMarkPrepDone(t)}
                  >
                    <span style={styles.taskMain}>
                      <strong>{t.ingredienteNome}</strong>
                      {t.qty > 1 ? <span style={styles.qtyBadge}>×{t.qty}</span> : null}
                    </span>
                    <span style={styles.taskSub}>
                      {isVoceProdotto ? "Voce da preparare (fritto / bibita / dolce)" : `Per: ${titoloProdotto}`}
                    </span>
                    <span style={styles.taskAction}>{busy ? "Salvo…" : "Tocca quando pronto"}</span>
                  </button>
                )
              })}
              {doneInTab.length > 0 ? (
                <div style={styles.doneBlock}>
                  <span style={styles.doneLabel}>Preparazioni completate (questa fascia)</span>
                  {doneInTab.map((t) => {
                    const titoloProdotto = t.formatoNome ? `${t.prodottoNome} (${t.formatoNome})` : t.prodottoNome
                    const isVoceProdotto = t.kind === "prodotto"
                    return (
                      <div key={`d-${t.ordineId}:${t.rigaId}:${t.ingredienteId}`} style={styles.doneRow}>
                        <span style={styles.doneStrike}>
                          {t.ingredienteNome}
                          {t.qty > 1 ? ` ×${t.qty}` : ""}
                        </span>
                        <span style={styles.doneMeta}>
                          {isVoceProdotto ? "Voce prodotto" : titoloProdotto}
                        </span>
                      </div>
                    )
                  })}
                </div>
              ) : null}
            </div>
          </section>

          {compositionSlot ? (
          <section style={styles.fornoSection} aria-label="Composizione in forno">
            {!quad ? (
              <>
                <h2 style={styles.sectionTitle}>In forno — composizione piatti</h2>
                <p style={styles.fornoHint}>
                  Fascia <strong>{slotTabLabel(compositionSlot)}</strong>: dettaglio prodotti e ingredienti (in cottura in grassetto). Segna pronto
                  quando la cucina ha finito: passa al pizzaiolo / bancone.
                </p>
              </>
            ) : null}
            {(ordersBySlot[compositionSlot] || []).length === 0 ? (
              quad ? null : <p style={styles.mutedSmall}>Nessun ordine in questa fascia.</p>
            ) : (
              <div style={styles.fornoStack}>
                {(ordersBySlot[compositionSlot] || []).map((ord) => {
                  const urg =
                    (ord.tipo_ordine || "").toLowerCase() === "delivery" &&
                    isDeliveryUrgentForno(ord, parametri, partenzaConsegneMinuti)
                  const tipoEtichetta =
                    (ord.tipo_ordine || "").toLowerCase() === "delivery" ? "Consegna" : "Ritiro negozio"
                  const orario = ord.orario_ritiro ?? ord.orarioRitiro ?? "—"
                  const righe = righeByOrdineId[ord.id] || []
                  return (
                    <div
                      key={ord.id}
                      style={{
                        ...styles.fornoCard,
                        ...(urg ? styles.fornoCardUrg : {}),
                      }}
                    >
                      {urg ? (
                        <div style={styles.urgBanner} role="status">
                          FORNO URGENTE — consegna in finestra critica
                        </div>
                      ) : null}
                      <div style={styles.fornoMetaRow}>
                        <span style={styles.fornoOrario}>{orario}</span>
                        <span style={styles.fornoTipo}>{tipoEtichetta}</span>
                      </div>
                      {ord.note ? <p style={styles.fornoNote}>Nota cucina: {ord.note}</p> : null}
                      <CucinaRigheComposizione
                        righe={righe}
                        productNames={productNames}
                        ingredientsByProduct={ingredientsByProduct}
                      />
                      <div style={styles.fornoActions}>
                        <button
                          type="button"
                          style={styles.btnPronto}
                          disabled={actionLoading}
                          onClick={() => markAsPronto(ord.id)}
                        >
                          {actionLoading ? "Salvo…" : "Fine cucina → PRONTO"}
                        </button>
                        <button
                          type="button"
                          style={styles.btnScheda}
                          disabled={actionLoading}
                          onClick={() => openDetail(ord.id)}
                        >
                          Scheda tecnica
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </section>
          ) : null}
        </>
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
    fontWeight: 600,
    fontSize: 13,
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
  },
  tabBtnActive: {
    background: "#37474f",
    color: "#fff",
    borderColor: "#37474f",
  },
  /** Fascia con dettaglio ordini aperto (oltre alla selezione per le preparazioni). */
  tabBtnCompositionOpen: {
    boxShadow: "0 0 0 2px #ff7043",
  },
  tabHint: {
    margin: "0 0 14px",
    fontSize: 12,
    color: "#546e7a",
    lineHeight: 1.45,
  },
  tabBadgePrep: {
    fontSize: 11,
    background: "#ff7043",
    color: "#fff",
    padding: "2px 7px",
    borderRadius: 10,
    fontWeight: 700,
  },
  tabBadgeForno: {
    fontSize: 11,
    background: "#78909c",
    color: "#fff",
    padding: "2px 7px",
    borderRadius: 10,
    fontWeight: 700,
  },
  prepSection: {
    marginBottom: 20,
    padding: 14,
    background: "#f1f8e9",
    border: "1px solid #c5e1a5",
    borderRadius: 10,
  },
  prepHint: { margin: "0 0 12px", fontSize: 13, color: "#33691e", lineHeight: 1.4 },
  prepLegend: { margin: "0 0 12px", fontSize: 12, color: "#475569", lineHeight: 1.5 },
  fornoSection: {
    marginBottom: 20,
    padding: 14,
    background: "#eceff1",
    border: "1px solid #b0bec5",
    borderRadius: 10,
  },
  fornoHint: { margin: "0 0 12px", fontSize: 13, color: "#455a64", lineHeight: 1.4 },
  fornoStack: { display: "flex", flexDirection: "column", gap: 14 },
  fornoCard: {
    padding: 12,
    background: "#fff",
    borderRadius: 8,
    border: "1px solid #cfd8dc",
  },
  fornoCardUrg: {
    border: "2px solid #e65100",
    boxShadow: "0 0 0 1px rgba(230,81,0,0.25)",
  },
  urgBanner: {
    fontSize: 12,
    fontWeight: 800,
    color: "#bf360c",
    background: "#ffe0b2",
    padding: "6px 8px",
    borderRadius: 6,
    marginBottom: 8,
  },
  fornoMetaRow: { display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: 10, marginBottom: 8 },
  fornoOrario: { fontSize: 20, fontWeight: 800, color: "#1a237e" },
  fornoTipo: { fontSize: 13, fontWeight: 600, color: "#546e7a" },
  fornoNote: { fontSize: 13, fontStyle: "italic", color: "#555", margin: "0 0 10px" },
  fornoActions: { display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12, paddingTop: 12, borderTop: "1px solid #eee" },
  btnPronto: {
    padding: "10px 16px",
    background: "#2e7d32",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    cursor: "pointer",
    fontWeight: 700,
    fontSize: 14,
  },
  btnScheda: {
    padding: "8px 12px",
    background: "#fff",
    color: "#455a64",
    border: "1px solid #b0bec5",
    borderRadius: 8,
    cursor: "pointer",
    fontSize: 13,
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
}

const fornoStyles = {
  righeWrap: { marginTop: 4 },
  mutedRighe: { fontSize: 13, color: "#888", margin: 0 },
  rigaRow: { marginBottom: 10, paddingBottom: 8, borderBottom: "1px dashed #e0e0e0" },
  rigaTop: { display: "flex", alignItems: "baseline", gap: 8 },
  rigaQty: { fontSize: 14, color: "#555", minWidth: 36, fontWeight: 700 },
  rigaNome: { fontSize: 16, fontWeight: 700, color: "#212121" },
  rigaIngredienti: { display: "block", fontSize: 13, color: "#424242", marginTop: 4, lineHeight: 1.45 },
  ingBold: { fontWeight: 700 },
  ingNormal: { fontWeight: 400 },
}
