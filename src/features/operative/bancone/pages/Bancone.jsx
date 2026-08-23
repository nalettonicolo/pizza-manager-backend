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
  getIngredients,
  updateOrderStato,
} from "@/features/admin/services/adminService"
import {
  aggregateBanconeBibiteBySlot,
  aggregateBanconeIngredientsBySlot,
  banconeSlotsFromOrders,
  BANCONE_BIBITE_PICKED_BG,
} from "@/features/operative/bancone/utils/banconeSlotPick"
import {
  resolvePrepTaskBackgroundColor,
  mergeCucinaPrepColorsFromParametri,
} from "@/utils/cucinaPrepCategoryTheme"
import OrderDetailModal from "@/features/operative/components/OrderDetailModal"
import {
  filterOrdiniVisibili,
  getRitardoMinuti,
  slotPizzeCount,
  sortedSlotLabels,
  readPizzaioloLeadTimeConsegnaMin,
} from "@/features/operative/pizzaiolo/utils/pizzaioloUtils"
import { PLANNING_GRID_SLOT_MINUTES } from "@/features/operative/cassa/utils/planningUtils"
import { isDeliveryUrgentPartenzaBancone } from "@/utils/riderDeliveryConfig"
import { formatIndirizzoDisplayItaliano } from "@/utils/formatIndirizzoItaliano"
import { useRepartiQuadTest } from "@/features/operative/contexts/RepartiQuadTestContext"
import { useOperativeOrdersLiveRefresh } from "@/features/operative/hooks/useOperativeOrdersLiveRefresh"
import { canRepartoStampareRicevutaCortesia } from "@/utils/stampaOperativaConfig"
import { printRicevutaCortesiaFromDetail } from "@/features/operative/cassa/utils/stampaRicevutaCortesia"
import { isCucinaTabletAbilitato } from "@/utils/cucinaTabletConfig"

const STATO_PRONTO = "PRONTO"
const STATO_PREPARAZIONE = "IN_PREPARAZIONE"
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
  /** Ordini usati solo per aggregare le prep (può includere IN_PREPARAZIONE se no tablet cucina). */
  const [prepOrders, setPrepOrders] = useState([])
  const [pizzePerOrdine, setPizzePerOrdine] = useState({})
  const [righePerOrdine, setRighePerOrdine] = useState({})
  const [righePrepPerOrdine, setRighePrepPerOrdine] = useState({})
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
  const [bibiteProductIds, setBibiteProductIds] = useState(() => new Set())
  /** Chiave ingrediente/bibita/summary preso in busta (inverso cucina: parte grigio, tap = colore). */
  const [pickedBanconeKeys, setPickedBanconeKeys] = useState(() => new Set())
  const [highlightedOrdineIds, setHighlightedOrdineIds] = useState(() => new Set())
  const [lastPickResetReason, setLastPickResetReason] = useState("")
  const loadSeqRef = useRef(0)
  const prevOrderIdsKeyRef = useRef("")

  const parametri = tenantData?.parametri_operativi || {}
  const cucinaTabletOn = isCucinaTabletAbilitato(parametri)
  /** Stessi colori per categoria della pagina impostazioni Cucina (admin tenant → Menù → Colori preparazione). */
  const prepCategoryColors = useMemo(
    () => mergeCucinaPrepColorsFromParametri(tenantData?.parametri_operativi),
    [tenantData?.parametri_operativi],
  )
  const showPrintCortesia = canRepartoStampareRicevutaCortesia(parametri, "bancone")
  const minutiVisibili = Number(parametri.pizzaiolo_ordini_visibili_minuti) || 45
  const leadTimeConsegnaMin = readPizzaioloLeadTimeConsegnaMin(parametri)

  const loadOrders = useCallback(async (opts = {}) => {
    const silent = opts.silent === true
    if (!tenantId) return
    const seq = ++loadSeqRef.current
    if (!silent) {
      setLoading(true)
      setError(null)
    }
    try {
      // IN_PREPARAZIONE serve sempre, anche con Cucina attiva: Bancone ora mostra in sola
      // lettura cosa sta preparando la Cucina (vedi ingredientsBySlot/readOnlyPrep sotto).
      const [dataPronto, dataPrep] = await Promise.all([
        getOrders(tenantId, { stato: STATO_PRONTO, todayOnly: true, limit: 100 }),
        getOrders(tenantId, { stato: STATO_PREPARAZIONE, todayOnly: true, limit: 100 }),
      ])
      const prontoList = dataPronto || []
      const prepExtra = dataPrep || []
      // Un ordine PRONTO a domicilio è già uscito (o sta per uscire con il pony): i suoi chip non
      // servono più al bancone anche se una bibita non risulta ancora barrata. Un PRONTO ritiro in
      // negozio invece resta nell'aggregazione finché non si preme "Consegnato" (il cliente non è
      // ancora passato a prenderlo).
      const prontoPerAggregazione = prontoList.filter(
        (o) => (o.tipo_ordine || o.tipoOrdine || "").toLowerCase() !== "delivery",
      )
      const prepMergedMap = new Map()
      for (const o of [...prepExtra, ...prontoPerAggregazione]) {
        if (o?.id) prepMergedMap.set(o.id, o)
      }
      const prepList = [...prepMergedMap.values()]
      const cardIds = prontoList.map((o) => o.id).filter(Boolean)
      const prepIds = prepList.map((o) => o.id).filter(Boolean)
      const allIds = [...new Set([...cardIds, ...prepIds])]

      const [pizze, righe] = await Promise.all([
        cardIds.length ? getRigheAggregateByOrdineIds(cardIds, tenantId) : {},
        allIds.length ? getRigheByOrdineIds(allIds) : [],
      ])
      if (seq !== loadSeqRef.current) return
      setOrders(prontoList)
      setPrepOrders(prepList)
      setPizzePerOrdine(pizze)

      const righePerOrd = {}
      const righePrep = {}
      const prodIds = new Set()
      for (const r of righe || []) {
        const oid = r.ordineId ?? r.ordine_id
        if (!oid) continue
        if (!righePerOrd[oid]) righePerOrd[oid] = []
        if (!righePrep[oid]) righePrep[oid] = []
        if (cardIds.includes(oid)) righePerOrd[oid].push(r)
        if (prepIds.includes(oid)) righePrep[oid].push(r)
        const pid = r.prodottoId ?? r.prodotto_id
        if (pid) prodIds.add(pid)
      }
      setRighePerOrdine(righePerOrd)
      setRighePrepPerOrdine(righePrep)

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
      .catch((e) => console.warn("[Bancone] getIngredients:", e))
    return () => {
      cancelled = true
    }
  }, [tenantId])

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
    const base = quad ? orders || [] : filterOrdiniVisibili(orders, minutiVisibili)
    return [...base].sort((a, b) => {
      const ta = new Date(a.updatedAt ?? a.updated_at ?? a.createdAt ?? a.created_at).getTime() || 0
      const tb = new Date(b.updatedAt ?? b.updated_at ?? b.createdAt ?? b.created_at).getTime() || 0
      return ta - tb
    })
  }, [orders, minutiVisibili, quad])

  const slotPizze = useMemo(
    () => slotPizzeCount(ordiniVisibili, pizzePerOrdine, PLANNING_GRID_SLOT_MINUTES, leadTimeConsegnaMin),
    [ordiniVisibili, pizzePerOrdine, leadTimeConsegnaMin]
  )
  const slotLabels = useMemo(
    () => sortedSlotLabels(slotPizze).filter((label) => (slotPizze[label] || 0) > 0),
    [slotPizze]
  )

  const orderStateKey = useMemo(
    () =>
      prepOrders
        .map((o) => {
          const prep = JSON.stringify(o?.cucina_prep_stato ?? o?.cucinaPrepStato ?? {})
          return `${o.id}:${prep}`
        })
        .filter(Boolean)
        .sort()
        .join(","),
    [prepOrders]
  )

  const banconeSlotOrder = useMemo(
    () => banconeSlotsFromOrders(prepOrders.length ? prepOrders : ordiniVisibili, PLANNING_GRID_SLOT_MINUTES),
    [prepOrders, ordiniVisibili]
  )

  // Con Cucina abilitata se ne occupa lei della preparazione (tocca quando pronto): a Bancone
  // restano interattivi solo le bibite. Il resto lo mostriamo comunque, in sola visualizzazione
  // (stesso stato "fatto" condiviso via cucina_prep_stato), così chi è al bancone sa cosa sta
  // arrivando senza poter marcare pronto un task che non è suo — evita che due reparti si
  // pestino i piedi sullo stesso ingrediente.
  const readOnlyPrep = cucinaTabletOn
  const ingredientsBySlot = useMemo(
    () =>
      aggregateBanconeIngredientsBySlot(
        prepOrders.length ? prepOrders : ordiniVisibili,
        Object.keys(righePrepPerOrdine).length ? righePrepPerOrdine : righePerOrdine,
        ingredientsByProduct,
        PLANNING_GRID_SLOT_MINUTES,
        { productPrepCucinaById, productPrepMetaById, productNames, ingredientiGlobali },
      ),
    [prepOrders, ordiniVisibili, righePrepPerOrdine, righePerOrdine, ingredientsByProduct, productPrepCucinaById, productPrepMetaById, productNames, ingredientiGlobali],
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

  /** Evidenzia la/le card ordine collegate a una chip (ingrediente/bibita), oltre al toggle "preso". */
  const highlightOrdiniFromChip = useCallback((ordineIds) => {
    const ids = ordineIds instanceof Set ? ordineIds : new Set(ordineIds || [])
    if (ids.size === 0) return
    setHighlightedOrdineIds(ids)
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
        // Rimuove subito anche dall'aggregazione "da preparare" (bibite/ingredienti), senza
        // aspettare il prossimo refresh: l'ordine è concluso, i suoi chip non servono più.
        setPrepOrders((prev) => prev.filter((o) => o.id !== ordineId))
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
    const urgPartenza = isDelivery && isDeliveryUrgentPartenzaBancone(ord, parametri)
    const highlighted = highlightedOrdineIds.has(ord.id)
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
          ...(highlighted
            ? {
                border: "2px solid #1565c0",
                boxShadow: "0 0 0 2px rgba(21,101,192,0.35)",
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

  const hasPrepChips = useMemo(() => {
    return Object.values(ingredientsBySlot || {}).some((arr) => (arr || []).length > 0)
      || Object.values(bibiteBySlot || {}).some((arr) => (arr || []).length > 0)
  }, [ingredientsBySlot, bibiteBySlot])

  return (
    <div style={styles.wrapper} className="operative-mobile-pad">
      {!quad ? (
        <>
          <h1 style={styles.title}>Bancone</h1>
          <p style={styles.subtitle}>
            {cucinaTabletOn
              ? "Ordini pronti per il ritiro + anteprima preparazioni Cucina"
              : "Preparazioni cucina + ordini pronti (tablet cucina non attivo: prep integrate qui)"}
          </p>
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

      {loading && ordiniVisibili.length === 0 && !hasPrepChips ? (
        quad ? null : <p style={styles.muted}>Caricamento...</p>
      ) : ordiniVisibili.length === 0 && !hasPrepChips ? (
        <p style={styles.muted}>
          {quad
            ? "Nessun ordine PRONTO oggi. Porta un ordine a PRONTO in cassa/pizzaioli per vederlo qui."
            : "Nessun ordine pronto."}
        </p>
      ) : (
        <div
          style={{ ...styles.mainRow, ...(quad ? { flexWrap: "nowrap" } : {}) }}
          className="bancone-layout-main"
        >
          <aside
            className="bancone-layout-aside"
            style={{ ...styles.leftPickColumn, ...(quad ? styles.leftPickColumnQuad : {}) }}
            aria-label="Check ingredienti per fascia oraria"
          >
            {!quad ? (
              <>
                <h2 style={styles.pickColumnTitle}>
                  {cucinaTabletOn ? "Bibite e preparazioni per orario" : "Da preparare (per orario)"}
                </h2>
                <p style={styles.pickHint}>
                  {cucinaTabletOn
                    ? "Le bibite le prepara il Bancone (tocca quando l'hai presa). Gli altri ingredienti li prepara la Cucina: qui puoi comunque toccarli per barrarli come promemoria personale — non cambia lo stato in Cucina, che resta l'unica a segnarli davvero pronti."
                    : "Conteggi per fascia (stesso ingrediente = un solo chip con quantità). Compare appena l'ordine è in preparazione. Tocca quando pronto."}
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
                        const fullBg = resolvePrepTaskBackgroundColor(
                          { ingredienteColore: item.colore, ingredienteCategoria: item.categoria },
                          prepCategoryColors,
                        )
                        const showCount = item.count
                        if (readOnlyPrep) {
                          // Con Cucina attiva questi ingredienti li prepara lei (il "pronto" vero resta
                          // scritto in cucina_prep_stato): il click qui in Bancone NON tocca quello
                          // stato condiviso, resta un promemoria solo locale (pickedBanconeKeys, come
                          // le bibite) — un modo per non perdersi nulla senza far credere agli altri
                          // reparti che l'abbia preparato Bancone.
                          const doneCount = item.doneCount || 0
                          const remaining = Math.max(0, showCount - doneCount)
                          const doneByCucina = remaining === 0
                          const picked = pickedBanconeKeys.has(item.pickKey)
                          const crossedOut = picked || doneByCucina
                          return (
                            <button
                              key={item.pickKey}
                              type="button"
                              disabled={doneByCucina}
                              style={{
                                ...styles.pickChip,
                                ...(crossedOut
                                  ? {
                                      background: "#e2e8f0",
                                      color: "#94a3b8",
                                      textDecoration: "line-through",
                                      borderColor: "#cbd5e1",
                                      cursor: doneByCucina ? "default" : "pointer",
                                    }
                                  : { background: fullBg, color: "#1a1a1a" }),
                              }}
                              onClick={() => {
                                if (doneByCucina) return
                                togglePickedBancone(item.pickKey)
                                highlightOrdiniFromChip(item.ordineIds)
                              }}
                              title={
                                doneByCucina
                                  ? "Già segnato pronto dalla Cucina."
                                  : "Lo prepara la Cucina — tocca per barrarlo qui (solo un promemoria per te, non cambia lo stato in Cucina)."
                              }
                            >
                              {remaining > 1 ? `${remaining}× ` : ""}
                              {item.label}
                            </button>
                          )
                        }
                        const picked = pickedBanconeKeys.has(item.pickKey)
                        return (
                          <button
                            key={item.pickKey}
                            type="button"
                            style={{
                              ...styles.pickChip,
                              ...(picked
                                ? { background: fullBg, color: "#1a1a1a", borderColor: "#9e9e9e", fontWeight: 600 }
                                : styles.pickChipTodo),
                            }}
                            onClick={() => {
                              togglePickedBancone(item.pickKey)
                              highlightOrdiniFromChip(item.ordineIds)
                            }}
                            title="Tocca quando l'hai preparato / messo in busta."
                          >
                            {showCount > 1 ? `${showCount}× ` : ""}
                            {item.label}
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
                              onClick={() => {
                                togglePickedBancone(item.pickKey)
                                highlightOrdiniFromChip(item.ordineIds)
                              }}
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
          onClose={() => !actionLoading && !cortesiaBusy && setDetailOrder(null)}
          actionLabel={actionLoading ? "Salvataggio..." : "Consegnato"}
          onAction={markAsConsegnato}
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
  // In "Test 4 reparti" il riquadro Bancone è stretto: la colonna ingredienti a larghezza piena
  // spingeva gli ordini sotto invece che a fianco. Qui la restringiamo e forziamo la riga a non
  // andare a capo (vedi flexWrap:"nowrap" sul mainRow quando quad), cosí gli ordini restano
  // sempre visibili a destra.
  leftPickColumnQuad: {
    flex: "0 1 150px",
    minWidth: 130,
    maxWidth: 190,
    padding: 8,
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
