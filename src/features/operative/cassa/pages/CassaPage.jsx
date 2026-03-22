import { useEffect, useState, useMemo, useCallback, useLayoutEffect } from "react"
import { useTenant } from "@/app/contexts/TenantContext"
import { useAuth } from "@/app/contexts/AuthContext"
import { useCassaHeader } from "@/app/contexts/CassaHeaderContext"

import CategoryTabs from "@/features/operative/cassa/components/CategoryTabs"
import ProductGrid from "@/features/operative/cassa/components/ProductGrid"
import RiepilogoOrdinePage from "@/features/operative/cassa/components/RiepilogoOrdinePage"
import CassaImpostazioniPage from "@/features/operative/cassa/components/CassaImpostazioniPage"
import ModificaPizzaModal from "@/features/operative/cassa/components/ModificaPizzaModal"
import NuovoClienteModal from "@/features/operative/cassa/components/NuovoClienteModal"
import Cart from "@/features/operative/cassa/components/Cart"

import {
  getCategories,
  getProductsByCategory,
  getProductIngredienti,
  getProductIngredientiMap,
  getProductIngredientIdsMap,
  getIngredients,
  getRuoliPizzeria,
  createOrder,
  getOrders,
  getOrderDetail,
  getProdottiByIds,
  getRigheAggregateByOrdineIds,
  updateOrderTipoPagamento,
  updateOrder,
  chiudiGiornata,
  enrichProductsWithPrezzoCalcolato,
  searchAnagraficaClienti,
} from "@/features/admin/services/adminService"
import { sortByOrdine } from "@/utils/sortByOrdine"
import { resolveMenuTheme } from "@/utils/tenantMenuTheme"
import { getLocalYYYYMMDD, orderCreatedLocalDateKey } from "@/utils/localDate"
import {
  buildPlanningSlots,
  buildSlotsInOpeningHours,
  buildSlotsFullDay,
  getTodayOrari,
  groupOrdersBySlotOrarioRitiro,
  groupOrdiniBySlotOrarioRitiro,
  groupPizzeBySlot,
  groupPizzeBySlotOrarioRitiro,
  slotColor,
} from "@/features/operative/cassa/utils/planningUtils"

const ORDER_STATUS = "IN_PREPARAZIONE"
const TIPI_PAGAMENTO = ["Contanti", "Carta", "Da pagare", "Altro"]
const TIPO_ORDINE = { NEGOZIO: "negozio", DELIVERY: "delivery" }

export default function CassaPage() {
  const { tenantId, tenantData } = useTenant()
  const { user, logout } = useAuth()

  const [categories, setCategories] = useState([])
  const [activeCategory, setActiveCategory] = useState(null)
  const [products, setProducts] = useState([])
  const [cart, setCart] = useState([])
  const [loading, setLoading] = useState(false)
  const [productModalOpen, setProductModalOpen] = useState(false)
  const [productToAdd, setProductToAdd] = useState(null)
  const [searchPizza, setSearchPizza] = useState("")
  const [tipoOrdine, setTipoOrdine] = useState(TIPO_ORDINE.NEGOZIO)
  const [deliverySearch, setDeliverySearch] = useState("")
  const [selectedCliente, setSelectedCliente] = useState(null)
  const [deliverySearchResults, setDeliverySearchResults] = useState([])
  const [deliverySearchLoading, setDeliverySearchLoading] = useState(false)
  const [nuovoClienteModalOpen, setNuovoClienteModalOpen] = useState(false)
  const [profiloClienteModalOpen, setProfiloClienteModalOpen] = useState(false)
  const [noteModalOpen, setNoteModalOpen] = useState(false)
  const [checkoutNote, setCheckoutNote] = useState("")
  const [checkoutTipoPagamento, setCheckoutTipoPagamento] = useState(TIPI_PAGAMENTO[0])
  const [checkoutNomeCliente, setCheckoutNomeCliente] = useState("")
  const [checkoutSelectedSlot, setCheckoutSelectedSlot] = useState(null)
  const [checkoutError, setCheckoutError] = useState(null)
  const [showRiepilogo, setShowRiepilogo] = useState(false)
  const [showImpostazioniCassa, setShowImpostazioniCassa] = useState(false)
  const [ordiniOggi, setOrdiniOggi] = useState([])
  const [pizzePerOrdine, setPizzePerOrdine] = useState({})
  const [showPlanningBar, setShowPlanningBar] = useState(false)
  const [productIngredientiMap, setProductIngredientiMap] = useState({})
  const [productIngredientIdsMap, setProductIngredientIdsMap] = useState({})
  const [ingredientiEsauritiIds, setIngredientiEsauritiIds] = useState([])
  const [canEditParametriCassa, setCanEditParametriCassa] = useState(false)
  const [ordineDetail, setOrdineDetail] = useState(null)
  const [ordineDetailLoading, setOrdineDetailLoading] = useState(false)
  const [segnaPagatoModal, setSegnaPagatoModal] = useState(null)
  const [modificaOrdineModal, setModificaOrdineModal] = useState(null) // ordineDetail when in edit mode
  const [modificaForm, setModificaForm] = useState({ nome_cliente: "", orario_ritiro: "", note: "", tipo_pagamento: "Da pagare", indirizzo_consegna: "" })
  const [modificaOrdineSaving, setModificaOrdineSaving] = useState(false)
  const [chiudiGiornataLoading, setChiudiGiornataLoading] = useState(false)
  const [lastOrderModalDetail, setLastOrderModalDetail] = useState(null)
  const [lastOrderLoading, setLastOrderLoading] = useState(false)
  const [ordiniOnlineDisabilitati, setOrdiniOnlineDisabilitati] = useState(false)
  const [showPaginaOrdini, setShowPaginaOrdini] = useState(false)
  const [ordiniSearch, setOrdiniSearch] = useState("")
  const [planningSlotModal, setPlanningSlotModal] = useState(null) // { type: 'delivery'|'ritiro', slotKey, slotLabel, ordini, slotMinutes }
  const [planningSpostaLoading, setPlanningSpostaLoading] = useState(null) // ordineId while moving

  /////////////////////////////////////////////////////////
  // RESET ON TENANT CHANGE
  /////////////////////////////////////////////////////////

  useEffect(() => {
    setCategories([])
    setProducts([])
    setActiveCategory(null)
    setCart([])
  }, [tenantId])

  /////////////////////////////////////////////////////////
  // LOAD CATEGORIES
  /////////////////////////////////////////////////////////

  const loadCategories = useCallback(async () => {
    if (!tenantId) return

    const data = await getCategories(tenantId)
    const sorted = sortByOrdine(data || [])
    setCategories(sorted)

    if (sorted?.length) {
      const key = (n) => (n || "").toLowerCase().trim()
      const classiche = sorted.find((c) => key(c.nome) === "classiche")
      const pizzaFirst = sorted.find((c) => ["classiche", "speciali", "bianche", "chiuse"].includes(key(c.nome)))
      setActiveCategory((classiche || pizzaFirst || sorted[0]).id)
    }
  }, [tenantId])

  /////////////////////////////////////////////////////////
  // LOAD PRODUCTS
  /////////////////////////////////////////////////////////

  const loadProducts = useCallback(async () => {
    if (!tenantId || !activeCategory) return

    const data = await getProductsByCategory(
      tenantId,
      activeCategory
    )
    const sorted = sortByOrdine(data || [])
    const withPrezzo = await enrichProductsWithPrezzoCalcolato(tenantId, sorted)
    setProducts(withPrezzo)
    try {
      const ids = (withPrezzo || []).map((p) => p.id).filter(Boolean)
      if (ids.length) {
        const [map, idsMap] = await Promise.all([
          getProductIngredientiMap(tenantId, ids),
          getProductIngredientIdsMap(tenantId, ids),
        ])
        setProductIngredientiMap(map || {})
        setProductIngredientIdsMap(idsMap || {})
      } else {
        setProductIngredientiMap({})
        setProductIngredientIdsMap({})
      }
    } catch (e) {
      console.warn("Caricamento ingredienti per lista cassa:", e)
      setProductIngredientiMap({})
      setProductIngredientIdsMap({})
    }
  }, [tenantId, activeCategory])

  useEffect(() => {
    loadCategories()
  }, [loadCategories])

  useEffect(() => {
    loadProducts()
  }, [loadProducts])

  useEffect(() => {
    if (!tenantId) return
    getIngredients(tenantId)
      .then((list) => {
        const esauriti = (list || []).filter((i) => i.attivo === false).map((i) => i.id)
        setIngredientiEsauritiIds(esauriti)
      })
      .catch(() => setIngredientiEsauritiIds([]))
  }, [tenantId])

  // Permesso: utente cassa può modificare parametri operativi (impostazioni cassa)
  useEffect(() => {
    const loadPermesso = async () => {
      if (!tenantId || !user?.email) {
        setCanEditParametriCassa(false)
        return
      }
      try {
        const list = await getRuoliPizzeria(tenantId)
        const me = (list || []).find((r) => r.email === user.email)
        setCanEditParametriCassa(Boolean(me?.puo_modificare_parametri))
      } catch (e) {
        console.warn("Errore caricamento permessi ruoli:", e)
        setCanEditParametriCassa(false)
      }
    }
    loadPermesso()
  }, [tenantId, user?.email])

  // Ordini: carichiamo solo la giornata odierna (UTC) per evitare ordini vecchi in lista
  const loadOrdini = useCallback(async () => {
    if (!tenantId) return
    try {
      const data = await getOrders(tenantId, { todayOnly: true, limit: 200 })
      setOrdiniOggi(Array.isArray(data) ? data : [])
    } catch (e) {
      console.error(e)
      setOrdiniOggi([])
    }
  }, [tenantId])
  useEffect(() => {
    loadOrdini()
  }, [loadOrdini])

  useEffect(() => {
    if (!tenantId || !ordiniOggi.length) {
      setPizzePerOrdine({})
      return
    }
    const ids = ordiniOggi.map((o) => o.id).filter(Boolean)
    getRigheAggregateByOrdineIds(ids).then(setPizzePerOrdine).catch(() => setPizzePerOrdine({}))
  }, [tenantId, ordiniOggi])

  const openOrdineDetail = useCallback(async (ordineId) => {
    if (!tenantId || !ordineId) return
    setOrdineDetailLoading(true)
    setOrdineDetail(null)
    try {
      const detail = await getOrderDetail(ordineId)
      const ids = (detail.righe || []).map((r) => r.prodottoId ?? r.prodotto_id).filter(Boolean)
      const prodotti = ids.length ? await getProdottiByIds(tenantId, ids) : []
      const productNames = (prodotti || []).reduce((acc, p) => ({ ...acc, [p.id]: p.nome || "—" }), {})
      setOrdineDetail({ ...detail, productNames })
    } catch (e) {
      console.error(e)
    } finally {
      setOrdineDetailLoading(false)
    }
  }, [tenantId])

  const openUltimoOrdineCliente = useCallback(async () => {
    if (!tenantId || !selectedCliente) return
    setLastOrderLoading(true)
    setLastOrderModalDetail(null)
    try {
      const data = await getOrders(tenantId, { todayOnly: true, limit: 100 })
      const nomeNorm = (selectedCliente.nome || "").trim()
      const indirizzoNorm = (selectedCliente.indirizzo || "").trim()
      const match = (o) => {
        const tipo = (o.tipo_ordine || "").toLowerCase()
        if (tipo !== "delivery") return false
        const oNome = (o.nome_cliente ?? o.nome ?? "").trim()
        const oInd = (o.indirizzo_consegna ?? o.indirizzo ?? "").trim()
        return oNome === nomeNorm && oInd === indirizzoNorm
      }
      const last = (data || []).find(match)
      if (!last) {
        setLastOrderModalDetail({ empty: true })
        return
      }
      const detail = await getOrderDetail(last.id)
      const ids = (detail.righe || []).map((r) => r.prodottoId ?? r.prodotto_id).filter(Boolean)
      const prodotti = ids.length ? await getProdottiByIds(tenantId, ids) : []
      const productNames = (prodotti || []).reduce((acc, p) => ({ ...acc, [p.id]: p.nome || "—" }), {})
      setLastOrderModalDetail({ ...detail, productNames })
    } catch (e) {
      console.error(e)
      setLastOrderModalDetail({ error: e?.message || "Errore caricamento" })
    } finally {
      setLastOrderLoading(false)
    }
  }, [tenantId, selectedCliente])

  const handleSegnaPagato = useCallback(async (ordineId, nuovoTipo) => {
    try {
      await updateOrderTipoPagamento(ordineId, nuovoTipo)
      setSegnaPagatoModal(null)
      if (ordineDetail?.id === ordineId) {
        setOrdineDetail((prev) => (prev ? { ...prev, tipo_pagamento: nuovoTipo } : null))
      }
      loadOrdini()
    } catch (e) {
      console.error(e)
      alert("Errore aggiornamento pagamento. " + (e?.message || ""))
    }
  }, [ordineDetail?.id, loadOrdini])

  const handleSalvaModificaOrdine = useCallback(async () => {
    if (!modificaOrdineModal?.id) return
    setModificaOrdineSaving(true)
    try {
      await updateOrder(modificaOrdineModal.id, {
        nome_cliente: modificaForm.nome_cliente || null,
        orario_ritiro: modificaForm.orario_ritiro || null,
        note: modificaForm.note || null,
        tipo_pagamento: modificaForm.tipo_pagamento || null,
        indirizzo_consegna: modificaForm.indirizzo_consegna || null,
      })
      setModificaOrdineModal(null)
      if (ordineDetail?.id === modificaOrdineModal.id) {
        const detail = await getOrderDetail(modificaOrdineModal.id)
        setOrdineDetail(detail)
      }
      loadOrdini()
    } catch (e) {
      console.error(e)
      alert("Errore durante la modifica ordine. " + (e?.message || ""))
    } finally {
      setModificaOrdineSaving(false)
    }
  }, [modificaOrdineModal?.id, modificaForm, ordineDetail?.id, loadOrdini])

  const handleSpostaOrdinePlanning = useCallback(async (ordineId, nuovoOrarioRitiro) => {
    setPlanningSpostaLoading(ordineId)
    try {
      await updateOrder(ordineId, { orario_ritiro: nuovoOrarioRitiro })
      loadOrdini()
      setPlanningSlotModal((prev) => {
        if (!prev) return null
        const nextOrdini = prev.ordini.filter((o) => o.id !== ordineId)
        return nextOrdini.length === 0 ? null : { ...prev, ordini: nextOrdini }
      })
    } catch (e) {
      console.error(e)
      alert("Errore spostamento ordine. " + (e?.message || ""))
    } finally {
      setPlanningSpostaLoading(null)
    }
  }, [loadOrdini])

  const todayStr = useMemo(() => getLocalYYYYMMDD(), [])
  const ordiniOggiFiltered = useMemo(() => {
    return (ordiniOggi || []).filter((o) => orderCreatedLocalDateKey(o) === todayStr)
  }, [ordiniOggi, todayStr])

  const buildPayloadContabilita = useCallback(() => {
    const totaleGiornata = (ordiniOggiFiltered || []).reduce((s, o) => s + Number(o.totale || 0), 0)
    return {
      data: todayStr,
      tenantId,
      ordini: (ordiniOggiFiltered || []).map((o) => ({
        id: o.id,
        numero: o.numero,
        totale: o.totale,
        tipo_pagamento: o.tipo_pagamento,
        tipo_ordine: o.tipo_ordine,
        nome_cliente: o.nome_cliente,
        indirizzo_consegna: o.indirizzo_consegna,
        orario_ritiro: o.orario_ritiro,
        pizze: pizzePerOrdine[o.id] ?? 0,
        createdAt: o.createdAt ?? o.created_at,
      })),
      totale_giornata: totaleGiornata,
      numero_ordini: (ordiniOggiFiltered || []).length,
    }
  }, [todayStr, tenantId, ordiniOggiFiltered, pizzePerOrdine])

  const handleSalvaContabilita = useCallback(() => {
    const payload = buildPayloadContabilita()
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" })
    const a = document.createElement("a")
    a.href = URL.createObjectURL(blob)
    a.download = `contabilita_${todayStr}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }, [buildPayloadContabilita, todayStr])

  const handleChiudiGiornata = useCallback(async () => {
    if (!tenantId) return
    if (!window.confirm("Chiudi la giornata? Verrà creato il salvataggio per contabilità e si resetta lo storico giornaliero.")) return
    setChiudiGiornataLoading(true)
    try {
      const payload = buildPayloadContabilita()
      await chiudiGiornata(tenantId, todayStr, payload)
      loadOrdini()
      setShowPlanningBar(false)
      alert("Giornata chiusa. Domani si ricomincia.")
    } catch (e) {
      console.error(e)
      alert("Errore chiusura giornata: " + (e?.message || ""))
    } finally {
      setChiudiGiornataLoading(false)
    }
  }, [tenantId, todayStr, buildPayloadContabilita, loadOrdini])

  // Ricerca clienti delivery (solo se c'è testo cercato e nessun cliente già selezionato con stesso testo)
  useEffect(() => {
    if (tipoOrdine !== TIPO_ORDINE.DELIVERY || !tenantId) {
      setDeliverySearchResults([])
      return
    }
    const q = deliverySearch.trim()
    if (!q) {
      setDeliverySearchResults([])
      return
    }
    if (selectedCliente && deliverySearch === displayCliente(selectedCliente)) {
      setDeliverySearchResults([])
      return
    }
    const t = setTimeout(async () => {
      setDeliverySearchLoading(true)
      try {
        const list = await searchAnagraficaClienti(tenantId, q)
        setDeliverySearchResults(list)
      } catch (err) {
        console.error(err)
        setDeliverySearchResults([])
      } finally {
        setDeliverySearchLoading(false)
      }
    }, 300)
    return () => clearTimeout(t)
  }, [tenantId, tipoOrdine, deliverySearch, selectedCliente])

  const displayCliente = (c) => (c ? [c.nome, c.indirizzo].filter(Boolean).join(" – ") : "")
  const handleSelectCliente = (c) => {
    setSelectedCliente(c)
    setDeliverySearch(displayCliente(c))
    setDeliverySearchResults([])
  }
  const handleNuovoClienteSuccess = (cliente) => {
    setSelectedCliente(cliente)
    setDeliverySearch(displayCliente(cliente))
    setNuovoClienteModalOpen(false)
  }
  const handleProfiloClienteSuccess = (cliente) => {
    setSelectedCliente(cliente)
    setDeliverySearch(displayCliente(cliente))
    setProfiloClienteModalOpen(false)
  }

  const setCassaHeader = useCassaHeader()?.setContent

  useLayoutEffect(() => {
    if (!setCassaHeader) return
    const toolbar = (
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", minWidth: 0 }}>
        {tipoOrdine === TIPO_ORDINE.DELIVERY && (
          <div style={{ flex: "1 1 auto", minWidth: 0, maxWidth: 240 }}>
            <div style={{ position: "relative", width: "100%", minWidth: 0 }}>
              <input
                type="text"
                placeholder="Cerca cliente..."
                value={deliverySearch}
                onChange={(e) => {
                  setDeliverySearch(e.target.value)
                  setSelectedCliente(null)
                }}
                onClick={selectedCliente ? () => setProfiloClienteModalOpen(true) : undefined}
                readOnly={!!selectedCliente}
                style={{
                  width: "100%",
                  maxWidth: 200,
                  padding: "8px 12px",
                  borderRadius: 6,
                  border: "1px solid #ddd",
                  cursor: selectedCliente ? "pointer" : "text",
                  background: selectedCliente ? "#f9f9f9" : "#fff",
                  fontSize: 13,
                  boxSizing: "border-box",
                }}
                title={selectedCliente ? "Clicca per aprire il profilo cliente" : undefined}
              />
              {deliverySearchLoading && <div style={{ fontSize: 11, color: "#666", marginTop: 2 }}>Ricerca...</div>}
              {!deliverySearchLoading && deliverySearchResults.length > 0 && !selectedCliente && (
                <ul style={{ ...styles.dropdownList, marginTop: 4 }}>
                  {deliverySearchResults.map((c) => (
                    <li
                      key={c.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => handleSelectCliente(c)}
                      onKeyDown={(e) => e.key === "Enter" && handleSelectCliente(c)}
                      style={styles.dropdownItem}
                    >
                      <strong>{c.nome}</strong>
                      {c.indirizzo && <span style={{ color: "#555" }}> – {c.indirizzo}</span>}
                      {c.telefono && <span style={{ fontSize: 12, color: "#666" }}> · {c.telefono}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
        {tipoOrdine === TIPO_ORDINE.DELIVERY && selectedCliente && (
          <button
            type="button"
            onClick={() => { setSelectedCliente(null); setDeliverySearch(""); setDeliverySearchResults([]); }}
            style={{ padding: "8px 10px", background: "#666", color: "#fff", border: "none", borderRadius: 6, fontSize: 14, cursor: "pointer", flexShrink: 0 }}
            title="Deseleziona cliente"
          >
            ✕
          </button>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          {tipoOrdine === TIPO_ORDINE.DELIVERY && selectedCliente ? (
            <>
              <button
                type="button"
                onClick={openUltimoOrdineCliente}
                disabled={lastOrderLoading}
                style={{ padding: "8px 14px", background: "#1976d2", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600 }}
                title="Vedi ultimo ordine di questo cliente"
              >
                {lastOrderLoading ? "..." : "Ultimo ordine"}
              </button>
              <button
                type="button"
                onClick={() => setNoteModalOpen(true)}
                style={{ padding: "8px 14px", background: "#5c6bc0", color: "#fff", border: "none", borderRadius: 8, fontSize: 13 }}
                title="Note ordine (solo negozio)"
              >
                Note
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                style={{
                  ...styles.tipoOrdineBtn,
                  ...(tipoOrdine === TIPO_ORDINE.NEGOZIO ? styles.tipoOrdineBtnActive : {}),
                }}
                onClick={() => setTipoOrdine(TIPO_ORDINE.NEGOZIO)}
              >
                In negozio
              </button>
              <button
                type="button"
                style={{
                  ...styles.tipoOrdineBtn,
                  ...(tipoOrdine === TIPO_ORDINE.DELIVERY ? styles.tipoOrdineBtnActive : {}),
                }}
                onClick={() => setTipoOrdine(TIPO_ORDINE.DELIVERY)}
              >
                Delivery
              </button>
            </>
          )}
          <button type="button" style={styles.nuovoClienteBtn} onClick={() => setNuovoClienteModalOpen(true)}>
            Nuovo cliente
          </button>
          <button
            type="button"
            onClick={() => setShowPaginaOrdini(true)}
            style={{ padding: "8px 14px", background: "#5d4037", color: "#fff", border: "none", borderRadius: 8, fontSize: 13 }}
            title="Vedi e cerca tutti gli ordini"
          >
            Ordini
          </button>
          <button
            type="button"
            onClick={() => setShowPlanningBar((v) => !v)}
            style={{ padding: "8px 14px", background: "#2e7d32", color: "#fff", border: "none", borderRadius: 8, fontSize: 13 }}
            title="Situazione planning"
          >
            Planning
          </button>
        </div>
      </div>
    )
    setCassaHeader(toolbar)
    return () => setCassaHeader(null)
  }, [
    setCassaHeader,
    tipoOrdine,
    deliverySearch,
    selectedCliente,
    deliverySearchResults,
    deliverySearchLoading,
    lastOrderLoading,
  ])

  /////////////////////////////////////////////////////////
  // CART LOGIC
  /////////////////////////////////////////////////////////

  const addToCartWithIngredienti = useCallback((product, modsPayload = null) => {
    const summary = modsPayload?.ingredientiCotturaSummary ?? ""
    const key =
      modsPayload?.formatoSpecial === "famiglia"
        ? `famiglia:${modsPayload.formatoNome ?? ""}`
        : modsPayload?.formatoSpecial === "mezzo_metro" || modsPayload?.formatoSpecial === "metro"
          ? `${modsPayload.formatoSpecial}:${modsPayload.formatoNome ?? ""}`
          : modsPayload
          ? JSON.stringify({
              m: modsPayload.ingredientiModifiche,
              e: modsPayload.extraIngredienti,
              i: modsPayload.impastoId ?? null,
              f: modsPayload.formatoId ?? null,
              c: modsPayload.cotturaId ?? null,
            })
          : ""
    setCart((prev) => {
      const existing = prev.find(
        (p) =>
          p.id === product.id &&
          (p.ingredientiCotturaSummary ?? "") === summary &&
          (p._modsKey ?? "") === key
      )
      if (existing) {
        return prev.map((p) =>
          p === existing ? { ...p, qty: p.qty + 1 } : p
        )
      }
      return [
        ...prev,
        {
          ...product,
          prezzo: modsPayload?.prezzoCalcolato != null ? modsPayload.prezzoCalcolato : product.prezzo,
          qty: 1,
          ingredientiCotturaSummary: summary,
          ingredientiModifiche: modsPayload?.ingredientiModifiche,
          extraIngredienti: modsPayload?.extraIngredienti,
          impastoId: modsPayload?.impastoId,
          impastoNome: modsPayload?.impastoNome,
          formatoId: modsPayload?.formatoId,
          formatoNome: modsPayload?.formatoNome,
          cotturaId: modsPayload?.cotturaId,
          cotturaNome: modsPayload?.cotturaNome,
          _modsKey: key,
        },
      ]
    })
  }, [])

  const addToCart = useCallback(
    async (product) => {
      if (!tenantId) return
      const ingList = await getProductIngredienti(tenantId, product.id)
      if (ingList?.length > 0) {
        const defaultModifiche = {}
        ingList.forEach((ing) => {
          defaultModifiche[ing.id] = {
            variante: "normale",
            cottura: ing.vaInCottura ? "in_cottura" : "fine_cottura",
          }
        })
        const defaultPayload = {
          ingredientiModifiche: defaultModifiche,
          extraIngredienti: [],
          ingredientiCotturaSummary: "",
        }
        addToCartWithIngredienti(product, defaultPayload)
        return
      }
      addToCartWithIngredienti(product, null)
    },
    [tenantId, addToCartWithIngredienti]
  )

  const confirmModificaPizza = useCallback(
    (modsPayload) => {
      if (!productToAdd) return
      const isFamiglia = modsPayload.famigliaGusti && modsPayload.productForCart
      const isMezzoMetroMetro = modsPayload.gustiProducts && modsPayload.productForCart
      if (isFamiglia || isMezzoMetroMetro) {
        addToCartWithIngredienti(modsPayload.productForCart, {
          formatoNome: modsPayload.formatoNome,
          prezzoCalcolato: modsPayload.prezzoCalcolato,
          formatoSpecial: modsPayload.formatoSpecial ?? (isFamiglia ? "famiglia" : null),
        })
        setProductModalOpen(false)
        setProductToAdd(null)
        return
      }
      addToCartWithIngredienti(productToAdd, modsPayload)
      setProductModalOpen(false)
      setProductToAdd(null)
    },
    [productToAdd, addToCartWithIngredienti]
  )

  const removeFromCart = useCallback((productId) => {
    setCart((prev) =>
      prev
        .map((p) =>
          p.id === productId ? { ...p, qty: p.qty - 1 } : p
        )
        .filter((p) => p.qty > 0)
    )
  }, [])

  const increaseQty = useCallback((item) => {
    setCart((prev) =>
      prev.map((p) => (p === item ? { ...p, qty: p.qty + 1 } : p))
    )
  }, [])

  const decreaseQty = useCallback((item) => {
    setCart((prev) =>
      prev
        .map((p) => (p === item ? { ...p, qty: p.qty - 1 } : p))
        .filter((p) => p.qty > 0)
    )
  }, [])

  const clearCart = useCallback(() => {
    setCart([])
  }, [])

  const total = useMemo(() => {
    return cart.reduce(
      (sum, p) => sum + Number(p.prezzo) * p.qty,
      0
    )
  }, [cart])

  /////////////////////////////////////////////////////////
  // CHECKOUT
  /////////////////////////////////////////////////////////

  const handleCheckout = async () => {
    if (!cart.length || !tenantId || loading) return
    setCheckoutError(null)
    try {
      setLoading(true)
      const indirizzoConsegna = tipoOrdine === TIPO_ORDINE.DELIVERY ? (deliverySearch || selectedCliente?.indirizzo || "") : ""
      const nomeCliente = tipoOrdine === TIPO_ORDINE.NEGOZIO ? (checkoutNomeCliente || "").trim() : ""
      const orarioRitiro = checkoutSelectedSlot?.label ?? ""
      await createOrder(tenantId, {
        totale: total,
        stato: ORDER_STATUS,
        items: cart.map((p) => ({
          prodotto_id: p.id,
          quantita: p.qty,
          prezzo: p.prezzo,
          formatoNome: p.formatoNome ?? undefined,
        })),
        note: checkoutNote.trim() || undefined,
        tipoPagamento: checkoutTipoPagamento || undefined,
        tipoOrdine: tipoOrdine || undefined,
        nomeCliente: nomeCliente || undefined,
        orarioRitiro: orarioRitiro || undefined,
        indirizzoConsegna: indirizzoConsegna || undefined,
      })
      setCart([])
      setCheckoutNote("")
      setCheckoutTipoPagamento(TIPI_PAGAMENTO[0])
      setCheckoutNomeCliente("")
      setCheckoutSelectedSlot(null)
      setDeliverySearch("")
      setSelectedCliente(null)
      setShowRiepilogo(false)
      loadOrdini()
    } catch (err) {
      console.error("Errore checkout:", err)
      setCheckoutError(err?.message ?? "Errore durante il checkout. Verifica la RPC create_order_with_items e le colonne note/tipo_pagamento.")
    } finally {
      setLoading(false)
    }
  }

  /////////////////////////////////////////////////////////
  // RENDER
  /////////////////////////////////////////////////////////

  const filteredProducts = useMemo(() => {
    const q = (searchPizza || "").toLowerCase().trim()
    if (!q) return products
    return products.filter((p) => (p.nome || "").toLowerCase().includes(q))
  }, [products, searchPizza])

  const disabledProductIds = useMemo(() => {
    const set = new Set()
    const prodottiEsauriti = tenantData?.parametri_operativi?.prodotti_esauriti
    if (Array.isArray(prodottiEsauriti)) prodottiEsauriti.forEach((id) => set.add(id))
    if (!ingredientiEsauritiIds?.length) return set
    for (const product of filteredProducts) {
      const ingIds = productIngredientIdsMap[product.id] || []
      if (ingIds.some((id) => ingredientiEsauritiIds.includes(id))) set.add(product.id)
    }
    return set
  }, [filteredProducts, productIngredientIdsMap, ingredientiEsauritiIds, tenantData?.parametri_operativi?.prodotti_esauriti])

  const parametri = tenantData?.parametri_operativi || {}
  const menuTheme = resolveMenuTheme(parametri)
  const menuRowBackground = menuTheme?.cardBackground || "#f3f9f4"
  const activeCatNome = (categories.find((c) => c.id === activeCategory)?.nome || "").toLowerCase()
  const showModificaCategoria = !["fritti", "dolci", "bibite"].includes(activeCatNome)

  const orariOggi = useMemo(() => getTodayOrari(tenantData?.orari_settimana), [tenantData?.orari_settimana])
  const slotDeliveryMin = Number(parametri.consegne_ogni_min) || 15
  const slotNegozioMin = Number(parametri.ritiro_ogni_min) || 5
  const pizzeOgni15 = Number(parametri.pizze_ogni_15_min) || 8
  const sogliaGiallo = Number(parametri.soglia_giallo_pizze) || 10
  const maxPizzeDelivery = Math.max(1, Math.round((pizzeOgni15 * slotDeliveryMin) / 15))
  const maxPizzeNegozio = Math.max(1, Math.round((pizzeOgni15 * slotNegozioMin) / 15))

  const planningSlotsDelivery = useMemo(
    () => buildSlotsFullDay(slotDeliveryMin, orariOggi),
    [slotDeliveryMin, orariOggi]
  )
  const planningSlotsNegozio = useMemo(
    () => buildSlotsFullDay(slotNegozioMin, orariOggi),
    [slotNegozioMin, orariOggi]
  )
  const ordiniPerSlotDelivery = useMemo(() => {
    const delivery = (ordiniOggiFiltered || []).filter((o) => (o.tipo_ordine || "").toLowerCase() === "delivery")
    return groupOrdersBySlotOrarioRitiro(delivery, slotDeliveryMin)
  }, [ordiniOggiFiltered, slotDeliveryMin])
  const ordiniPerSlotNegozio = useMemo(() => {
    const negozio = (ordiniOggiFiltered || []).filter((o) => {
      const t = (o.tipo_ordine || "").toLowerCase()
      return t === "negozio" || t === ""
    })
    return groupOrdersBySlotOrarioRitiro(negozio, slotNegozioMin)
  }, [ordiniOggiFiltered, slotNegozioMin])
  const ordiniBySlotDelivery = useMemo(() => {
    const delivery = (ordiniOggiFiltered || []).filter((o) => (o.tipo_ordine || "").toLowerCase() === "delivery")
    return groupOrdiniBySlotOrarioRitiro(delivery, slotDeliveryMin)
  }, [ordiniOggiFiltered, slotDeliveryMin])
  const ordiniBySlotNegozio = useMemo(() => {
    const negozio = (ordiniOggiFiltered || []).filter((o) => {
      const t = (o.tipo_ordine || "").toLowerCase()
      return t === "negozio" || t === ""
    })
    return groupOrdiniBySlotOrarioRitiro(negozio, slotNegozioMin)
  }, [ordiniOggiFiltered, slotNegozioMin])
  const pizzePerSlotDelivery = useMemo(() => {
    const delivery = (ordiniOggiFiltered || []).filter((o) => (o.tipo_ordine || "").toLowerCase() === "delivery")
    return groupPizzeBySlotOrarioRitiro(delivery, pizzePerOrdine, slotDeliveryMin)
  }, [ordiniOggiFiltered, pizzePerOrdine, slotDeliveryMin])
  const pizzePerSlotNegozio = useMemo(() => {
    const negozio = (ordiniOggiFiltered || []).filter((o) => {
      const t = (o.tipo_ordine || "").toLowerCase()
      return t === "negozio" || t === ""
    })
    return groupPizzeBySlotOrarioRitiro(negozio, pizzePerOrdine, slotNegozioMin)
  }, [ordiniOggiFiltered, pizzePerOrdine, slotNegozioMin])

  const pizzePerSlotRiepilogo = useMemo(() => {
    const slotMin = tipoOrdine === "delivery" ? slotDeliveryMin : slotNegozioMin
    const filtered = (ordiniOggiFiltered || []).filter((o) => {
      const t = (o.tipo_ordine || "").toLowerCase()
      if (tipoOrdine === "delivery") return t === "delivery"
      return t === "negozio" || t === ""
    })
    return groupPizzeBySlotOrarioRitiro(filtered, pizzePerOrdine, slotMin)
  }, [tipoOrdine, ordiniOggiFiltered, pizzePerOrdine, slotDeliveryMin, slotNegozioMin])

  const ordiniFiltratiPerPagina = useMemo(() => {
    const q = (ordiniSearch || "").toLowerCase().trim()
    let list = ordiniOggiFiltered || []
    if (q) {
      list = list.filter((o) => {
        const nome = (o.nome_cliente ?? o.nome ?? "").toLowerCase()
        const indirizzo = (o.indirizzo_consegna ?? o.indirizzo ?? "").toLowerCase()
        const num = String(o.numero ?? o.numero_ordine ?? "")
        return nome.includes(q) || indirizzo.includes(q) || num.includes(q)
      })
    }
    return list
  }, [ordiniOggiFiltered, ordiniSearch])

  const ordiniRaggruppatiPerOra = useMemo(() => {
    const byKey = {}
    for (const o of ordiniFiltratiPerPagina) {
      const orarioSelezionato = (o.orario_ritiro || "").trim()
      const key = orarioSelezionato || (() => {
        const raw = o.createdAt ?? o.created_at
        if (!raw) return "—"
        const d = new Date(raw)
        return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
      })()
      if (!byKey[key]) byKey[key] = []
      byKey[key].push(o)
    }
    for (const arr of Object.values(byKey)) {
      arr.sort((a, b) => new Date(b.createdAt ?? b.created_at) - new Date(a.createdAt ?? a.created_at))
    }
    return Object.keys(byKey)
      .sort()
      .map((ora) => ({ ora, ordini: byKey[ora] }))
  }, [ordiniFiltratiPerPagina])

  const planningMergedRows = useMemo(() => {
    const slotMs = slotDeliveryMin * 60 * 1000
    return (planningSlotsDelivery || []).map((slot) => {
      const deliveryOrdini = ordiniPerSlotDelivery[slot.key] ?? 0
      const deliveryPizze = pizzePerSlotDelivery[slot.key] ?? 0
      const deliveryOrdiniList = ordiniBySlotDelivery[slot.key] || []
      let ritiroOrdini = 0
      let ritiroPizze = 0
      const ritiroOrdiniList = []
      for (const neg of planningSlotsNegozio || []) {
        if (neg.key >= slot.key && neg.key < slot.key + slotMs) {
          ritiroOrdini += ordiniPerSlotNegozio[neg.key] ?? 0
          ritiroPizze += pizzePerSlotNegozio[neg.key] ?? 0
          ritiroOrdiniList.push(...(ordiniBySlotNegozio[neg.key] || []))
        }
      }
      return {
        slotKey: slot.key,
        label: slot.label,
        deliveryOrdini,
        deliveryPizze,
        deliveryOrdiniList,
        ritiroOrdini,
        ritiroPizze,
        ritiroOrdiniList,
        deliveryColor: slotColor(deliveryPizze, maxPizzeDelivery, sogliaGiallo),
        ritiroColor: slotColor(ritiroPizze, maxPizzeNegozio, sogliaGiallo),
      }
    })
  }, [
    planningSlotsDelivery,
    planningSlotsNegozio,
    ordiniPerSlotDelivery,
    ordiniPerSlotNegozio,
    ordiniBySlotDelivery,
    ordiniBySlotNegozio,
    pizzePerSlotDelivery,
    pizzePerSlotNegozio,
    slotDeliveryMin,
    maxPizzeDelivery,
    maxPizzeNegozio,
    sogliaGiallo,
  ])

  if (showImpostazioniCassa) {
    return (
      <CassaImpostazioniPage onBack={() => setShowImpostazioniCassa(false)} />
    )
  }

  if (showRiepilogo) {
    return (
      <>
        <RiepilogoOrdinePage
          cart={cart}
          total={total}
          tipoOrdine={tipoOrdine}
          deliverySearch={deliverySearch}
          checkoutNote={checkoutNote}
          onCheckoutNoteChange={setCheckoutNote}
          checkoutTipoPagamento={checkoutTipoPagamento}
          onCheckoutTipoPagamentoChange={setCheckoutTipoPagamento}
          checkoutNomeCliente={checkoutNomeCliente}
          onCheckoutNomeClienteChange={setCheckoutNomeCliente}
          selectedSlot={checkoutSelectedSlot}
          onSlotSelect={setCheckoutSelectedSlot}
          tipiPagamento={TIPI_PAGAMENTO}
          parametri={parametri}
          orariSettimana={tenantData?.orari_settimana}
          onConfirm={handleCheckout}
          onBack={() => setShowRiepilogo(false)}
          loading={loading}
          checkoutError={checkoutError}
          onIncrease={increaseQty}
          onDecrease={decreaseQty}
          onRemove={(item) => setCart((prev) => prev.filter((p) => p !== item))}
          pizzePerSlotFromOrders={pizzePerSlotRiepilogo}
        />
        <ModificaPizzaModal
          open={productModalOpen}
          onClose={() => { setProductModalOpen(false); setProductToAdd(null); }}
          product={productToAdd}
          tenantId={tenantId}
          tipoOrdine={tipoOrdine}
          parametri={tenantData?.parametri_operativi}
          onConfirm={confirmModificaPizza}
        />
        <NuovoClienteModal open={nuovoClienteModalOpen} onClose={() => setNuovoClienteModalOpen(false)} tenantId={tenantId} onSuccess={handleNuovoClienteSuccess} />
      </>
    )
  }

  return (
    <div style={styles.wrapper}>
      {showPaginaOrdini && (
        <div style={styles.modalOverlay} onClick={() => setShowPaginaOrdini(false)} role="dialog" aria-modal="true">
          <div style={{ ...styles.detailModal, maxWidth: 520, width: "95%", maxHeight: "90vh", display: "flex", flexDirection: "column" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ margin: 0 }}>Ordini</h3>
              <button type="button" style={styles.planningBarClose} onClick={() => setShowPaginaOrdini(false)}>✕</button>
            </div>
            <input
              type="text"
              placeholder="Cerca per nome, indirizzo, numero ordine..."
              value={ordiniSearch}
              onChange={(e) => setOrdiniSearch(e.target.value)}
              style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #ddd", marginBottom: 16 }}
            />
            <div style={{ flex: 1, overflowY: "auto", minHeight: 200 }}>
              {ordiniRaggruppatiPerOra.length === 0 ? (
                <p style={{ color: "#666", fontSize: 14 }}>Nessun ordine trovato.</p>
              ) : (
                ordiniRaggruppatiPerOra.map(({ ora, ordini }) => (
                  <div key={ora} style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "#555", marginBottom: 6, paddingBottom: 4, borderBottom: "1px solid #eee" }}>
                      Orario {ora} – {ordini.length} {ordini.length === 1 ? "ordine" : "ordini"}
                    </div>
                    <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                      {ordini.map((o) => {
                        const tp = (o.tipo_pagamento || "").toLowerCase()
                        const iconPagamento = tp.includes("contanti") ? "💵" : tp.includes("carta") ? "💳" : "⏳"
                        const labelPagamento = tp.includes("da pagare") || tp === "da pagare" ? "Da pag." : (o.tipo_pagamento || "—")
                        const isDelivery = (o.tipo_ordine || "").toLowerCase() === "delivery"
                        const nome = o.nome_cliente ?? o.nome ?? ""
                        const indirizzo = o.indirizzo_consegna ?? o.indirizzo ?? ""
                        const idOrdine = `#${o.numero ?? o.numero_ordine ?? "—"}`
                        return (
                          <li key={o.id}>
                            <button
                              type="button"
                              style={styles.ordiniItem}
                              onClick={() => { openOrdineDetail(o.id); setShowPaginaOrdini(false); }}
                              title="Apri dettaglio"
                            >
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontWeight: 700, fontSize: 15 }}>{nome || "—"}</div>
                                  <div style={{ fontSize: 11, color: "#666", marginTop: 2 }}>{idOrdine}</div>
                                  {isDelivery && indirizzo && (
                                    <div style={{ fontSize: 11, color: "#555", marginTop: 2 }}>{indirizzo}</div>
                                  )}
                                </div>
                                <span style={{ fontSize: 14 }}>€ {typeof o.totale === "number" ? o.totale.toFixed(2) : o.totale ?? "—"}</span>
                                <span style={{ fontSize: 12, marginLeft: 4 }} title={labelPagamento}>{iconPagamento}</span>
                              </div>
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
      <div style={styles.ordiniSection}>
        <h3 style={styles.ordiniTitle}>Ordini</h3>
        <ul style={styles.ordiniList}>
          {ordiniOggiFiltered.map((o) => {
            const tp = (o.tipo_pagamento || "").toLowerCase()
            const iconPagamento = tp.includes("contanti") ? "💵" : tp.includes("carta") ? "💳" : "⏳"
            const labelPagamento = tp.includes("da pagare") || tp === "da pagare" ? "Da pag." : (o.tipo_pagamento || "—")
            const isDelivery = (o.tipo_ordine || "").toLowerCase() === "delivery"
            const nome = o.nome_cliente ?? o.nome ?? ""
            const indirizzo = o.indirizzo_consegna ?? o.indirizzo ?? ""
            const idOrdine = `#${o.numero ?? o.numero_ordine ?? "—"}`
            return (
              <li key={o.id}>
                <button
                  type="button"
                  style={styles.ordiniItem}
                  onClick={() => openOrdineDetail(o.id)}
                  title="Apri dettaglio"
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 15 }}>{nome || "—"}</div>
                      <div style={{ fontSize: 11, color: "#666", marginTop: 2 }}>{idOrdine}</div>
                      {isDelivery && indirizzo && (
                        <div style={{ fontSize: 11, color: "#555", marginTop: 2 }}>{indirizzo}</div>
                      )}
                    </div>
                    <span style={{ fontSize: 14 }}>€ {typeof o.totale === "number" ? o.totale.toFixed(2) : o.totale ?? "—"}</span>
                    <span style={{ fontSize: 12, marginLeft: 4 }} title={labelPagamento}>{iconPagamento}</span>
                  </div>
                </button>
              </li>
            )
          })}
        </ul>
      </div>
      <div style={styles.productsArea}>
        {showPlanningBar && (
          <div style={styles.planningBar}>
            <div style={styles.planningBarHeader}>
              <strong>Situazione planning</strong>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setOrdiniOnlineDisabilitati((v) => !v)}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 6,
                    border: "1px solid #999",
                    background: ordiniOnlineDisabilitati ? "#c62828" : "#2e7d32",
                    color: "#fff",
                    fontSize: 12,
                    fontWeight: 500,
                    cursor: "pointer",
                  }}
                  title={ordiniOnlineDisabilitati ? "Riabilita ordini online" : "Disabilita ordini online"}
                >
                  {ordiniOnlineDisabilitati ? "Ordini online disattivi" : "Ordini online attivi"}
                </button>
                <button type="button" style={styles.planningBarClose} onClick={() => setShowPlanningBar(false)}>✕</button>
              </div>
            </div>
            <p style={styles.planningHint}>
              Fasce da apertura a chiusura. Per ogni colonna: ordini e pizze già prenotate in quella fascia. Verde: ok, giallo: quasi pieno, rosso: pieno (soglia pizze).
            </p>
            {!orariOggi.aperto && (
              <p style={{ margin: "0 0 12px", color: "#c62828", fontWeight: 500 }}>Oggi chiuso (nessuna fascia disponibile).</p>
            )}
            {planningMergedRows.length > 0 ? (
              <div style={styles.planningMergedTable}>
                <div style={styles.planningMergedHeader}>
                  <span style={styles.planningMergedCellTime}>Ora</span>
                  <span style={{ ...styles.planningMergedCell, background: "#e3f2fd", borderColor: "#1976d2" }}>Consegne ({slotDeliveryMin} min)</span>
                  <span style={{ ...styles.planningMergedCell, background: "#f3e5f5", borderColor: "#7b1fa2", borderRight: "none" }}>Ritiro negozio ({slotNegozioMin} min)</span>
                </div>
                {planningMergedRows.map((row, i) => {
                  const deliveryIndirizzi = (row.deliveryOrdiniList || [])
                    .map((o) => (o.indirizzo_consegna || o.indirizzo || "").trim())
                    .filter(Boolean)
                  const indirizziPreview = deliveryIndirizzi.length ? deliveryIndirizzi.slice(0, 3).join(" · ") : ""
                  const hasMoreIndirizzi = deliveryIndirizzi.length > 3
                  return (
                    <div key={i} style={styles.planningMergedRow}>
                      <span style={styles.planningMergedCellTime}>{row.label}</span>
                      <button
                        type="button"
                        style={{
                          ...styles.planningMergedCell,
                          backgroundColor: row.deliveryColor,
                          borderColor: "#81c784",
                          cursor: "pointer",
                          textAlign: "left",
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "stretch",
                          gap: 4,
                        }}
                        onClick={() => setPlanningSlotModal({
                          type: "delivery",
                          slotKey: row.slotKey,
                          slotLabel: row.label,
                          ordini: row.deliveryOrdiniList || [],
                          slotMinutes: slotDeliveryMin,
                          slotsDisponibili: planningSlotsDelivery || [],
                        })}
                        title="Clicca per vedere ordini e spostare consegne"
                      >
                        <span>{row.deliveryOrdini} ord · {row.deliveryPizze} pizze</span>
                        {indirizziPreview && (
                          <span style={{ fontSize: 10, color: "#333", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {indirizziPreview}{hasMoreIndirizzi ? " …" : ""}
                          </span>
                        )}
                      </button>
                      <button
                        type="button"
                        style={{
                          ...styles.planningMergedCell,
                          backgroundColor: row.ritiroColor,
                          borderColor: "#81c784",
                          borderRight: "none",
                          cursor: "pointer",
                          textAlign: "left",
                        }}
                        onClick={() => setPlanningSlotModal({
                          type: "ritiro",
                          slotKey: row.slotKey,
                          slotLabel: row.label,
                          ordini: row.ritiroOrdiniList || [],
                          slotMinutes: slotNegozioMin,
                          slotsDisponibili: planningSlotsNegozio || [],
                        })}
                        title="Clicca per vedere ordini e spostare ritiri"
                      >
                        {row.ritiroOrdini} ord · {row.ritiroPizze} pizze
                      </button>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p style={{ fontSize: 13, color: "#666" }}>Nessuna fascia disponibile.</p>
            )}
          </div>
        )}

        {planningSlotModal && (
          <div style={styles.modalOverlay} onClick={() => setPlanningSlotModal(null)} role="dialog" aria-modal="true">
            <div style={{ ...styles.detailModal, maxWidth: 520, width: "95%" }} onClick={(e) => e.stopPropagation()}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <h3 style={{ margin: 0 }}>
                  Ordini · {planningSlotModal.slotLabel} · {planningSlotModal.type === "delivery" ? "Consegne" : "Ritiro negozio"}
                </h3>
                <button type="button" style={styles.planningBarClose} onClick={() => setPlanningSlotModal(null)}>✕</button>
              </div>
              {planningSlotModal.ordini.length === 0 ? (
                <p style={{ color: "#666" }}>Nessun ordine in questa fascia.</p>
              ) : (
                <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                  {planningSlotModal.ordini.map((o) => {
                    const isDelivery = planningSlotModal.type === "delivery"
                    const nome = o.nome_cliente ?? o.nome ?? "—"
                    const indirizzo = (o.indirizzo_consegna ?? o.indirizzo ?? "").trim()
                    const numero = o.numero ?? o.numero_ordine ?? "—"
                    const loading = planningSpostaLoading === o.id
                    return (
                      <li key={o.id} style={{ borderBottom: "1px solid #eee", padding: "12px 0" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 600 }}>#{numero} · {nome}</div>
                            {isDelivery && indirizzo && <div style={{ fontSize: 12, color: "#555", marginTop: 4 }}>{indirizzo}</div>}
                            <div style={{ fontSize: 12, color: "#666", marginTop: 2 }}>€ {typeof o.totale === "number" ? o.totale.toFixed(2) : o.totale ?? "—"}</div>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <label style={{ fontSize: 12, fontWeight: 500 }}>Sposta a:</label>
                            <select
                              value={o.orario_ritiro ?? ""}
                              onChange={(e) => {
                                const val = e.target.value
                                if (val && val !== (o.orario_ritiro || "")) handleSpostaOrdinePlanning(o.id, val)
                              }}
                              disabled={loading}
                              style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid #ccc", fontSize: 13 }}
                            >
                              {(planningSlotModal.slotsDisponibili || []).map((slot) => (
                                <option key={slot.key} value={slot.label}>
                                  {slot.label}
                                </option>
                              ))}
                            </select>
                            {loading && <span style={{ fontSize: 12, color: "#666" }}>...</span>}
                          </div>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </div>
        )}

        {!showPlanningBar && canEditParametriCassa && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <button type="button" style={styles.impostazioniBtn} onClick={() => setShowImpostazioniCassa(true)}>
              Impostazioni cassa
            </button>
          </div>
        )}
        <div style={{ marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
          <input
            type="text"
            placeholder="Cerca pizza..."
            value={searchPizza}
            onChange={(e) => setSearchPizza(e.target.value)}
            style={{ flex: 1, padding: "10px 14px", borderRadius: 8, border: "1px solid #ddd" }}
          />
        </div>
        <CategoryTabs
          categories={categories}
          activeCategory={activeCategory}
          onSelect={setActiveCategory}
        />

        <ProductGrid
          products={filteredProducts}
          ingredientiMap={productIngredientiMap}
          rowBackground={menuRowBackground}
          onAdd={addToCart}
          onModifica={(p) => {
            setProductToAdd(p)
            setProductModalOpen(true)
          }}
          showModifica={showModificaCategoria}
          disabledProductIds={disabledProductIds}
        />
      </div>

      <div style={styles.riepilogoSection}>
        <Cart
          cart={cart}
          total={total}
          tipoOrdine={tipoOrdine}
          deliverySearch={deliverySearch}
          onIncrease={increaseQty}
          onDecrease={decreaseQty}
          onRemove={(item) => setCart((prev) => prev.filter((p) => p !== item))}
          onCheckout={() => setShowRiepilogo(true)}
          onClear={clearCart}
          checkoutError={checkoutError}
          loading={false}
        />
      </div>

      <ModificaPizzaModal
        open={productModalOpen}
        onClose={() => {
          setProductModalOpen(false)
          setProductToAdd(null)
        }}
        product={productToAdd}
        tenantId={tenantId}
        tipoOrdine={tipoOrdine}
        parametri={tenantData?.parametri_operativi}
        onConfirm={confirmModificaPizza}
      />

      <NuovoClienteModal
        open={nuovoClienteModalOpen}
        onClose={() => setNuovoClienteModalOpen(false)}
        tenantId={tenantId}
        onSuccess={handleNuovoClienteSuccess}
      />

      <NuovoClienteModal
        open={profiloClienteModalOpen}
        onClose={() => setProfiloClienteModalOpen(false)}
        tenantId={tenantId}
        onSuccess={handleProfiloClienteSuccess}
        initialData={selectedCliente}
      />

      {noteModalOpen && (
        <div style={styles.modalOverlay} onClick={() => setNoteModalOpen(false)} role="dialog" aria-modal="true">
          <div style={styles.detailModal} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <h3 style={{ margin: 0 }}>Note (solo negozio)</h3>
              <button type="button" style={styles.planningBarClose} onClick={() => setNoteModalOpen(false)}>✕</button>
            </div>
            <p style={{ fontSize: 13, color: "#666", margin: "0 0 8px" }}>
              Queste note sono visibili solo al negozio, non al cliente.
            </p>
            <textarea
              value={checkoutNote}
              onChange={(e) => setCheckoutNote(e.target.value)}
              placeholder="Note per la cucina / consegna..."
              rows={4}
              style={{ width: "100%", padding: 10, resize: "vertical", marginBottom: 12, borderRadius: 6, border: "1px solid #ddd" }}
            />
            <button type="button" style={styles.impostazioniBtn} onClick={() => setNoteModalOpen(false)}>
              Chiudi
            </button>
          </div>
        </div>
      )}

      {ordineDetailLoading && (
        <div style={styles.modalOverlay}>
          <div style={{ background: "#fff", padding: 24, borderRadius: 8 }}>Caricamento...</div>
        </div>
      )}

      {ordineDetail && !ordineDetailLoading && (
        <div style={styles.modalOverlay} onClick={() => setOrdineDetail(null)} role="dialog" aria-modal="true">
          <div style={styles.detailModal} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ margin: 0 }}>Ordine #{ordineDetail.numero ?? "—"}</h3>
              <button type="button" style={styles.planningBarClose} onClick={() => setOrdineDetail(null)}>✕</button>
            </div>
            <p style={{ margin: "0 0 8px", color: "#666" }}>
              {ordineDetail.tipo_ordine === "delivery" ? "Consegna" : "Ritiro in negozio"}
            </p>
            {ordineDetail.tipo_ordine === "delivery" && ordineDetail.indirizzo_consegna && (
              <p style={{ margin: "0 0 12px", fontWeight: 500 }}>Indirizzo: {ordineDetail.indirizzo_consegna}</p>
            )}
            {ordineDetail.tipo_ordine === "negozio" && (
              <>
                {ordineDetail.nome_cliente && (
                  <p style={{ margin: "0 0 4px", fontWeight: 500 }}>Cliente: <strong>{ordineDetail.nome_cliente}</strong></p>
                )}
                {ordineDetail.orario_ritiro && (
                  <p style={{ margin: "0 0 12px", color: "#555" }}>Orario ritiro: {ordineDetail.orario_ritiro}</p>
                )}
              </>
            )}
            <ul style={{ listStyle: "none", padding: 0, margin: "0 0 12px", borderTop: "1px solid #eee", paddingTop: 12 }}>
              {(ordineDetail.righe || []).map((r, i) => {
                const nomeProdotto = ordineDetail.productNames?.[r.prodottoId ?? r.prodotto_id] ?? "—"
                const formatoNome = r.formatoNome ?? r.formato_nome
                const label = formatoNome ? `${nomeProdotto} (${formatoNome})` : nomeProdotto
                return (
                  <li key={r.id || i} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}>
                    <span>{label} x {r.quantita}</span>
                    <span>€ {(Number(r.prezzo) * (r.quantita || 1)).toFixed(2)}</span>
                  </li>
                )
              })}
            </ul>
            <p style={{ fontWeight: 600, marginBottom: 12 }}>Totale: € {typeof ordineDetail.totale === "number" ? ordineDetail.totale.toFixed(2) : ordineDetail.totale ?? "—"}</p>
            <p style={{ marginBottom: 12, fontSize: 13 }}>
              Pagamento: {(ordineDetail.tipo_pagamento || "—").toLowerCase().includes("da pagare") ? "⏳ Da pagare" : (ordineDetail.tipo_pagamento || "—")}
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
              {(ordineDetail.tipo_pagamento || "").toLowerCase().includes("da pagare") && (
                <button
                  type="button"
                  style={{ ...styles.impostazioniBtn, marginTop: 8 }}
                  onClick={() => setSegnaPagatoModal(ordineDetail.id)}
                >
                  Segna come pagato
                </button>
              )}
              <button
                type="button"
                style={{ ...styles.impostazioniBtn, marginTop: 8 }}
                onClick={() => {
                  setModificaOrdineModal(ordineDetail)
                  setModificaForm({
                    nome_cliente: ordineDetail.nome_cliente ?? "",
                    orario_ritiro: ordineDetail.orario_ritiro ?? "",
                    note: ordineDetail.note ?? "",
                    tipo_pagamento: ordineDetail.tipo_pagamento ?? "Da pagare",
                    indirizzo_consegna: ordineDetail.indirizzo_consegna ?? "",
                  })
                }}
              >
                Modifica
              </button>
            </div>
          </div>
        </div>
      )}

      {segnaPagatoModal && (
        <div style={styles.modalOverlay} onClick={() => setSegnaPagatoModal(null)} role="dialog" aria-modal="true">
          <div style={styles.detailModal} onClick={(e) => e.stopPropagation()}>
            <p style={{ margin: "0 0 12px", fontWeight: 600 }}>Segna ordine come pagato</p>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" style={styles.impostazioniBtn} onClick={() => handleSegnaPagato(segnaPagatoModal, "Contanti")}>
                Contanti
              </button>
              <button type="button" style={styles.impostazioniBtn} onClick={() => handleSegnaPagato(segnaPagatoModal, "Carta")}>
                Carta
              </button>
              <button type="button" style={styles.planningBarToggle} onClick={() => setSegnaPagatoModal(null)}>Annulla</button>
            </div>
          </div>
        </div>
      )}

      {modificaOrdineModal && (
        <div style={styles.modalOverlay} onClick={() => !modificaOrdineSaving && setModificaOrdineModal(null)} role="dialog" aria-modal="true">
          <div style={{ ...styles.detailModal, maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ margin: 0 }}>Modifica ordine #{modificaOrdineModal.numero ?? modificaOrdineModal.id}</h3>
              <button type="button" style={styles.planningBarClose} onClick={() => !modificaOrdineSaving && setModificaOrdineModal(null)} disabled={modificaOrdineSaving}>✕</button>
            </div>

            {/* Dettaglio ordine (sempre visibile) */}
            <div style={{ marginBottom: 20, paddingBottom: 16, borderBottom: "1px solid #eee" }}>
              <p style={{ margin: "0 0 8px", color: "#666", fontSize: 14 }}>
                {modificaOrdineModal.tipo_ordine === "delivery" ? "Consegna" : "Ritiro in negozio"}
              </p>
              {modificaOrdineModal.tipo_ordine === "delivery" && modificaOrdineModal.indirizzo_consegna && (
                <p style={{ margin: "0 0 8px", fontWeight: 500, fontSize: 14 }}>Indirizzo: {modificaOrdineModal.indirizzo_consegna}</p>
              )}
              {modificaOrdineModal.nome_cliente && (
                <p style={{ margin: "0 0 4px", fontWeight: 500, fontSize: 14 }}>Cliente: {modificaOrdineModal.nome_cliente}</p>
              )}
              {modificaOrdineModal.orario_ritiro && (
                <p style={{ margin: "0 0 12px", color: "#555", fontSize: 14 }}>Orario ritiro: {modificaOrdineModal.orario_ritiro}</p>
              )}
              <ul style={{ listStyle: "none", padding: 0, margin: "0 0 8px", fontSize: 14 }}>
                {(modificaOrdineModal.righe || []).map((r, i) => {
                  const nomeProdotto = modificaOrdineModal.productNames?.[r.prodottoId ?? r.prodotto_id] ?? "—"
                  const formatoNome = r.formatoNome ?? r.formato_nome
                  const label = formatoNome ? `${nomeProdotto} (${formatoNome})` : nomeProdotto
                  return (
                    <li key={r.id || i} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}>
                      <span>{label} x {r.quantita}</span>
                      <span>€ {(Number(r.prezzo) * (r.quantita || 1)).toFixed(2)}</span>
                    </li>
                  )
                })}
              </ul>
              <p style={{ fontWeight: 600, margin: 0, fontSize: 14 }}>Totale: € {typeof modificaOrdineModal.totale === "number" ? modificaOrdineModal.totale.toFixed(2) : modificaOrdineModal.totale ?? "—"}</p>
              <p style={{ margin: "8px 0 0", fontSize: 13, color: "#555" }}>Pagamento: {modificaOrdineModal.tipo_pagamento || "—"}</p>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontWeight: 500 }}>Nome cliente</span>
                <input
                  type="text"
                  value={modificaForm.nome_cliente}
                  onChange={(e) => setModificaForm((f) => ({ ...f, nome_cliente: e.target.value }))}
                  placeholder="Nome cliente"
                  style={{ padding: "8px 10px", borderRadius: 6, border: "1px solid #ccc" }}
                />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontWeight: 500 }}>Orario ritiro / consegna</span>
                <input
                  type="text"
                  value={modificaForm.orario_ritiro}
                  onChange={(e) => setModificaForm((f) => ({ ...f, orario_ritiro: e.target.value }))}
                  placeholder="es. 18:30"
                  style={{ padding: "8px 10px", borderRadius: 6, border: "1px solid #ccc" }}
                />
              </label>
              {modificaOrdineModal.tipo_ordine === "delivery" && (
                <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <span style={{ fontWeight: 500 }}>Indirizzo consegna</span>
                  <input
                    type="text"
                    value={modificaForm.indirizzo_consegna}
                    onChange={(e) => setModificaForm((f) => ({ ...f, indirizzo_consegna: e.target.value }))}
                    placeholder="Indirizzo"
                    style={{ padding: "8px 10px", borderRadius: 6, border: "1px solid #ccc" }}
                  />
                </label>
              )}
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontWeight: 500 }}>Note</span>
                <textarea
                  value={modificaForm.note}
                  onChange={(e) => setModificaForm((f) => ({ ...f, note: e.target.value }))}
                  placeholder="Note ordine"
                  rows={2}
                  style={{ padding: "8px 10px", borderRadius: 6, border: "1px solid #ccc", resize: "vertical" }}
                />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontWeight: 500 }}>Tipo pagamento</span>
                <select
                  value={modificaForm.tipo_pagamento}
                  onChange={(e) => setModificaForm((f) => ({ ...f, tipo_pagamento: e.target.value }))}
                  style={{ padding: "8px 10px", borderRadius: 6, border: "1px solid #ccc" }}
                >
                  {TIPI_PAGAMENTO.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </label>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
              <button type="button" style={styles.impostazioniBtn} onClick={handleSalvaModificaOrdine} disabled={modificaOrdineSaving}>
                {modificaOrdineSaving ? "Salvataggio..." : "Salva"}
              </button>
              <button type="button" style={styles.planningBarToggle} onClick={() => !modificaOrdineSaving && setModificaOrdineModal(null)} disabled={modificaOrdineSaving}>
                Annulla
              </button>
            </div>
          </div>
        </div>
      )}

      {lastOrderLoading && (
        <div style={styles.modalOverlay}>
          <div style={{ background: "#fff", padding: 24, borderRadius: 8 }}>Caricamento ultimo ordine...</div>
        </div>
      )}

      {lastOrderModalDetail && !lastOrderLoading && (
        <div style={styles.modalOverlay} onClick={() => setLastOrderModalDetail(null)} role="dialog" aria-modal="true">
          <div style={styles.detailModal} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ margin: 0 }}>Ultimo ordine</h3>
              <button type="button" style={styles.planningBarClose} onClick={() => setLastOrderModalDetail(null)}>✕</button>
            </div>
            {lastOrderModalDetail.empty ? (
              <p style={{ color: "#666" }}>Nessun ordine trovato per questo cliente.</p>
            ) : lastOrderModalDetail.error ? (
              <p style={{ color: "#c62828" }}>{lastOrderModalDetail.error}</p>
            ) : (
              <>
                <p style={{ margin: "0 0 8px", color: "#666" }}>Ordine #{lastOrderModalDetail.numero ?? "—"}</p>
                <p style={{ margin: "0 0 8px", color: "#666" }}>
                  {lastOrderModalDetail.tipo_ordine === "delivery" ? "Consegna" : "Ritiro in negozio"}
                </p>
                {lastOrderModalDetail.tipo_ordine === "delivery" && lastOrderModalDetail.indirizzo_consegna && (
                  <p style={{ margin: "0 0 12px", fontWeight: 500 }}>Indirizzo: {lastOrderModalDetail.indirizzo_consegna}</p>
                )}
                {lastOrderModalDetail.nome_cliente && (
                  <p style={{ margin: "0 0 12px", fontWeight: 500 }}>Cliente: {lastOrderModalDetail.nome_cliente}</p>
                )}
                {lastOrderModalDetail.orario_ritiro && (
                  <p style={{ margin: "0 0 12px", color: "#555" }}>Orario: {lastOrderModalDetail.orario_ritiro}</p>
                )}
                <ul style={{ listStyle: "none", padding: 0, margin: "0 0 12px", borderTop: "1px solid #eee", paddingTop: 12 }}>
                  {(lastOrderModalDetail.righe || []).map((r, i) => {
                    const nomeProdotto = lastOrderModalDetail.productNames?.[r.prodottoId ?? r.prodotto_id] ?? "—"
                    const formatoNome = r.formatoNome ?? r.formato_nome
                    const label = formatoNome ? `${nomeProdotto} (${formatoNome})` : nomeProdotto
                    return (
                      <li key={r.id || i} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}>
                        <span>{label} x {r.quantita}</span>
                        <span>€ {(Number(r.prezzo) * (r.quantita || 1)).toFixed(2)}</span>
                      </li>
                    )
                  })}
                </ul>
                <p style={{ fontWeight: 600, marginBottom: 12 }}>Totale: € {typeof lastOrderModalDetail.totale === "number" ? lastOrderModalDetail.totale.toFixed(2) : lastOrderModalDetail.totale ?? "—"}</p>
                <p style={{ margin: 0, fontSize: 13 }}>Pagamento: {lastOrderModalDetail.tipo_pagamento || "—"}</p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

const styles = {
  wrapper: {
    display: "flex",
    height: "100vh",
  },
  productsArea: {
    flex: 3,
    padding: "20px",
    overflowY: "auto",
  },
  topBar: {
    marginBottom: 16,
  },
  tipoOrdineRow: {
    display: "flex",
    gap: 8,
    marginBottom: 12,
  },
  tipoOrdineBtn: {
    padding: "10px 20px",
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: "#ddd",
    borderRadius: 8,
    background: "#fff",
    cursor: "pointer",
    fontSize: 14,
    fontWeight: 500,
  },
  tipoOrdineBtnActive: {
    background: "#2e7d32",
    color: "#fff",
    borderColor: "#2e7d32",
  },
  deliverySearchRow: {
    display: "flex",
    gap: 8,
    alignItems: "center",
  },
  deliverySearchWrap: {
    position: "relative",
  },
  dropdownList: {
    listStyle: "none",
    margin: "4px 0 0",
    padding: 0,
    background: "#fff",
    border: "1px solid #ddd",
    borderRadius: 8,
    boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
    maxHeight: 220,
    overflowY: "auto",
    position: "absolute",
    left: 0,
    right: 0,
    zIndex: 10,
  },
  dropdownItem: {
    padding: "10px 14px",
    cursor: "pointer",
    borderBottom: "1px solid #eee",
    fontSize: 14,
  },
  nuovoClienteBtn: {
    padding: "10px 16px",
    background: "#1976d2",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    cursor: "pointer",
    fontSize: 14,
    whiteSpace: "nowrap",
  },
  ordiniSection: {
    width: 220,
    flexShrink: 0,
    borderRight: "2px solid #eee",
    background: "#fafafa",
    padding: "16px",
    display: "flex",
    flexDirection: "column",
  },
  riepilogoSection: {
    width: 320,
    flexShrink: 0,
    borderLeft: "2px solid #eee",
    background: "#fff",
    display: "flex",
    flexDirection: "column",
    alignSelf: "flex-start",
    height: "100vh",
    overflowY: "auto",
  },
  ordiniTitle: {
    margin: "0 0 12px 0",
    fontSize: 16,
    fontWeight: 600,
  },
  ordiniList: {
    listStyle: "none",
    padding: 0,
    margin: 0,
    flex: 1,
    overflowY: "auto",
    minHeight: 120,
  },
  ordiniItem: {
    display: "flex",
    flexDirection: "column",
    alignItems: "stretch",
    width: "100%",
    padding: "8px 10px",
    marginBottom: 6,
    background: "#fff",
    borderRadius: 6,
    border: "1px solid #eee",
    fontSize: 13,
    cursor: "pointer",
    textAlign: "left",
    font: "inherit",
  },
  modalOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.4)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
  },
  detailModal: {
    background: "#fff",
    padding: 20,
    borderRadius: 12,
    maxWidth: 420,
    width: "90%",
    maxHeight: "85vh",
    overflowY: "auto",
  },
  riepilogoBtn: {
    marginTop: "auto",
    padding: "12px 16px",
    background: "#2e7d32",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    cursor: "pointer",
    fontSize: 14,
    fontWeight: 600,
  },
  planningBarToggle: {
    marginBottom: 12,
    padding: "8px 14px",
    background: "#f5f5f5",
    border: "1px solid #ddd",
    borderRadius: 6,
    cursor: "pointer",
    fontSize: 13,
  },
  impostazioniBtn: {
    padding: "8px 14px",
    background: "#1565c0",
    color: "#fff",
    border: "none",
    borderRadius: 6,
    cursor: "pointer",
    fontSize: 13,
  },
  planningBar: {
    marginBottom: 16,
    padding: 12,
    background: "#e3f2fd",
    border: "1px solid #90caf9",
    borderRadius: 8,
  },
  planningBarHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  planningBarClose: {
    background: "none",
    border: "none",
    cursor: "pointer",
    fontSize: 16,
    padding: "0 4px",
  },
  planningHint: {
    fontSize: 13,
    color: "#555",
    margin: "0 0 12px 0",
  },
  planningMergedTable: {
    border: "1px solid #90caf9",
    borderRadius: 8,
    overflow: "hidden",
    marginTop: 8,
  },
  planningMergedHeader: {
    display: "grid",
    gridTemplateColumns: "56px 1fr 1fr",
    gap: 0,
    fontSize: 12,
    fontWeight: 600,
    color: "#333",
  },
  planningMergedRow: {
    display: "grid",
    gridTemplateColumns: "56px 1fr 1fr",
    gap: 0,
    fontSize: 12,
    borderTop: "1px solid #90caf9",
  },
  planningMergedCellTime: {
    padding: "6px 8px",
    background: "#f5f5f5",
    borderRight: "1px solid #ddd",
    fontWeight: 600,
  },
  planningMergedCell: {
    padding: "6px 8px",
    borderRight: "1px solid #90caf9",
    borderBottom: "none",
  },
  planningSections: {
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },
  planningSection: {
    flex: 1,
  },
  planningSectionTitle: {
    margin: "0 0 8px 0",
    fontSize: 14,
    fontWeight: 600,
    color: "#333",
  },
  planningSlotsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(90px, 1fr))",
    gap: 8,
  },
  planningSlotBox: {
    padding: "10px",
    borderRadius: 8,
    border: "2px solid",
    textAlign: "center",
  },
  planningSlotTime: {
    fontWeight: 600,
    fontSize: 13,
  },
  planningSlotCount: {
    fontSize: 12,
    marginTop: 4,
    color: "#333",
  },
  contabilitaBtn: {
    padding: "10px 16px",
    background: "#2e7d32",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    cursor: "pointer",
    fontSize: 14,
    fontWeight: 500,
  },
  chiudiGiornataBtn: {
    padding: "10px 16px",
    background: "#c62828",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    cursor: "pointer",
    fontSize: 14,
    fontWeight: 500,
  },
}