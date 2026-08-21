import { useEffect, useState, useMemo, useCallback, useLayoutEffect, useRef } from "react"
import { useLocation } from "react-router-dom"
import { usePreservedNavigate } from "@/hooks/usePreservedNavigate"
import { useTenant } from "@/app/contexts/TenantContext"
import { usePv } from "@/app/contexts/PvContext"
import { useAuth } from "@/app/contexts/AuthContext"
import { useTenantServizi, resolveServiziIdsForTenant } from "@/app/hooks/useTenantServizi"
import { useOperativeSaDemoAccess } from "@/app/hooks/useOperativeSaDemoAccess"
import { useCassaHeader } from "@/app/contexts/CassaHeaderContext"
import { useMediaQuery } from "@/hooks/useMediaQuery"
import { isQaSupportSearch } from "@/utils/viewportLayoutPreview"

import CategoryTabs from "@/features/operative/cassa/components/CategoryTabs"
import ProductGrid from "@/features/operative/cassa/components/ProductGrid"
import RiepilogoOrdinePage from "@/features/operative/cassa/components/RiepilogoOrdinePage"
import CassaImpostazioniPage from "@/features/operative/cassa/components/CassaImpostazioniPage"
import ModificaPizzaModal from "@/features/operative/cassa/components/ModificaPizzaModal"
import NuovoClienteModal from "@/features/operative/cassa/components/NuovoClienteModal"
import Cart from "@/features/operative/cassa/components/Cart"
import CassaModificaOrdineModal from "@/features/operative/cassa/components/CassaModificaOrdineModal"
import CassaPlanningBoard from "@/features/operative/cassa/components/CassaPlanningBoard"
import {
  ordineTipoOrdine,
  ordineIsDelivery,
  ordineNomeCliente,
  ordineTelefonoRitiro,
  ordineIndirizzoConsegna,
  ordineOrarioRitiro,
  ordineRichiedeAccettazioneCassa,
} from "@/features/operative/cassa/utils/ordineFieldHelpers"
import { formatIndirizzoDisplayItaliano } from "@/utils/formatIndirizzoItaliano"
import { splitNomeDaIndirizzoConsegna } from "@/features/operative/cassa/utils/cassaDeliveryNomeIndirizzo"
import {
  deliveryIndirizzoRiga,
  indirizzoConsegnaMatchAnagrafica,
  orarioVisualizzatoLista,
  buildOrdineCardTitleModel,
} from "@/features/operative/cassa/utils/cassaDeliveryDisplay"
import {
  emailsMatchLoose,
  phonesMatchLoose,
  ordineStatoIncompleto,
  orderLineToCassaCartPayload,
} from "@/utils/ordineRecallCart"

import {
  getCategories,
  getProductsByCategory,
  getProductIngredienti,
  getCachedProductIngredienti,
  getProductIngredientiBatch,
  getIngredients,
  getRuoliPizzeria,
  turniCassaAperto,
  getProdottiByIds,
  getProducts,
  enrichProductsWithPrezzoCalcolato,
  searchAnagraficaClienti,
  searchFidelityCassa,
  enrollFidelityCliente,
  applyFidelityMovimento,
  getFoodcostPriceMismatchReport,
} from "@/features/admin/services/adminService"
import {
  createOrder,
  getOrders,
  getOrderDetail,
  getRigheAggregateByOrdineIds,
  updateOrderTipoPagamento,
  updateOrder,
  chiudiGiornata,
  enrichOrdineDetailIngredientiSummaries,
  updateOrderStato,
  logCassaAuditEvent,
  staffAccettaOrdineWeb,
  staffRifiutaOrdineWeb,
} from "@/features/operative/cassa/services/cassaOrdiniService"
import { updateTenantSettings } from "@/features/admin/services/parametriService"
import { useCassaModificaOrdine } from "@/features/operative/cassa/hooks/useCassaModificaOrdine"
import { newLocalId } from "@/features/admin/hooks/useTenantLocalJson"
import { roundTotalToFiveCents } from "@/utils/cassaArrotondamento"
import { readFiscalConfigFromParametri, enqueueCorrispettivoAfterCheckoutIfConfigured } from "@/integrations/fiscal"
import { runUnifiedPayByLinkSetup } from "@/integrations/payments"
import { markCheckoutStart, markCheckoutEnd } from "@/utils/cassaTelemetry"
import { isAuthFetchNetworkFailure } from "@/lib/supabaseEnv"
import { queueOfflineCheckout } from "@/offline/syncQueue"
import { useOfflineSync } from "@/hooks/useOfflineSync"
import { sortByOrdine } from "@/utils/sortByOrdine"
import { ordineIsAnnullato } from "@/utils/incassiFromOrdini"
import { getDeliveryPolygonOuterRing, pointInPolygonRing } from "@/utils/deliveryArea"
import { ordineDeliveryRichiedeAttenzione } from "@/utils/riderDeliveryConfig"
import { readPizzaioloLeadTimeConsegnaMin } from "@/features/operative/pizzaiolo/utils/pizzaioloUtils"
import { geocodeAddressForDelivery } from "@/utils/geocodeAddress"
import { resolveMenuTheme } from "@/utils/tenantMenuTheme"
import { getLocalYYYYMMDD, orderCreatedLocalDateKey } from "@/utils/localDate"
import { computeAutoChiusuraGiornataDate } from "@/utils/chiusuraGiornataAuto"
import {
  PLANNING_GRID_SLOT_MINUTES,
  buildSlotsFullDay,
  getTodayOrari,
  groupOrdersBySlotOrarioRitiro,
  groupOrdiniBySlotOrarioRitiro,
  groupPizzeBySlotOrarioRitiro,
  slotColor,
} from "@/features/operative/cassa/utils/planningUtils"
import {
  loadCassaDraft,
  saveCassaDraft,
  clearCassaDraft,
} from "@/features/operative/cassa/utils/cassaSessionDraft"
import {
  cartItemsToComandaRighe,
  printComandaKitchen,
  printComandaKitchenPerReparto,
  comandaPayloadFromOrdineDetail,
} from "@/features/operative/cassa/utils/printComanda"
import {
  printRicevuta,
  ricevutaRigheFromCartSnapshot,
  ricevutaPayloadFromOrdineDetail,
} from "@/features/operative/cassa/utils/printRicevuta"
import { readStampaModalita, readStampaQuando, canRepartoStampareRicevutaCortesia } from "@/utils/stampaOperativaConfig"
import { useOperativeOrdersLiveRefresh } from "@/features/operative/hooks/useOperativeOrdersLiveRefresh"
import { normalizeComandaRepartiStampanti } from "@/utils/comandaRepartiStampanti"
import { buildComandaIngredientiSummary, extractModificheFromIngredientiSummary } from "@/features/operative/cassa/utils/comandaIngredientiSummary"
import {
  cassaTipoOrdineBtn,
  cassaTipoOrdineBtnActive,
  cassaNuovoClienteBtn,
  cassaToolbarCompactBtn,
} from "@/features/operative/cassa/cassaToolbarButtonStyles"
import { readFidelityModalitaAccredito } from "@/utils/fidelityProgramConfig"
import { applyPromoCalendarioToProducts, fidelitySkippedByPromoCalendario } from "@/utils/promozioniCalendario"
import { normalizeRuoloOperativo } from "@/utils/operativeAreaAccess"
import { computeFidelityRedeemPuntiCost } from "@/utils/fidelityRedeem"
import { productMatchesMenuSearch } from "@/utils/menuProductSearch"
import {
  iconTipoPagamentoLista,
  isTipoPagamentoLink,
  labelTipoPagamentoLista,
  tipoPagamentoInAttesa,
} from "@/features/operative/cassa/utils/cassaPaymentDisplay"
import {
  listTipiPagamentoCassa,
  TIPO_PAGAMENTO_CONTANTI,
  TIPO_PAGAMENTO_CARTA,
  TIPO_PAGAMENTO_PAGA_ONLINE,
  isOrdineOnlineCanale,
} from "@/features/operative/cassa/utils/cassaPagamentiOptions"

const ORDER_STATUS = "IN_PREPARAZIONE"
const MAX_MISTO_RIGHE = 15
const TIPO_ORDINE = { NEGOZIO: "negozio", DELIVERY: "delivery" }

/** Salva in DB sempre "HH:mm" allineato alla `date` della fascia (evita etichette locale ambigue). */
function orarioRitiroFromSelectedSlot(slot) {
  if (!slot) return ""
  if (slot.date) {
    const d = slot.date instanceof Date ? slot.date : new Date(slot.date)
    if (!Number.isNaN(d.getTime())) {
      return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
    }
  }
  return String(slot.label || "").trim()
}

function ordineCreatedAt(o) {
  return o?.createdAt ?? o?.created_at ?? null
}

function ordinePuntoVenditaId(o) {
  const v = o?.punto_vendita_id ?? o?.puntoVenditaId
  return v != null && String(v).trim() !== "" ? String(v) : null
}

function ordineTurnoOperatoriId(o) {
  const v = o?.turno_operatori_id ?? o?.turnoOperatoriId
  if (v == null || v === "") return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function parseEuroInput(s) {
  return Number(String(s ?? "").replace(",", ".")) || 0
}

function sumMistoRighe(righe) {
  return (righe || []).reduce((acc, r) => acc + parseEuroInput(r?.importo), 0)
}

/** Stesso criterio di `ordiniRaggruppatiPerOra`: se manca orario_ritiro in DB si usa HH:mm da createdAt. */
function computeAccreditoFidelityPunti(parametriOperativi, cart, totaleOrdine) {
  const po = parametriOperativi && typeof parametriOperativi === "object" ? parametriOperativi : {}
  if (po.fidelity_attivo === false || po.fidelity_attivo === "false") return 0
  const modalita = readFidelityModalitaAccredito(po)
  if (modalita === "nessuno" || modalita === "entrambi") return 0
  if (modalita === "euro") {
    const pe = Number(po.fidelity_punti_per_euro)
    const factor = Number.isFinite(pe) && pe > 0 ? pe : 1
    return Math.max(0, Math.floor((Number(totaleOrdine) || 0) * factor))
  }
  if (modalita === "pizza") {
    const tpp = Math.max(1, Math.min(100, Number(po.fidelity_timbri_per_pizza) || 1))
    const qty = (cart || []).reduce((s, i) => s + (Number(i.qty) || 0), 0)
    return Math.max(0, Math.floor(qty * tpp))
  }
  return 0
}

/** Con `cassa_turno_obbligatorio` attivo: serve turno aperto; se c’è PV attivo deve coincidere col turno. */
function turnoOkForCassa(po, turno, activePvId) {
  if (!po || po.cassa_turno_obbligatorio !== true) return true
  if (!turno || turno.id == null) return false
  if (activePvId) {
    const tpv = turno.punto_vendita_id ?? turno.puntoVenditaId
    if (tpv == null || String(tpv) !== String(activePvId)) return false
  }
  return true
}

/** Riga titolo lista ordini: negozio = nome + orario a destra; delivery = nome grande + orario a destra. */
function OrdineCardTitleRows({ o, isDelivery }) {
  const m = buildOrdineCardTitleModel(o, isDelivery)
  if (isDelivery) {
    return (
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, width: "100%" }}>
        <span style={{ fontWeight: 700, fontSize: 17, lineHeight: 1.25, minWidth: 0 }}>{m.titoloPrincipale}</span>
        {m.showOrarioADestra ? (
          <span style={{ fontSize: 13, fontWeight: 600, color: "#1565c0", flexShrink: 0 }}>{m.orario}</span>
        ) : null}
      </div>
    )
  }
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, width: "100%" }}>
      <span style={{ fontWeight: 700, fontSize: 15, lineHeight: 1.25, minWidth: 0 }}>{m.titoloPrincipale}</span>
      {m.showOrarioADestra ? (
        <span style={{ fontSize: 13, fontWeight: 600, color: "#2e7d32", flexShrink: 0 }}>{m.orario}</span>
      ) : null}
    </div>
  )
}

/** Ordini collegati all’anagrafica: indirizzo + (email|telefono), oppure legacy nome(+indirizzo delivery). */
function ordiniFiltratiPerClienteAnagrafica(ordini, cliente) {
  if (!cliente) return []
  const nomeNorm = (cliente.nome || "").trim().toLowerCase()
  const clienteInd = cliente.indirizzo || ""
  const clienteTel = cliente.telefono || ""
  const clienteEmail = cliente.email || ""
  return (ordini || []).filter((o) => {
    const oNome = ordineNomeCliente(o).toLowerCase()
    const oInd = ordineIndirizzoConsegna(o)
    const oTel = ordineTelefonoRitiro(o)
    const oEmail = String(o.email_cliente ?? o.cliente_email ?? o.email ?? "").trim()
    const tipo = ordineTipoOrdine(o)

    const addrOk = indirizzoConsegnaMatchAnagrafica(clienteInd, oInd)
    const contactOk =
      phonesMatchLoose(clienteTel, oTel) || emailsMatchLoose(clienteEmail, oEmail)
    if (addrOk && contactOk) return true

    if (tipo === "delivery") {
      return Boolean(nomeNorm) && oNome === nomeNorm && indirizzoConsegnaMatchAnagrafica(clienteInd, oInd)
    }
    return Boolean(nomeNorm) && oNome === nomeNorm
  })
}

export default function CassaPage() {
  const navigate = usePreservedNavigate()
  const location = useLocation()
  const { tenantId, tenantData, refreshTenant } = useTenant()
  const { pendingCount: offlinePendingCount, flush: flushOfflineQueue, isOnline, flushing: offlineFlushing, lastFlush } = useOfflineSync(tenantId)
  const pvCtx = usePv()
  const activePvId = pvCtx?.activePv ?? null
  const pvLoading = pvCtx?.loading ?? false
  const pvList = pvCtx?.pvList ?? []
  const { user, ruolo } = useAuth()
  const canAnnullaOrdineCassa = useMemo(() => normalizeRuoloOperativo(ruolo) === "cassa", [ruolo])
  const { hasServizio, enforcementActive } = useTenantServizi()
  const { fullDemoAccess, inDemoLive, canEditParametri: resolveCanEditParametri } = useOperativeSaDemoAccess()
  /** Gate piano solo per colore/tooltip; pulsanti sempre visibili in Cassa. */
  const fidelityServizioOk = fullDemoAccess || !enforcementActive || hasServizio("fidelity_card")
  const ordiniOnlineInLicenza = useMemo(
    () => resolveServiziIdsForTenant(tenantData).has("ordini_online"),
    [tenantData],
  )

  const [categories, setCategories] = useState([])
  const categoriesRef = useRef([])
  categoriesRef.current = categories
  const [activeCategory, setActiveCategory] = useState(null)
  const [products, setProducts] = useState([])
  const [cart, setCart] = useState([])
  const [loading, setLoading] = useState(false)
  const [productModalOpen, setProductModalOpen] = useState(false)
  const [productToAdd, setProductToAdd] = useState(null)
  /** Riferimento riga carrello in modifica (modale pizza); null = nuova aggiunta da listino */
  const [pizzaModalEditCartLine, setPizzaModalEditCartLine] = useState(null)
  const [searchPizza, setSearchPizza] = useState("")
  const [tipoOrdine, setTipoOrdine] = useState(TIPO_ORDINE.NEGOZIO)
  const [deliverySearch, setDeliverySearch] = useState("")
  const [selectedCliente, setSelectedCliente] = useState(null)
  const [deliveryDraftByClienteId, setDeliveryDraftByClienteId] = useState({})
  const [deliverySearchResults, setDeliverySearchResults] = useState([])
  const [deliverySearchLoading, setDeliverySearchLoading] = useState(false)
  const [nuovoClienteModalOpen, setNuovoClienteModalOpen] = useState(false)
  const [profiloClienteModalOpen, setProfiloClienteModalOpen] = useState(false)
  const [clienteDomicilioQuickOpen, setClienteDomicilioQuickOpen] = useState(false)
  const [noteModalOpen, setNoteModalOpen] = useState(false)

  /** Carrello non vuoto oppure delivery con cliente scelto: nasconde Ordini/Fidelity in testata. */
  const cassaOrdineInCorso = useMemo(
    () => cart.length > 0 || (tipoOrdine === TIPO_ORDINE.DELIVERY && Boolean(selectedCliente)),
    [cart.length, tipoOrdine, selectedCliente],
  )
  const narrowCassaViewport = useMediaQuery("(max-width: 900px)")
  /** In Sala QA il layout mobile collassa il contenuto (schermo beige): forza desktop. */
  const cassaMobileLayout = narrowCassaViewport && !isQaSupportSearch(location.search)
  const [cassaMobileTab, setCassaMobileTab] = useState("menu")
  const [checkoutNote, setCheckoutNote] = useState("")
  const [checkoutTipoPagamento, setCheckoutTipoPagamento] = useState(TIPO_PAGAMENTO_CONTANTI)
  const [mistoRighe, setMistoRighe] = useState([])
  const [checkoutScontoGlobale, setCheckoutScontoGlobale] = useState("")
  const [checkoutNomeCliente, setCheckoutNomeCliente] = useState("")
  const [checkoutTelefonoCliente, setCheckoutTelefonoCliente] = useState("")
  const [checkoutSelectedSlot, setCheckoutSelectedSlot] = useState(null)
  const [checkoutError, setCheckoutError] = useState(null)
  /** Dopo conferma ordine, se non stampa automatica: payload per ristampare comanda. */
  const [pendingComandaPrint, setPendingComandaPrint] = useState(null)
  const [pendingRicevutaPrint, setPendingRicevutaPrint] = useState(null)
  const [showRiepilogo, setShowRiepilogo] = useState(false)
  const [fidelityQuery, setFidelityQuery] = useState("")
  const [fidelityHits, setFidelityHits] = useState([])
  const [fidelityLoading, setFidelityLoading] = useState(false)
  const [fidelitySearchDone, setFidelitySearchDone] = useState(false)
  const [selectedFidelitySaldo, setSelectedFidelitySaldo] = useState(null)
  const [fidelityPremioActive, setFidelityPremioActive] = useState(false)
  const [margheritaPremioPrezzo, setMargheritaPremioPrezzo] = useState(0)
  const [nuovoFidelityClienteModalOpen, setNuovoFidelityClienteModalOpen] = useState(false)
  const [showImpostazioniCassa, setShowImpostazioniCassa] = useState(false)
  const [ordiniOggi, setOrdiniOggi] = useState([])
  const [pizzePerOrdine, setPizzePerOrdine] = useState({})
  /** Data locale (YYYY-MM-DD): dichiarata subito — usata in effect/deps prima di altri memo. */
  const todayStr = useMemo(() => getLocalYYYYMMDD(), [])
  const [showPlanningBar, setShowPlanningBar] = useState(false)
  const [productIngredientiMap, setProductIngredientiMap] = useState({})
  const [productIngredientIdsMap, setProductIngredientIdsMap] = useState({})
  const [ingredientiEsauritiIds, setIngredientiEsauritiIds] = useState([])
  const [canEditParametriCassa, setCanEditParametriCassa] = useState(false)
  const [ordineDetail, setOrdineDetail] = useState(null)
  const [ordineDetailLoading, setOrdineDetailLoading] = useState(false)
  const [segnaPagatoModal, setSegnaPagatoModal] = useState(null)
  const [chiudiGiornataLoading, setChiudiGiornataLoading] = useState(false)
  const [chiudiGiornataConfirmOpen, setChiudiGiornataConfirmOpen] = useState(false)
  const [lastOrderModalDetail, setLastOrderModalDetail] = useState(null)
  const [lastOrderLoading, setLastOrderLoading] = useState(false)
  const [lastOrderDetailLoading, setLastOrderDetailLoading] = useState(false)
  const [ordiniOnlineDisabilitati, setOrdiniOnlineDisabilitati] = useState(false)
  const [ordiniOnlineToggleSaving, setOrdiniOnlineToggleSaving] = useState(false)
  const [showPaginaOrdini, setShowPaginaOrdini] = useState(false)
  const [fuoriAreaModal, setFuoriAreaModal] = useState(null)
  const bypassFuoriAreaCheckRef = useRef(false)
  /** Area prodotti (scroll) per tornare in cima dopo ordine concluso. */
  const cassaProductsAreaRef = useRef(null)
  const [ordiniSearch, setOrdiniSearch] = useState("")
  const [planningSlotModal, setPlanningSlotModal] = useState(null) // { type: 'delivery'|'ritiro'|'totale', slotKey, slotLabel, ordini, slotsDisponibili }
  const [planningSpostaLoading, setPlanningSpostaLoading] = useState(null) // ordineId while moving
  const [turnoCassa, setTurnoCassa] = useState(null)
  const [turnoCassaLoading, setTurnoCassaLoading] = useState(false)
  /** Notifiche non bloccanti: nuovi ordini web (polling); niente modal sopra il riepilogo ordine. */
  const [cassaWebToasts, setCassaWebToasts] = useState([])
  const cassaSessionStartMsRef = useRef(null)
  const seenOrderIdsForToastRef = useRef(new Set())
  /** Dopo ripristino bozza locale (stesso giorno / tenant / PV): abilita salvataggio automatico */
  const [cassaDraftReady, setCassaDraftReady] = useState(false)
  /** Pay-by-link: pannello post-conferma (anche se impostazioni non ancora attive) */
  const [postCheckoutPayLink, setPostCheckoutPayLink] = useState(null)
  const [payLinkPhone, setPayLinkPhone] = useState("")
  const [payLinkBusy, setPayLinkBusy] = useState(false)
  const [payLinkMessage, setPayLinkMessage] = useState("")
  const [foodcostMismatchCount, setFoodcostMismatchCount] = useState(0)
  const [foodcostMismatchPreview, setFoodcostMismatchPreview] = useState([])
  const [foodcostAlertDismissed, setFoodcostAlertDismissed] = useState(false)
  const [foodcostModalOpen, setFoodcostModalOpen] = useState(false)

  /////////////////////////////////////////////////////////
  // RESET ON TENANT CHANGE
  /////////////////////////////////////////////////////////

  useEffect(() => {
    setCategories([])
    setProducts([])
    setActiveCategory(null)
    setCart([])
    setCassaDraftReady(false)
    cassaSessionStartMsRef.current = Date.now()
    seenOrderIdsForToastRef.current = new Set()
    setCassaWebToasts([])
    setTurnoCassa(null)
    setDeliveryDraftByClienteId({})
  }, [tenantId])

  /////////////////////////////////////////////////////////
  // BOZZA ORDINE (stesso giorno locale, finché non confermi)
  /////////////////////////////////////////////////////////

  useEffect(() => {
    if (!tenantId || pvLoading) return
    const pvKey = activePvId ?? "nopv"
    const draft = loadCassaDraft(tenantId, pvKey)
    if (draft) {
      setCart(Array.isArray(draft.cart) ? draft.cart : [])
      if (draft.tipoOrdine) setTipoOrdine(draft.tipoOrdine)
      if (typeof draft.deliverySearch === "string") setDeliverySearch(draft.deliverySearch)
      if (draft.selectedCliente !== undefined) setSelectedCliente(draft.selectedCliente)
      if (typeof draft.checkoutNote === "string") setCheckoutNote(draft.checkoutNote)
      if (draft.checkoutTipoPagamento) setCheckoutTipoPagamento(draft.checkoutTipoPagamento)
      if (Array.isArray(draft.mistoRighe)) setMistoRighe(draft.mistoRighe)
      if (typeof draft.checkoutScontoGlobale === "string") setCheckoutScontoGlobale(draft.checkoutScontoGlobale)
      if (typeof draft.checkoutNomeCliente === "string") setCheckoutNomeCliente(draft.checkoutNomeCliente)
      if (typeof draft.checkoutTelefonoCliente === "string") setCheckoutTelefonoCliente(draft.checkoutTelefonoCliente)
      if (draft.checkoutSelectedSlot) setCheckoutSelectedSlot(draft.checkoutSelectedSlot)
      if (typeof draft.showRiepilogo === "boolean") setShowRiepilogo(draft.showRiepilogo)
      if (typeof draft.fidelityQuery === "string") setFidelityQuery(draft.fidelityQuery)
      if (draft.selectedFidelitySaldo !== undefined) setSelectedFidelitySaldo(draft.selectedFidelitySaldo)
      if (typeof draft.fidelityPremioActive === "boolean") setFidelityPremioActive(draft.fidelityPremioActive)
      if (typeof draft.searchPizza === "string") setSearchPizza(draft.searchPizza)
    } else {
      setCart([])
    }
    setCassaDraftReady(true)
  }, [tenantId, activePvId, pvLoading])

  useEffect(() => {
    if (!tenantId) return
    let cancelled = false
    const runCheck = async () => {
      try {
        const report = await getFoodcostPriceMismatchReport(tenantId)
        if (cancelled) return
        const mismatches = Array.isArray(report?.mismatches) ? report.mismatches : []
        const count = mismatches.length
        setFoodcostMismatchCount(count)
        setFoodcostMismatchPreview(
          mismatches.slice(0, 8).map((row) => ({
            nome: row?.nome || "Prodotto",
            prezzoListino: Number(row?.prezzoListino || 0),
            prezzoCalcolato: Number(row?.prezzoCalcolato || 0),
            delta: Number(row?.delta || 0),
          })),
        )
        if (count > 0) {
          setFoodcostAlertDismissed(false)
          setFoodcostModalOpen(true)
        }
      } catch {
        if (!cancelled) {
          setFoodcostMismatchCount(0)
          setFoodcostMismatchPreview([])
        }
      }
    }
    void runCheck()
    const t = setInterval(() => void runCheck(), 30000)
    return () => {
      cancelled = true
      clearInterval(t)
    }
  }, [tenantId])

  useEffect(() => {
    if (!cassaDraftReady || !tenantId || pvLoading) return
    const pvKey = activePvId ?? "nopv"
    const id = window.setTimeout(() => {
      saveCassaDraft(tenantId, pvKey, {
        cart,
        tipoOrdine,
        deliverySearch,
        selectedCliente,
        checkoutNote,
        checkoutTipoPagamento,
        mistoRighe,
        checkoutScontoGlobale,
        checkoutNomeCliente,
        checkoutTelefonoCliente,
        checkoutSelectedSlot,
        showRiepilogo,
        fidelityQuery,
        selectedFidelitySaldo,
        fidelityPremioActive,
        searchPizza,
      })
    }, 450)
    return () => window.clearTimeout(id)
  }, [
    cassaDraftReady,
    tenantId,
    activePvId,
    pvLoading,
    cart,
    tipoOrdine,
    deliverySearch,
    selectedCliente,
    checkoutNote,
    checkoutTipoPagamento,
    mistoRighe,
    checkoutScontoGlobale,
    checkoutNomeCliente,
    checkoutTelefonoCliente,
    checkoutSelectedSlot,
    showRiepilogo,
    fidelityQuery,
    selectedFidelitySaldo,
    fidelityPremioActive,
    searchPizza,
  ])

  const loadTurnoCassa = useCallback(async () => {
    if (!tenantId || !user?.id) return
    setTurnoCassaLoading(true)
    try {
      const row = await turniCassaAperto(tenantId)
      setTurnoCassa(row)
    } catch (e) {
      console.warn("[Cassa] turno cassa:", e)
      setTurnoCassa(null)
    } finally {
      setTurnoCassaLoading(false)
    }
  }, [tenantId, user?.id])

  useEffect(() => {
    void loadTurnoCassa()
  }, [loadTurnoCassa])

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible") void loadTurnoCassa()
    }
    document.addEventListener("visibilitychange", onVis)
    return () => document.removeEventListener("visibilitychange", onVis)
  }, [loadTurnoCassa])

  useEffect(() => {
    const po = tenantData?.parametri_operativi
    const off = po && typeof po === "object" && po.ordini_online_attivi === false
    setOrdiniOnlineDisabilitati(!!off)
  }, [tenantId, tenantData?.parametri_operativi])

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

    const data = await getProductsByCategory(tenantId, activeCategory)
    const sorted = sortByOrdine(data || [])
    const ids = (sorted || []).map((p) => p.id).filter(Boolean)
    const po = tenantData?.parametri_operativi
    try {
      const [withPrezzoRaw, detailBatch] = await Promise.all([
        enrichProductsWithPrezzoCalcolato(tenantId, sorted),
        ids.length ? getProductIngredientiBatch(tenantId, ids) : Promise.resolve({}),
      ])
      const withPrezzo = applyPromoCalendarioToProducts(withPrezzoRaw, po, new Date())
      const map = {}
      const idsMap = {}
      for (const pid of ids) {
        const arr = detailBatch?.[pid] || []
        map[pid] = arr.map((ing) => ing?.nome || "").filter(Boolean)
        idsMap[pid] = arr.map((ing) => ing?.id).filter(Boolean)
      }
      setProducts(withPrezzo)
      setProductIngredientiMap(map)
      setProductIngredientIdsMap(idsMap)
    } catch (e) {
      console.warn("Caricamento prodotti / ingredienti cassa:", e)
      try {
        const fallbackRaw = await enrichProductsWithPrezzoCalcolato(tenantId, sorted)
        setProducts(applyPromoCalendarioToProducts(fallbackRaw, po, new Date()))
      } catch {
        setProducts(sorted)
      }
      setProductIngredientiMap({})
      setProductIngredientIdsMap({})
    }
  }, [tenantId, activeCategory, tenantData?.parametri_operativi])

  useEffect(() => {
    loadProducts()
  }, [loadProducts])

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

  const {
    modificaOrdineModal,
    modificaForm,
    setModificaForm,
    modificaOrdineSaving,
    modificaRighe,
    setModificaRighe,
    modificaProdottiList,
    modificaTotaleAnteprima,
    openModificaOrdine,
    closeModificaOrdine,
    handleSalvaModificaOrdine,
  } = useCassaModificaOrdine({
    tenantId,
    tenantData,
    ordineDetail,
    setOrdineDetail,
    loadOrdini,
  })

  useOperativeOrdersLiveRefresh({
    tenantId,
    onRefresh: loadOrdini,
    pollMs: 40000,
  })

  useEffect(() => {
    if (!tenantId || cassaSessionStartMsRef.current == null) return
    const start = cassaSessionStartMsRef.current
    for (const o of ordiniOggi || []) {
      const id = o?.id
      if (!id || seenOrderIdsForToastRef.current.has(id)) continue
      seenOrderIdsForToastRef.current.add(id)
      const raw = o.createdAt ?? o.created_at ?? o.updatedAt ?? o.updated_at
      const ts = raw ? new Date(raw).getTime() : 0
      if (!Number.isFinite(ts) || ts < start) continue
      const note = String(o.note ?? "").toLowerCase()
      const pendingAccept = ordineRichiedeAccettazioneCassa(o)
      if (!note.includes("ordine web") && !pendingAccept) continue
      const toastId = `web-${id}-${ts}`
      const num = o.numero ?? o.numero_ordine ?? o.numeroOrdine ?? "—"
      setCassaWebToasts((prev) => [
        ...prev.slice(-3),
        { toastId, numero: num, ordineId: id, pendingAccept },
      ])
      window.setTimeout(() => {
        setCassaWebToasts((prev) => prev.filter((x) => x.toastId !== toastId))
      }, pendingAccept ? 60000 : 14000)
    }
  }, [tenantId, ordiniOggi])

  /** Categorie + ordini giornata + ingredienti esauriti + permessi: tutto in parallelo (meno attese in cascata). */
  useEffect(() => {
    if (!tenantId) return
    let cancelled = false
    const loadPermesso = async () => {
      if (fullDemoAccess) {
        if (!cancelled) setCanEditParametriCassa(true)
        return
      }
      if (!user?.email) {
        if (!cancelled) setCanEditParametriCassa(false)
        return
      }
      try {
        const list = await getRuoliPizzeria(tenantId)
        if (cancelled) return
        const me = (list || []).find((r) => r.email === user.email)
        setCanEditParametriCassa(resolveCanEditParametri(Boolean(me?.puo_modificare_parametri)))
      } catch (e) {
        console.warn("Errore caricamento permessi ruoli:", e)
        if (!cancelled) setCanEditParametriCassa(false)
      }
    }
    void Promise.all([
      loadCategories(),
      loadOrdini(),
      getIngredients(tenantId)
        .then((list) => {
          if (cancelled) return
          const esauriti = (list || []).filter((i) => i.attivo === false).map((i) => i.id)
          setIngredientiEsauritiIds(esauriti)
        })
        .catch(() => {
          if (!cancelled) setIngredientiEsauritiIds([])
        }),
      loadPermesso(),
    ])
    return () => {
      cancelled = true
    }
  }, [tenantId, user?.email, loadCategories, loadOrdini, fullDemoAccess, resolveCanEditParametri])

  useEffect(() => {
    if (!tenantId) {
      setPizzePerOrdine({})
      return
    }
    const ids = (ordiniOggi || [])
      .filter((o) => orderCreatedLocalDateKey(o) === todayStr)
      .filter((o) => !ordineIsAnnullato(o))
      .map((o) => o.id)
      .filter(Boolean)
    if (!ids.length) {
      setPizzePerOrdine({})
      return
    }
    getRigheAggregateByOrdineIds(ids).then(setPizzePerOrdine).catch(() => setPizzePerOrdine({}))
  }, [tenantId, ordiniOggi, todayStr])

  const openOrdineDetail = useCallback(async (ordineId) => {
    if (!tenantId || !ordineId) return
    setOrdineDetailLoading(true)
    setOrdineDetail(null)
    try {
      const detail = await getOrderDetail(ordineId)
      const ids = (detail.righe || []).map((r) => r.prodottoId ?? r.prodotto_id).filter(Boolean)
      const prodotti = ids.length ? await getProdottiByIds(tenantId, ids) : []
      const productNames = (prodotti || []).reduce((acc, p) => ({ ...acc, [p.id]: p.nome || "—" }), {})
      const enriched = await enrichOrdineDetailIngredientiSummaries(tenantId, { ...detail, productNames })
      setOrdineDetail(enriched)
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
      const data = await getOrders(tenantId, { limit: 400 })
      const matches = ordiniFiltratiPerClienteAnagrafica(data, selectedCliente)
      if (!matches.length) {
        setLastOrderModalDetail({ empty: true })
        return
      }
      setLastOrderModalDetail({ mode: "list", ordini: matches })
    } catch (e) {
      console.error(e)
      setLastOrderModalDetail({ error: e?.message || "Errore caricamento" })
    } finally {
      setLastOrderLoading(false)
    }
  }, [tenantId, selectedCliente])

  const loadClienteOrdineDetail = useCallback(
    async (ordineId) => {
      if (!tenantId || !ordineId) return
      setLastOrderDetailLoading(true)
      try {
        const detail = await getOrderDetail(ordineId)
        const ids = (detail.righe || []).map((r) => r.prodottoId ?? r.prodotto_id).filter(Boolean)
        const prodotti = ids.length ? await getProdottiByIds(tenantId, ids) : []
        const productNames = (prodotti || []).reduce((acc, p) => ({ ...acc, [p.id]: p.nome || "—" }), {})
        const productsById = (prodotti || []).reduce((acc, p) => ({ ...acc, [p.id]: p }), {})
        const base = { ...detail, productNames, productsById }
        const enriched = await enrichOrdineDetailIngredientiSummaries(tenantId, base)
        setLastOrderModalDetail((prev) => {
          const historyOrdini = prev?.mode === "list" ? prev.ordini : prev?.historyOrdini || []
          return { mode: "detail", historyOrdini, ...enriched, productsById }
        })
      } catch (e) {
        console.error(e)
        alert("Errore caricamento ordine. " + (e?.message || ""))
      } finally {
        setLastOrderDetailLoading(false)
      }
    },
    [tenantId],
  )

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

  const ordiniOggiFiltered = useMemo(() => {
    return (ordiniOggi || []).filter((o) => orderCreatedLocalDateKey(o) === todayStr)
  }, [ordiniOggi, todayStr])

  /** Esclusi annullati: planning, slot, chiusura giornata, totali incasso. */
  const ordiniOggiAttivi = useMemo(
    () => (ordiniOggiFiltered || []).filter((o) => !ordineIsAnnullato(o)),
    [ordiniOggiFiltered],
  )

  const [deliveryAlertTick, setDeliveryAlertTick] = useState(0)
  useEffect(() => {
    const id = window.setInterval(() => setDeliveryAlertTick((t) => t + 1), 30000)
    return () => window.clearInterval(id)
  }, [])

  const deliveryAttenzioneInfo = useMemo(() => {
    void deliveryAlertTick
    const po = tenantData?.parametri_operativi || {}
    const partenza = readPizzaioloLeadTimeConsegnaMin(po)
    const list = (ordiniOggiAttivi || []).filter((o) => ordineDeliveryRichiedeAttenzione(o, po, partenza))
    return {
      count: list.length,
      numeri: list.map((o) => o.numero ?? o.numero_ordine ?? o.numeroOrdine ?? "?").slice(0, 12),
    }
  }, [ordiniOggiAttivi, tenantData?.parametri_operativi, deliveryAlertTick])

  const buildPayloadContabilita = useCallback(() => {
    const totaleGiornata = (ordiniOggiAttivi || []).reduce((s, o) => s + Number(o.totale || 0), 0)
    return {
      data: todayStr,
      tenantId,
      ordini: (ordiniOggiAttivi || []).map((o) => ({
        id: o.id,
        numero: o.numero,
        totale: o.totale,
        tipo_pagamento: o.tipo_pagamento,
        tipo_ordine: ordineTipoOrdine(o) || null,
        nome_cliente: ordineNomeCliente(o) || null,
        indirizzo_consegna: ordineIndirizzoConsegna(o) || null,
        orario_ritiro: ordineOrarioRitiro(o) || null,
        pizze: pizzePerOrdine[o.id] ?? 0,
        createdAt: o.createdAt ?? o.created_at,
      })),
      totale_giornata: totaleGiornata,
      numero_ordini: (ordiniOggiAttivi || []).length,
    }
  }, [todayStr, tenantId, ordiniOggiAttivi, pizzePerOrdine])

  const handleChiudiGiornataConfirmed = useCallback(async () => {
    if (!tenantId) return
    setChiudiGiornataConfirmOpen(false)
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

  const buildPayloadContabilitaRef = useRef(buildPayloadContabilita)
  buildPayloadContabilitaRef.current = buildPayloadContabilita

  useEffect(() => {
    if (!tenantId) return
    const po = tenantData?.parametri_operativi || {}
    if (po.chiusura_giornata_automatica === false) return
    const when = computeAutoChiusuraGiornataDate(tenantData?.orari_settimana)
    if (!when) return
    const storageKey = `pm_auto_chiusura_done_${tenantId}_${todayStr}`
    const tick = async () => {
      if (typeof localStorage === "undefined") return
      if (localStorage.getItem(storageKey)) return
      if (Date.now() < when.getTime()) return
      try {
        await chiudiGiornata(tenantId, todayStr, buildPayloadContabilitaRef.current())
        localStorage.setItem(storageKey, "1")
        loadOrdini()
        setShowPlanningBar(false)
      } catch (e) {
        console.warn("Chiusura giornata automatica", e)
      }
    }
    void tick()
    const id = setInterval(() => void tick(), 60 * 1000)
    return () => clearInterval(id)
  }, [tenantId, tenantData?.orari_settimana, tenantData?.parametri_operativi, todayStr, loadOrdini])

  const handleAnnullaOrdine = useCallback(
    async (ordineId) => {
      if (!ordineId) return
      if (normalizeRuoloOperativo(ruolo) !== "cassa") {
        alert("Solo gli utenti con ruolo Cassa possono annullare un ordine.")
        return
      }
      if (
        !window.confirm(
          "Annullare questo ordine? Non comparirà più nel planning né nei totali giornata; resterà in elenco come annullato.",
        )
      ) {
        return
      }
      try {
        await updateOrderStato(ordineId, "ANNULLATO")
        setSegnaPagatoModal(null)
        closeModificaOrdine()
        setOrdineDetail((prev) => (prev?.id === ordineId ? { ...prev, stato: "ANNULLATO" } : prev))
        loadOrdini()
      } catch (e) {
        console.error(e)
        alert("Errore annullamento ordine. " + (e?.message || ""))
      }
    },
    [loadOrdini, ruolo, closeModificaOrdine],
  )

  const [accettazioneWebBusy, setAccettazioneWebBusy] = useState(false)

  const ordiniWebInAttesaAccettazione = useMemo(
    () => (ordiniOggiAttivi || []).filter((o) => ordineRichiedeAccettazioneCassa(o)),
    [ordiniOggiAttivi],
  )

  const handleAccettaOrdineWeb = useCallback(
    async (ordineId) => {
      if (!ordineId) return
      setAccettazioneWebBusy(true)
      try {
        await staffAccettaOrdineWeb(ordineId)
        setCassaWebToasts((prev) => prev.filter((x) => x.ordineId !== ordineId))
        await openOrdineDetail(ordineId)
        loadOrdini()
      } catch (e) {
        console.error(e)
        alert("Errore accettazione ordine. " + (e?.message || ""))
      } finally {
        setAccettazioneWebBusy(false)
      }
    },
    [loadOrdini, openOrdineDetail],
  )

  const handleRifiutaOrdineWeb = useCallback(
    async (ordineId) => {
      if (!ordineId) return
      const motivo = window.prompt("Motivo del rifiuto (opzionale):", "")
      if (motivo === null) return
      if (!window.confirm("Rifiutare questo ordine web? Verrà annullato e il cliente non lo riceverà in cucina.")) {
        return
      }
      setAccettazioneWebBusy(true)
      try {
        await staffRifiutaOrdineWeb(ordineId, motivo.trim() || null)
        setCassaWebToasts((prev) => prev.filter((x) => x.ordineId !== ordineId))
        setOrdineDetail((prev) =>
          prev?.id === ordineId
            ? { ...prev, stato: "ANNULLATO", richiede_accettazione_cassa: false }
            : prev,
        )
        loadOrdini()
      } catch (e) {
        console.error(e)
        alert("Errore rifiuto ordine. " + (e?.message || ""))
      } finally {
        setAccettazioneWebBusy(false)
      }
    },
    [loadOrdini],
  )

  // Ricerca clienti delivery (solo se c'è testo cercato e nessun cliente già selezionato con stesso testo)
  const displayCliente = (c) =>
    c
      ? [c.nome, c.indirizzo ? formatIndirizzoDisplayItaliano(c.indirizzo) : ""].filter(Boolean).join(" – ")
      : ""

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

  useEffect(() => {
    if (!showRiepilogo || !tenantId || !fidelityServizioOk || tipoOrdine !== TIPO_ORDINE.NEGOZIO) {
      return
    }
    if (selectedFidelitySaldo) {
      setFidelityHits([])
      setFidelityLoading(false)
      setFidelitySearchDone(false)
      return
    }
    const q = fidelityQuery.trim()
    if (q.length < 2) {
      setFidelityHits([])
      setFidelitySearchDone(false)
      setFidelityLoading(false)
      return
    }
    let cancelled = false
    setFidelityLoading(true)
    setFidelitySearchDone(false)
    const t = setTimeout(async () => {
      try {
        const hits = await searchFidelityCassa(tenantId, q)
        if (!cancelled) setFidelityHits(hits)
      } catch (err) {
        console.error(err)
        if (!cancelled) setFidelityHits([])
      } finally {
        if (!cancelled) {
          setFidelityLoading(false)
          setFidelitySearchDone(true)
        }
      }
    }, 350)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [fidelityQuery, showRiepilogo, tenantId, tipoOrdine, fidelityServizioOk, selectedFidelitySaldo])

  useEffect(() => {
    if (!showRiepilogo || !tenantId) return
    let cancelled = false
    ;(async () => {
      try {
        const prods = await getProducts(tenantId)
        const hit = (prods || []).find((x) => String(x?.nome || "").toLowerCase().includes("margherita"))
        const prezzo = hit != null ? Number(hit.prezzo) : 0
        if (!cancelled) setMargheritaPremioPrezzo(Number.isFinite(prezzo) && prezzo > 0 ? prezzo : 0)
      } catch {
        if (!cancelled) setMargheritaPremioPrezzo(0)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [showRiepilogo, tenantId])

  const handleSelectCliente = useCallback((c) => {
    const savedDraft = c?.id ? deliveryDraftByClienteId[c.id] : null
    setSelectedCliente(c)
    setDeliverySearch(displayCliente(c))
    setDeliverySearchResults([])
    setClienteDomicilioQuickOpen(true)
    if (savedDraft) {
      setCart(Array.isArray(savedDraft.cart) ? savedDraft.cart : [])
      setCheckoutNote(savedDraft.checkoutNote || "")
      setCheckoutNomeCliente(savedDraft.checkoutNomeCliente || "")
      setCheckoutTelefonoCliente(savedDraft.checkoutTelefonoCliente || "")
      setCheckoutSelectedSlot(savedDraft.checkoutSelectedSlot || null)
    }
    // Se profilo collegabile (indirizzo + email/tel), apri storico: evidenzia ordini non conclusi.
    if (tenantId && c && (c.indirizzo || "").trim() && ((c.telefono || "").trim() || (c.email || "").trim())) {
      void (async () => {
        try {
          const data = await getOrders(tenantId, { limit: 400 })
          const matches = ordiniFiltratiPerClienteAnagrafica(data, c)
          const incompleti = matches.filter((o) => ordineStatoIncompleto(o))
          if (incompleti.length > 0) {
            setLastOrderModalDetail({
              mode: "list",
              ordini: matches,
              highlightIncompleti: true,
            })
          }
        } catch {
          /* ignore */
        }
      })()
    }
  }, [deliveryDraftByClienteId, tenantId])

  const handleSwitchConsegnaToNegozio = useCallback(async () => {
    const curr = selectedCliente
    if (!curr) return
    const nome = String(curr.nome || "").trim()
    const telefono = String(curr.telefono || "").trim()
    setDeliveryDraftByClienteId((prev) => ({
      ...prev,
      [curr.id]: {
        cart: Array.isArray(cart) ? cart : [],
        checkoutNote,
        checkoutNomeCliente: checkoutNomeCliente || nome,
        checkoutTelefonoCliente: checkoutTelefonoCliente || telefono,
        checkoutSelectedSlot,
      },
    }))
    setTipoOrdine(TIPO_ORDINE.NEGOZIO)
    setCheckoutNomeCliente((v) => v || nome)
    setCheckoutTelefonoCliente((v) => v || telefono)
    setSelectedCliente(null)
    setDeliverySearch("")
    setDeliverySearchResults([])
    setClienteDomicilioQuickOpen(false)
  }, [selectedCliente, cart, checkoutNote, checkoutNomeCliente, checkoutTelefonoCliente, checkoutSelectedSlot])
  const handleNuovoClienteSuccess = (cliente) => {
    setSelectedCliente(cliente)
    setDeliverySearch(displayCliente(cliente))
    setNuovoClienteModalOpen(false)
    if (tipoOrdine === TIPO_ORDINE.DELIVERY) setClienteDomicilioQuickOpen(true)
  }
  const handleProfiloClienteSuccess = (cliente) => {
    setSelectedCliente(cliente)
    setDeliverySearch(displayCliente(cliente))
    setProfiloClienteModalOpen(false)
  }

  const handleSelectFidelitySaldo = useCallback((row) => {
    setFidelityPremioActive(false)
    if (!row) {
      setSelectedFidelitySaldo(null)
      return
    }
    setSelectedFidelitySaldo(row)
    const ac = row.anagrafica_clienti
    const a = Array.isArray(ac) ? ac[0] : ac
    if (a?.nome?.trim()) setCheckoutNomeCliente(a.nome.trim())
  }, [])

  const handleNuovoFidelityClienteSuccess = useCallback(async (cliente) => {
    setNuovoFidelityClienteModalOpen(false)
    if (!tenantId || !cliente?.id) return
    try {
      const row = await enrollFidelityCliente(tenantId, cliente.id)
      const merged = {
        id: row.id,
        anagrafica_cliente_id: row.anagrafica_cliente_id,
        punti: row.punti,
        codice_carta: row.codice_carta,
        nome_negozio: null,
        anagrafica_clienti: {
          nome: cliente.nome,
          telefono: cliente.telefono,
          email: cliente.email,
          indirizzo: cliente.indirizzo,
        },
      }
      setSelectedFidelitySaldo(merged)
      setFidelityHits([])
      setFidelityQuery("")
      setFidelitySearchDone(false)
      if (cliente.nome?.trim()) setCheckoutNomeCliente(cliente.nome.trim())
    } catch (err) {
      console.error(err)
      setCheckoutError(err?.message ?? "Iscrizione al programma fedeltà non riuscita.")
    }
  }, [tenantId])

  const openRiepilogo = useCallback(() => {
    setFidelityQuery("")
    setFidelityHits([])
    setSelectedFidelitySaldo(null)
    setFidelitySearchDone(false)
    setFidelityPremioActive(false)
    setShowRiepilogo(true)
  }, [])

  const cassaHeaderApi = useCassaHeader()
  const setCassaHeader = cassaHeaderApi?.setContent
  const setCassaSidebar = cassaHeaderApi?.setSidebar

  useLayoutEffect(() => {
    if (!setCassaSidebar) return
    if (!canEditParametriCassa) {
      setCassaSidebar(null)
      return () => setCassaSidebar(null)
    }
    const demoCards = inDemoLive
    setCassaSidebar(
      <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%" }}>
        <button
          type="button"
          className={demoCards ? "operative-sa-demo-shortcut" : undefined}
          style={
            demoCards
              ? undefined
              : {
                  ...styles.impostazioniBtn,
                  width: "100%",
                  boxSizing: "border-box",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }
          }
          onClick={() => setShowImpostazioniCassa(true)}
        >
          {demoCards ? (
            <>
              <span className="operative-sa-demo-shortcut-label">Impostazioni cassa</span>
              <span className="operative-sa-demo-shortcut-desc">Parametri, stampanti e preferenze sala</span>
            </>
          ) : (
            "Impostazioni cassa"
          )}
        </button>
        <button
          type="button"
          className={demoCards ? "operative-sa-demo-shortcut" : undefined}
          style={
            demoCards
              ? undefined
              : {
                  ...styles.impostazioniBtn,
                  width: "100%",
                  boxSizing: "border-box",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "#37474f",
                  color: "#fff",
                }
          }
          onClick={() => navigate("/operative/cassa/stampanti-reparti")}
        >
          {demoCards ? (
            <>
              <span className="operative-sa-demo-shortcut-label">Stampanti reparto</span>
              <span className="operative-sa-demo-shortcut-desc">USB / IP per comande di cucina</span>
            </>
          ) : (
            "Stampanti reparto"
          )}
        </button>
      </div>,
    )
    return () => setCassaSidebar(null)
  }, [setCassaSidebar, canEditParametriCassa, navigate, inDemoLive])

  useLayoutEffect(() => {
    if (!setCassaHeader) return
    const tm = cassaMobileLayout
    const toolbar = (
      <div
        style={{
          display: "flex",
          alignItems: tm ? "stretch" : "center",
          gap: 8,
          flexWrap: "wrap",
          minWidth: 0,
          width: tm ? "100%" : undefined,
          flexDirection: tm ? "column" : "row",
        }}
      >
        {tipoOrdine === TIPO_ORDINE.DELIVERY && (
          <div style={{ flex: "1 1 auto", minWidth: 0, maxWidth: tm ? "none" : 240, width: tm ? "100%" : undefined }}>
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
                  maxWidth: tm ? "none" : 200,
                  padding: tm ? "12px 14px" : "8px 12px",
                  borderRadius: 6,
                  border: "1px solid #ddd",
                  cursor: selectedCliente ? "pointer" : "text",
                  background: selectedCliente ? "#f9f9f9" : "#fff",
                  fontSize: tm ? 16 : 13,
                  minHeight: tm ? 48 : undefined,
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
                      {c.indirizzo && (
                        <span style={{ color: "#555" }}> – {formatIndirizzoDisplayItaliano(c.indirizzo)}</span>
                      )}
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
            onClick={() => {
              if (selectedCliente?.id) {
                const nome = String(selectedCliente.nome || "").trim()
                const telefono = String(selectedCliente.telefono || "").trim()
                setDeliveryDraftByClienteId((prev) => ({
                  ...prev,
                  [selectedCliente.id]: {
                    cart: Array.isArray(cart) ? cart : [],
                    checkoutNote,
                    checkoutNomeCliente: checkoutNomeCliente || nome,
                    checkoutTelefonoCliente: checkoutTelefonoCliente || telefono,
                    checkoutSelectedSlot,
                  },
                }))
              }
              setSelectedCliente(null)
              setDeliverySearch("")
              setDeliverySearchResults([])
              setClienteDomicilioQuickOpen(false)
              setCart([])
              setCheckoutNote("")
              setCheckoutSelectedSlot(null)
              setCheckoutError(null)
            }}
            style={{ padding: "8px 10px", background: "#666", color: "#fff", border: "none", borderRadius: 6, fontSize: 14, cursor: "pointer", flexShrink: 0 }}
            title="Chiudi cliente: salva bozza ordine (carrello e dati) e la ripristini quando riselezioni il cliente"
          >
            ✕
          </button>
        )}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            flexShrink: 0,
            flexWrap: "wrap",
            width: tm ? "100%" : undefined,
          }}
        >
          {tipoOrdine === TIPO_ORDINE.DELIVERY && selectedCliente ? (
            <>
              <button
                type="button"
                onClick={openUltimoOrdineCliente}
                disabled={lastOrderLoading}
                style={{
                  padding: tm ? "12px 14px" : "8px 14px",
                  background: "#1976d2",
                  color: "#fff",
                  border: "none",
                  borderRadius: 8,
                  fontSize: tm ? 15 : 13,
                  fontWeight: 600,
                  minHeight: tm ? 48 : undefined,
                  flex: tm ? "1 1 auto" : undefined,
                }}
                title="Storico ordini di questo cliente (ultimi 400 ordini)"
              >
                {lastOrderLoading ? "..." : "Storico ordini"}
              </button>
              <button
                type="button"
                onClick={() => setNoteModalOpen(true)}
                style={{
                  padding: tm ? "12px 14px" : "8px 14px",
                  background: "#5c6bc0",
                  color: "#fff",
                  border: "none",
                  borderRadius: 8,
                  fontSize: tm ? 15 : 13,
                  minHeight: tm ? 48 : undefined,
                  flex: tm ? "1 1 auto" : undefined,
                }}
                title="Note ordine (solo negozio)"
              >
                Note
              </button>
              <button
                type="button"
                onClick={() => void handleSwitchConsegnaToNegozio()}
                style={{
                  padding: tm ? "12px 14px" : "8px 14px",
                  background: "#455a64",
                  color: "#fff",
                  border: "none",
                  borderRadius: 8,
                  fontSize: tm ? 15 : 13,
                  minHeight: tm ? 48 : undefined,
                  flex: tm ? "1 1 auto" : undefined,
                }}
                title="Sposta questo ordine da consegna a ritiro in negozio"
              >
                In negozio
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                style={{
                  ...styles.tipoOrdineBtn,
                  ...(tipoOrdine === TIPO_ORDINE.NEGOZIO ? styles.tipoOrdineBtnActive : {}),
                  ...(tm ? { flex: "1 1 auto", minHeight: 48, fontSize: 15 } : {}),
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
                  ...(tm ? { flex: "1 1 auto", minHeight: 48, fontSize: 15 } : {}),
                }}
                onClick={() => setTipoOrdine(TIPO_ORDINE.DELIVERY)}
              >
                Delivery
              </button>
            </>
          )}
          <button
            type="button"
            style={{
              ...styles.nuovoClienteBtn,
              ...(tm ? { width: "100%", minHeight: 48, fontSize: 15, display: "flex", alignItems: "center", justifyContent: "center" } : {}),
            }}
            onClick={() => setNuovoClienteModalOpen(true)}
          >
            Nuovo cliente
          </button>
          {!cassaOrdineInCorso ? (
            <>
              <button
                type="button"
                onClick={() => setShowPaginaOrdini(true)}
                style={{
                  ...cassaToolbarCompactBtn,
                  background: "#5d4037",
                  color: "#fff",
                  fontWeight: 600,
                  ...(tm ? { flex: "1 1 auto", minHeight: 48, fontSize: 15 } : {}),
                }}
                title="Vedi e cerca tutti gli ordini"
              >
                Ordini
              </button>
              <button
                type="button"
                onClick={() => navigate("/operative/cassa/fidelity")}
                style={{
                  ...cassaToolbarCompactBtn,
                  background: fidelityServizioOk ? "#7b1fa2" : "#9e9e9e",
                  color: "#fff",
                  fontWeight: 600,
                  ...(tm ? { flex: "1 1 auto", minHeight: 48, fontSize: 15 } : {}),
                }}
                title={
                  fidelityServizioOk
                    ? "Fidelity Card — punti e tessere clienti"
                    : "Fidelity: servizio non attivo sul piano (vedi messaggio aprendo)"
                }
              >
                Fidelity
              </button>
            </>
          ) : null}
          <button
            type="button"
            onClick={() => setShowPlanningBar((v) => !v)}
            style={{
              ...cassaToolbarCompactBtn,
              background: "#2e7d32",
              color: "#fff",
              fontWeight: 600,
              ...(tm ? { flex: "1 1 100%", minHeight: 48, fontSize: 15 } : {}),
            }}
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
    fidelityServizioOk,
    navigate,
    handleSelectCliente,
    openUltimoOrdineCliente,
    cassaOrdineInCorso,
    cart.length,
    cassaMobileLayout,
    handleSwitchConsegnaToNegozio,
    cart,
    checkoutNote,
    checkoutNomeCliente,
    checkoutTelefonoCliente,
    checkoutSelectedSlot,
  ])

  /////////////////////////////////////////////////////////
  // CART LOGIC
  /////////////////////////////////////////////////////////

  const addToCartWithIngredienti = useCallback((product, modsPayload = null, modificaCassaDisponibile = true) => {
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
          modificaCassaDisponibile: modificaCassaDisponibile !== false,
          ingredientiCotturaSummary: summary,
          ingredientiModificheClienteSummary: modsPayload?.ingredientiModificheClienteSummary || "",
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

  const addHistoryLineToCart = useCallback(
    (riga, detail) => {
      const pid = riga.prodottoId ?? riga.prodotto_id
      const product = detail?.productsById?.[pid] || null
      const mapped = orderLineToCassaCartPayload(riga, {
        productNames: detail?.productNames,
        product,
      })
      if (!mapped) {
        alert("Prodotto non disponibile per il carrello.")
        return
      }
      const qty = mapped.qty
      for (let i = 0; i < qty; i += 1) {
        addToCartWithIngredienti(mapped.product, mapped.modsPayload, true)
      }
    },
    [addToCartWithIngredienti],
  )

  const recallHistoryOrderToCart = useCallback(
    (detail) => {
      if (!detail?.righe?.length) return
      setCart([])
      for (const r of detail.righe) {
        addHistoryLineToCart(r, detail)
      }
      const nome = ordineNomeCliente(detail)
      const tel = ordineTelefonoRitiro(detail)
      if (nome) setCheckoutNomeCliente(nome)
      if (tel) setCheckoutTelefonoCliente(tel)
      setLastOrderModalDetail(null)
      setCassaMobileTab("carrello")
    },
    [addHistoryLineToCart],
  )

  const addToCart = useCallback(
    (product) => {
      if (!tenantId) return
      const catNome = (categories.find((c) => c.id === activeCategory)?.nome || "").toLowerCase()
      const modificaCassaDisponibile = !["fritti", "dolci", "bibite"].includes(catNome)

      const applyIngList = (ingList) => {
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
            ingredientiCotturaSummary: buildComandaIngredientiSummary(
              ingList,
              defaultModifiche,
              [],
            ),
          }
          addToCartWithIngredienti(product, defaultPayload, modificaCassaDisponibile)
          return
        }
        addToCartWithIngredienti(product, null, modificaCassaDisponibile)
      }

      // Tap istantaneo: ingredienti già in cache dal load categoria (niente await rete).
      const cached = getCachedProductIngredienti(tenantId, product.id)
      if (cached !== undefined) {
        applyIngList(cached)
        return
      }
      if (Object.prototype.hasOwnProperty.call(productIngredientIdsMap, product.id)) {
        const ids = productIngredientIdsMap[product.id]
        if (!ids?.length) {
          applyIngList([])
          return
        }
      }
      void getProductIngredienti(tenantId, product.id).then(applyIngList)
    },
    [tenantId, addToCartWithIngredienti, categories, activeCategory, productIngredientIdsMap],
  )

  const closePizzaModal = useCallback(() => {
    setProductModalOpen(false)
    setProductToAdd(null)
    setPizzaModalEditCartLine(null)
  }, [])

  const openModificaPizzaFromCart = useCallback((item) => {
    if (item?.modificaCassaDisponibile === false) return
    setPizzaModalEditCartLine(item)
    setProductToAdd({ ...item })
    setProductModalOpen(true)
  }, [])

  const confirmModificaPizza = useCallback(
    (modsPayload) => {
      if (!productToAdd) return
      const isFamiglia = modsPayload.famigliaGusti && modsPayload.productForCart
      const isMezzoMetroMetro = modsPayload.gustiProducts && modsPayload.productForCart
      if (isFamiglia || isMezzoMetroMetro) {
        if (pizzaModalEditCartLine) {
          setCart((prev) => prev.filter((p) => p !== pizzaModalEditCartLine))
        }
        addToCartWithIngredienti(
          modsPayload.productForCart,
          {
            formatoNome: modsPayload.formatoNome,
            prezzoCalcolato: modsPayload.prezzoCalcolato,
            formatoSpecial: modsPayload.formatoSpecial ?? (isFamiglia ? "famiglia" : null),
          },
          pizzaModalEditCartLine?.modificaCassaDisponibile !== false,
        )
        closePizzaModal()
        return
      }
      const summary = modsPayload?.ingredientiCotturaSummary ?? ""
      const nextKey =
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

      if (pizzaModalEditCartLine) {
        const line = pizzaModalEditCartLine
        const updatedOne = {
          ...line,
          qty: 1,
          prezzo: modsPayload?.prezzoCalcolato != null ? modsPayload.prezzoCalcolato : line.prezzo,
          ingredientiCotturaSummary: summary,
          ingredientiModificheClienteSummary: modsPayload?.ingredientiModificheClienteSummary || "",
          ingredientiModifiche: modsPayload?.ingredientiModifiche,
          extraIngredienti: modsPayload?.extraIngredienti,
          impastoId: modsPayload?.impastoId,
          impastoNome: modsPayload?.impastoNome,
          formatoId: modsPayload?.formatoId,
          formatoNome: modsPayload?.formatoNome,
          cotturaId: modsPayload?.cotturaId,
          cotturaNome: modsPayload?.cotturaNome,
          _modsKey: nextKey,
        }

        /** Stessa logica di raggruppamento di addToCartWithIngredienti (id + riepilogo + chiave modifiche). */
        const mergeCartPiece = (cartList, piece) => {
          const summaryP = piece.ingredientiCotturaSummary ?? ""
          const keyP = piece._modsKey ?? ""
          const ex = cartList.find(
            (p) =>
              p.id === piece.id &&
              (p.ingredientiCotturaSummary ?? "") === summaryP &&
              (p._modsKey ?? "") === keyP,
          )
          if (ex) {
            return cartList.map((p) => (p === ex ? { ...p, qty: p.qty + piece.qty } : p))
          }
          return [...cartList, piece]
        }

        setCart((prev) => {
          const without = prev.filter((p) => p !== line)
          let next = without
          if (line.qty > 1) {
            next = mergeCartPiece(next, { ...line, qty: line.qty - 1 })
          }
          next = mergeCartPiece(next, updatedOne)
          return next
        })
        closePizzaModal()
        return
      }
      addToCartWithIngredienti(
        productToAdd,
        modsPayload,
        pizzaModalEditCartLine?.modificaCassaDisponibile !== false,
      )
      closePizzaModal()
    },
    [productToAdd, pizzaModalEditCartLine, addToCartWithIngredienti, closePizzaModal],
  )

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

  const cassaArrotonda5CentFlag = tenantData?.parametri_operativi?.cassa_arrotonda_5_cent === true
  const scontoManualeEuro = useMemo(() => {
    const raw = parseEuroInput(checkoutScontoGlobale)
    return Math.min(Math.max(0, raw), total)
  }, [checkoutScontoGlobale, total])

  const scontoPremioFidelityEuro = useMemo(() => {
    if (!fidelityPremioActive || margheritaPremioPrezzo <= 0) return 0
    const dopoManuale = Math.max(0, total - scontoManualeEuro)
    return Math.min(margheritaPremioPrezzo, dopoManuale)
  }, [fidelityPremioActive, margheritaPremioPrezzo, total, scontoManualeEuro])

  const scontoEuroCheckout = useMemo(
    () => Math.min(scontoManualeEuro + scontoPremioFidelityEuro, total),
    [scontoManualeEuro, scontoPremioFidelityEuro, total],
  )

  const totalBaseAfterSconto = useMemo(
    () => Math.max(0, total - scontoEuroCheckout),
    [total, scontoEuroCheckout]
  )

  const fidelityRedeemInfo = useMemo(
    () =>
      computeFidelityRedeemPuntiCost(tenantData?.parametri_operativi, selectedFidelitySaldo?.punti ?? 0),
    [tenantData?.parametri_operativi, selectedFidelitySaldo?.punti],
  )

  useEffect(() => {
    if (!selectedFidelitySaldo || fidelityRedeemInfo.cost == null || margheritaPremioPrezzo <= 0) {
      setFidelityPremioActive(false)
    }
  }, [selectedFidelitySaldo, fidelityRedeemInfo.cost, margheritaPremioPrezzo])

  const totalCheckout = useMemo(() => {
    if (cassaArrotonda5CentFlag) {
      return roundTotalToFiveCents(totalBaseAfterSconto)
    }
    return totalBaseAfterSconto
  }, [totalBaseAfterSconto, cassaArrotonda5CentFlag])

  useEffect(() => {
    if (checkoutTipoPagamento !== "Misto") {
      setMistoRighe([])
      return
    }
    setMistoRighe((prev) => {
      if (prev.length > 0) return prev
      return [
        { id: newLocalId(), tipo: "Contanti", importo: "" },
        { id: newLocalId(), tipo: "Carta", importo: "" },
      ]
    })
  }, [checkoutTipoPagamento])

  const updateMistoRiga = useCallback((id, patch) => {
    setMistoRighe((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  }, [])
  const addMistoRiga = useCallback(() => {
    setMistoRighe((prev) => {
      if (prev.length >= MAX_MISTO_RIGHE) return prev
      return [...prev, { id: newLocalId(), tipo: "Contanti", importo: "" }]
    })
  }, [])
  const removeMistoRiga = useCallback((id) => {
    setMistoRighe((prev) => (prev.length <= 1 ? prev : prev.filter((r) => r.id !== id)))
  }, [])

  /** Dopo ordine confermato: menu prodotti pronto (tab, overlay, categoria default, scroll). */
  const portaMenuPrincipaleDopoOrdine = useCallback(() => {
    setCassaMobileTab("menu")
    setShowPaginaOrdini(false)
    setShowPlanningBar(false)
    setPlanningSlotModal(null)
    setPlanningSpostaLoading(null)
    setOrdineDetail(null)
    setOrdineDetailLoading(false)
    closeModificaOrdine()
    setSegnaPagatoModal(null)
    setLastOrderModalDetail(null)
    setLastOrderLoading(false)
    setLastOrderDetailLoading(false)
    setSearchPizza("")
    setProductModalOpen(false)
    setProductToAdd(null)
    setPizzaModalEditCartLine(null)
    setClienteDomicilioQuickOpen(false)
    setNoteModalOpen(false)
    setNuovoClienteModalOpen(false)
    setProfiloClienteModalOpen(false)
    setNuovoFidelityClienteModalOpen(false)
    setChiudiGiornataConfirmOpen(false)
    const sorted = categoriesRef.current
    if (sorted?.length) {
      const key = (n) => (n || "").toLowerCase().trim()
      const classiche = sorted.find((c) => key(c.nome) === "classiche")
      const pizzaFirst = sorted.find((c) => ["classiche", "speciali", "bianche", "chiuse"].includes(key(c.nome)))
      setActiveCategory((classiche || pizzaFirst || sorted[0]).id)
    }
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const el = cassaProductsAreaRef.current
        if (el && typeof el.scrollTo === "function") {
          el.scrollTo({ top: 0, left: 0, behavior: "auto" })
        } else if (el) {
          el.scrollTop = 0
        }
        window.scrollTo(0, 0)
      })
    })
  }, [closeModificaOrdine])

  /////////////////////////////////////////////////////////
  // CHECKOUT
  /////////////////////////////////////////////////////////

  const handleCheckout = async () => {
    if (!cart.length || !tenantId || loading) return
    setCheckoutError(null)
    setPendingComandaPrint(null)
    setPendingRicevutaPrint(null)
    const poGate = tenantData?.parametri_operativi || {}
    if (poGate.cassa_turno_obbligatorio === true) {
      if (turnoCassaLoading) {
        setCheckoutError("Verifica turno cassa in corso… riprova tra un attimo.")
        return
      }
      if (!turnoOkForCassa(poGate, turnoCassa, activePvId)) {
        setCheckoutError(
          "È obbligatorio un turno cassa aperto per questo punto vendita. Vai in Operative → Turni oppure seleziona il PV corretto.",
        )
        return
      }
    }
    const snapshotCart = cart.map((row) => ({ ...row }))
    const noteSnap = checkoutNote.trim()
    const fidelitySaldoSnap = selectedFidelitySaldo
    let telemetryCtx = null
    let pendingOfflinePayload = null
    try {
      setLoading(true)
      telemetryCtx = markCheckoutStart()
      const mistoSnapshot =
        checkoutTipoPagamento === "Misto" ? mistoRighe.map((r) => ({ ...r })) : []
      let pagamentoDettaglio = null
      let tipoPagamentoFinale = checkoutTipoPagamento || ""
      if (checkoutTipoPagamento === "Misto") {
        const sum = sumMistoRighe(mistoRighe)
        if (Math.abs(sum - totalCheckout) > 0.02) {
          setCheckoutError(
            "Pagamento misto: la somma delle righe deve coincidere con il totale da incassare.",
          )
          setLoading(false)
          markCheckoutEnd(telemetryCtx, {
            ok: false,
            tenantId,
            errorMessage: "misto_sum_mismatch",
          })
          return
        }
        const rows = (mistoRighe || []).filter((r) => parseEuroInput(r.importo) > 0.001)
        if (rows.length === 0) {
          setCheckoutError("Pagamento misto: indica almeno un importo.")
          setLoading(false)
          markCheckoutEnd(telemetryCtx, {
            ok: false,
            tenantId,
            errorMessage: "misto_empty",
          })
          return
        }
        pagamentoDettaglio = rows.map((r) => ({
          tipo: String(r.tipo || "Contanti").trim() || "Contanti",
          importo: Math.round(parseEuroInput(r.importo) * 100) / 100,
        }))
        tipoPagamentoFinale = "Misto"
      }

      const redeemSnap = computeFidelityRedeemPuntiCost(poGate, fidelitySaldoSnap?.punti ?? 0)
      if (fidelityPremioActive) {
        if (!fidelitySaldoSnap?.anagrafica_cliente_id || redeemSnap.cost == null) {
          setCheckoutError("Premio fedeltà: nessun premio riscattabile con i punti attuali.")
          setLoading(false)
          markCheckoutEnd(telemetryCtx, {
            ok: false,
            tenantId,
            errorMessage: "fidelity_premio_invalid",
          })
          return
        }
        if (scontoPremioFidelityEuro <= 0.001) {
          setCheckoutError("Premio fedeltà: prezzo margherita non trovato nel listino o sconto non applicabile.")
          setLoading(false)
          markCheckoutEnd(telemetryCtx, {
            ok: false,
            tenantId,
            errorMessage: "fidelity_premio_zero",
          })
          return
        }
      }

      const noteParts = []
      if (noteSnap) noteParts.push(noteSnap)
      if (scontoManualeEuro > 0) {
        noteParts.push(`[Sconto cassa €${scontoManualeEuro.toFixed(2)}]`)
      }
      if (scontoPremioFidelityEuro > 0) {
        noteParts.push(
          `[Premio fedeltà (margherita) −€${scontoPremioFidelityEuro.toFixed(2)}; punti scalati: ${redeemSnap.cost}]`,
        )
      }
      const noteForOrder = noteParts.length ? noteParts.join("\n") : undefined

      // Nome e indirizzo restano campi distinti: deliverySearch è solo UI ricerca ("Nome – Via…").
      let rawConsegna = ""
      let nomeCliente = ""
      if (tipoOrdine === TIPO_ORDINE.DELIVERY) {
        if (selectedCliente?.indirizzo) {
          rawConsegna = String(selectedCliente.indirizzo).trim()
          nomeCliente = String(selectedCliente.nome || "").trim()
        } else {
          const split = splitNomeDaIndirizzoConsegna(deliverySearch)
          rawConsegna = (split.addrPart || split.full || "").trim()
          nomeCliente = (split.nomePart || "").trim()
        }
      } else if (tipoOrdine === TIPO_ORDINE.NEGOZIO) {
        nomeCliente = (checkoutNomeCliente || "").trim()
      }
      const indirizzoConsegna = rawConsegna
        ? formatIndirizzoDisplayItaliano(rawConsegna) || rawConsegna
        : ""
      const telefonoRitiroNegozio =
        tipoOrdine === TIPO_ORDINE.NEGOZIO ? (checkoutTelefonoCliente || "").trim() : ""
      const orarioRitiro = orarioRitiroFromSelectedSlot(checkoutSelectedSlot)

      let consegnaLng
      let consegnaLat
      if (tipoOrdine === TIPO_ORDINE.DELIVERY) {
        const ring = getDeliveryPolygonOuterRing(tenantData?.parametri_operativi)
        const addr = (indirizzoConsegna || "").trim()
        if (ring && addr) {
          const coords = await geocodeAddressForDelivery(addr)
          if (coords) {
            consegnaLng = coords.lng
            consegnaLat = coords.lat
            const inside = pointInPolygonRing(coords.lng, coords.lat, ring)
            if (inside === false && !bypassFuoriAreaCheckRef.current) {
              setFuoriAreaModal({ lat: coords.lat, lng: coords.lng })
              setLoading(false)
              markCheckoutEnd(telemetryCtx, {
                ok: false,
                tenantId,
                errorMessage: "fuori_area",
              })
              void logCassaAuditEvent(tenantId, {
                ordineId: null,
                eventType: "checkout_fuori_area",
                payload: { indirizzo: addr },
              })
              return
            }
          }
        }
      }
      bypassFuoriAreaCheckRef.current = false

      pendingOfflinePayload = {
        tenant_id: tenantId,
        totale: totalCheckout,
        stato: ORDER_STATUS,
        items: cart.map((p) => ({
          prodotto_id: p.id,
          quantita: p.qty,
          prezzo: p.prezzo,
          formatoNome: p.formatoNome ?? undefined,
          ingredientiCotturaSummary: p.ingredientiCotturaSummary ?? undefined,
        })),
        note: noteForOrder,
        tipoPagamento: tipoPagamentoFinale || undefined,
        tipoOrdine: tipoOrdine || undefined,
        nomeCliente: nomeCliente || undefined,
        orarioRitiro: orarioRitiro || undefined,
        indirizzoConsegna: indirizzoConsegna || undefined,
        consegnaLng,
        consegnaLat,
        pagamentoDettaglio,
        telefonoRitiro: telefonoRitiroNegozio || undefined,
        punto_vendita_id: activePvId || undefined,
        turno_operatori_id:
          turnoCassa?.id != null && Number.isFinite(Number(turnoCassa.id)) ? Number(turnoCassa.id) : undefined,
      }

      const orderId = await createOrder(tenantId, {
        totale: totalCheckout,
        stato: ORDER_STATUS,
        puntoVenditaId: activePvId || undefined,
        turnoOperatoriId:
          turnoCassa?.id != null && Number.isFinite(Number(turnoCassa.id)) ? Number(turnoCassa.id) : undefined,
        items: pendingOfflinePayload.items,
        note: noteForOrder,
        tipoPagamento: tipoPagamentoFinale || undefined,
        tipoOrdine: tipoOrdine || undefined,
        nomeCliente: nomeCliente || undefined,
        orarioRitiro: orarioRitiro || undefined,
        indirizzoConsegna: indirizzoConsegna || undefined,
        consegnaLng,
        consegnaLat,
        pagamentoDettaglio,
        telefonoRitiro: telefonoRitiroNegozio || undefined,
      })

      if (
        fidelityPremioActive &&
        redeemSnap.cost != null &&
        fidelitySaldoSnap?.anagrafica_cliente_id &&
        scontoPremioFidelityEuro > 0.001
      ) {
        try {
          await applyFidelityMovimento(
            tenantId,
            fidelitySaldoSnap.anagrafica_cliente_id,
            -redeemSnap.cost,
            "riscatto_premio",
            `Sconto margherita €${scontoPremioFidelityEuro.toFixed(2)} ordine ${orderId}`,
            orderId,
          )
        } catch (fe) {
          console.warn("[Cassa] riscatto premio fidelity:", fe)
          alert(
            `Ordine creato ma il riscatto punti non è stato registrato: ${fe?.message || "errore sconosciuto"}`,
          )
        }
      }

      if (fidelityServizioOk && fidelitySaldoSnap?.anagrafica_cliente_id) {
        const skipFidelity = fidelitySkippedByPromoCalendario(tenantData?.parametri_operativi, snapshotCart, new Date())
        const punti = skipFidelity
          ? 0
          : computeAccreditoFidelityPunti(tenantData?.parametri_operativi, snapshotCart, totalCheckout)
        if (punti > 0) {
          try {
            await applyFidelityMovimento(
              tenantId,
              fidelitySaldoSnap.anagrafica_cliente_id,
              punti,
              "accredito_ordine",
              `Ordine ${orderId}`,
              orderId,
            )
          } catch (fe) {
            console.warn("[Cassa] accredito fidelity:", fe)
          }
        }
      }

      void logCassaAuditEvent(tenantId, {
        ordineId: orderId,
        eventType: "checkout_ok",
        payload: {
          totale_carrello: total,
          sconto_cassa_euro: scontoEuroCheckout,
          totale_incasso: totalCheckout,
          cassa_arrotonda_5_cent: poGate.cassa_arrotonda_5_cent === true,
          tipo_pagamento: tipoPagamentoFinale,
          pagamento_dettaglio: pagamentoDettaglio,
        },
      })

      const fiscalCfg = readFiscalConfigFromParametri(tenantData?.parametri_operativi)
      void enqueueCorrispettivoAfterCheckoutIfConfigured({
        tenantId,
        ordineId: orderId,
        puntoVenditaId: activePvId ?? null,
        fiscalMode: fiscalCfg.fiscalMode,
        fiscalProviderKey: fiscalCfg.fiscalProviderKey,
        checkoutSnapshot: {
          totale_incasso: totalCheckout,
          tipo_pagamento: tipoPagamentoFinale,
          pagamento_dettaglio: pagamentoDettaglio,
        },
      }).then(({ error }) => {
        if (error) console.warn("[Cassa] fiscal_outbox enqueue:", error)
      })

      const linkSelezionato = isTipoPagamentoLink(tipoPagamentoFinale)
      const payLinkConfigurato = Boolean(fiscalCfg.paymentLinkEnabled && fiscalCfg.paymentLinkProviderKey)
      if (linkSelezionato || payLinkConfigurato) {
        const phoneFromCheckout = (checkoutTelefonoCliente || "").trim()
        const phoneCliente = (selectedCliente?.telefono || "").trim()
        setPostCheckoutPayLink({
          orderId,
          importoCent: Math.round(totalCheckout * 100),
        })
        setPayLinkPhone(phoneFromCheckout || telefonoRitiroNegozio || phoneCliente)
        setPayLinkMessage("")
      } else {
        setPostCheckoutPayLink(null)
      }

      markCheckoutEnd(telemetryCtx, { ok: true, tenantId, ordineId: orderId })

      clearCassaDraft(tenantId, activePvId ?? "nopv")
      setCart([])
      setCheckoutNote("")
      setCheckoutTipoPagamento(tipiPagamentoCassa[0] || TIPO_PAGAMENTO_CONTANTI)
      setMistoRighe([])
      setCheckoutScontoGlobale("")
      setCheckoutNomeCliente("")
      setCheckoutTelefonoCliente("")
      setFidelityPremioActive(false)
      setCheckoutSelectedSlot(null)
      setDeliverySearch("")
      setSelectedCliente(null)
      setFidelityQuery("")
      setFidelityHits([])
      setSelectedFidelitySaldo(null)
      setFidelitySearchDone(false)
      setShowRiepilogo(false)
      portaMenuPrincipaleDopoOrdine()
      loadOrdini()

      const po = tenantData?.parametri_operativi || {}
      let tipoPagamentoPerStampa = tipoPagamentoFinale || checkoutTipoPagamento
      if (tipoPagamentoFinale === "Misto" && mistoSnapshot.length) {
        const parts = mistoSnapshot
          .filter((r) => parseEuroInput(r.importo) > 0.001)
          .map((r) => `${String(r.tipo || "").trim() || "?"} €${parseEuroInput(r.importo).toFixed(2)}`)
        tipoPagamentoPerStampa = parts.length ? `Misto (${parts.join(" + ")})` : "Misto"
      }
      const righeComanda = cartItemsToComandaRighe(snapshotCart)
      let detail = null
      try {
        detail = await getOrderDetail(orderId)
      } catch (e) {
        console.warn("[Cassa] getOrderDetail dopo conferma:", e)
      }
      const printPayload = {
        tenantNome: tenantData?.nome || "Locale",
        orderId,
        numero: detail?.numero ?? detail?.numero_ordine,
        createdAt: detail?.createdAt ?? detail?.created_at ?? new Date().toISOString(),
        tipoOrdine,
        nomeCliente: nomeCliente || undefined,
        orarioRitiro: orarioRitiro || undefined,
        indirizzoConsegna: indirizzoConsegna.trim() || undefined,
        note: noteForOrder || undefined,
        tipoPagamento: tipoPagamentoPerStampa || undefined,
        righe: righeComanda,
        parametri: po,
      }
      setPendingComandaPrint(null)
      setPendingRicevutaPrint(null)

      const quandoComanda = readStampaQuando(po, "comanda")
      if (quandoComanda === "auto") {
        printComandaKitchen(printPayload)
      } else if (quandoComanda === "manuale") {
        setPendingComandaPrint(printPayload)
      }

      const ricevutaPayload = {
        tenantNome: tenantData?.nome || "Locale",
        orderId,
        numero: detail?.numero ?? detail?.numero_ordine,
        createdAt: detail?.createdAt ?? detail?.created_at ?? new Date().toISOString(),
        tipoOrdine,
        nomeCliente: nomeCliente || undefined,
        orarioRitiro: orarioRitiro || undefined,
        indirizzoConsegna: indirizzoConsegna.trim() || undefined,
        note: noteForOrder || undefined,
        tipoPagamento: tipoPagamentoPerStampa || undefined,
        righe: ricevutaRigheFromCartSnapshot(snapshotCart),
        totale: totalCheckout,
        parametri: po,
        annullato: false,
      }
      // Con tablet: ricevuta di cortesia dal reparto configurato, non dal checkout cassa.
      if (readStampaModalita(po) === "solo_cassa") {
        const quandoRicevuta = readStampaQuando(po, "ricevuta")
        if (quandoRicevuta === "auto") {
          printRicevuta(ricevutaPayload)
        } else if (quandoRicevuta === "manuale") {
          setPendingRicevutaPrint(ricevutaPayload)
        }
      }
    } catch (err) {
      console.error("Errore checkout:", err)
      const networkFail =
        isAuthFetchNetworkFailure(err) ||
        (typeof navigator !== "undefined" && !navigator.onLine)
      if (networkFail && pendingOfflinePayload) {
        try {
          await queueOfflineCheckout(pendingOfflinePayload)
          setCheckoutError(
            "Rete assente: ordine accodato localmente. Verrà inviato automaticamente al ripristino della connessione.",
          )
          markCheckoutEnd(telemetryCtx, {
            ok: false,
            tenantId,
            errorMessage: "offline_queued",
          })
          void logCassaAuditEvent(tenantId, {
            ordineId: null,
            eventType: "checkout_offline_queued",
            payload: { totale: pendingOfflinePayload.totale },
          })
          return
        } catch (queueErr) {
          console.error("Coda offline fallita:", queueErr)
        }
      }
      setCheckoutError(err?.message ?? "Errore durante il checkout. Verifica la RPC create_order_with_items e le colonne note/tipo_pagamento.")
      markCheckoutEnd(telemetryCtx, {
        ok: false,
        tenantId,
        errorMessage: err?.message,
      })
      void logCassaAuditEvent(tenantId, {
        ordineId: null,
        eventType: "checkout_error",
        payload: { message: String(err?.message || err) },
      })
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
    return products.filter((p) =>
      productMatchesMenuSearch(p, q, productIngredientiMap[p.id]),
    )
  }, [products, searchPizza, productIngredientiMap])

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
  const turnoCassaBloccante =
    parametri.cassa_turno_obbligatorio === true &&
    !turnoCassaLoading &&
    !turnoOkForCassa(parametri, turnoCassa, activePvId)
  const haStampantiReparto = useMemo(
    () => normalizeComandaRepartiStampanti(parametri?.comanda_reparti_stampanti).length > 0,
    [parametri?.comanda_reparti_stampanti],
  )
  const tipiPagamentoCassa = useMemo(
    () => listTipiPagamentoCassa(parametri, { ordineOnline: false }),
    [parametri],
  )
  const tipiPagamentoOrdineOnline = useMemo(
    () => listTipiPagamentoCassa(parametri, { ordineOnline: true }),
    [parametri],
  )

  useEffect(() => {
    if (!tipiPagamentoCassa.includes(checkoutTipoPagamento) && tipiPagamentoCassa[0]) {
      setCheckoutTipoPagamento(tipiPagamentoCassa[0])
    }
  }, [tipiPagamentoCassa, checkoutTipoPagamento])

  const menuTheme = resolveMenuTheme(parametri)
  const menuRowBackground = menuTheme?.cardBackground || "#f3f9f4"
  const activeCatNome = (categories.find((c) => c.id === activeCategory)?.nome || "").toLowerCase()
  const showModificaCategoria = !["fritti", "dolci", "bibite"].includes(activeCatNome)

  const orariOggi = useMemo(() => getTodayOrari(tenantData?.orari_settimana), [tenantData?.orari_settimana])
  const pizzeOgni15 = Number(parametri.pizze_ogni_15_min) || 8
  const sogliaGiallo = Number(parametri.soglia_giallo_pizze) || 10
  /** Unico tetto colore/UI planning: griglia 15 min × throughput pizze/15 min (stesso criterio del riepilogo ordine). */
  const maxPizzeFornoUnico = Math.max(1, Math.round((pizzeOgni15 * PLANNING_GRID_SLOT_MINUTES) / 15))

  /** Griglia unica quarti d'ora; consegne e ritiro condividono le stesse fasce orarie. */
  const planningSlotsGrid = useMemo(() => buildSlotsFullDay(orariOggi), [orariOggi])
  const ordiniPerSlotDelivery = useMemo(() => {
    const delivery = (ordiniOggiAttivi || []).filter((o) => ordineIsDelivery(o))
    return groupOrdersBySlotOrarioRitiro(delivery, PLANNING_GRID_SLOT_MINUTES)
  }, [ordiniOggiAttivi])
  const ordiniPerSlotNegozio = useMemo(() => {
    const negozio = (ordiniOggiAttivi || []).filter((o) => !ordineIsDelivery(o))
    return groupOrdersBySlotOrarioRitiro(negozio, PLANNING_GRID_SLOT_MINUTES)
  }, [ordiniOggiAttivi])
  const ordiniBySlotDelivery = useMemo(() => {
    const delivery = (ordiniOggiAttivi || []).filter((o) => ordineIsDelivery(o))
    return groupOrdiniBySlotOrarioRitiro(delivery, PLANNING_GRID_SLOT_MINUTES)
  }, [ordiniOggiAttivi])
  const ordiniBySlotNegozio = useMemo(() => {
    const negozio = (ordiniOggiAttivi || []).filter((o) => !ordineIsDelivery(o))
    return groupOrdiniBySlotOrarioRitiro(negozio, PLANNING_GRID_SLOT_MINUTES)
  }, [ordiniOggiAttivi])
  const pizzePerSlotDelivery = useMemo(() => {
    const delivery = (ordiniOggiAttivi || []).filter((o) => ordineIsDelivery(o))
    return groupPizzeBySlotOrarioRitiro(delivery, pizzePerOrdine, PLANNING_GRID_SLOT_MINUTES)
  }, [ordiniOggiAttivi, pizzePerOrdine])
  const pizzePerSlotNegozio = useMemo(() => {
    const negozio = (ordiniOggiAttivi || []).filter((o) => !ordineIsDelivery(o))
    return groupPizzeBySlotOrarioRitiro(negozio, pizzePerOrdine, PLANNING_GRID_SLOT_MINUTES)
  }, [ordiniOggiAttivi, pizzePerOrdine])

  /** Riepilogo: carico forno unico — somma pizze consegna + ritiro nella stessa fascia (stesso orario in griglia). */
  const pizzePerSlotRiepilogo = useMemo(() => {
    return groupPizzeBySlotOrarioRitiro(ordiniOggiAttivi || [], pizzePerOrdine, PLANNING_GRID_SLOT_MINUTES)
  }, [ordiniOggiAttivi, pizzePerOrdine])

  const ordiniFiltratiPerPagina = useMemo(() => {
    const q = (ordiniSearch || "").toLowerCase().trim()
    let list = ordiniOggiFiltered || []
    if (q) {
      list = list.filter((o) => {
        const nome = ordineNomeCliente(o).toLowerCase()
        const indirizzo = ordineIndirizzoConsegna(o).toLowerCase()
        const num = String(o.numero ?? o.numero_ordine ?? o.numeroOrdine ?? "")
        return nome.includes(q) || indirizzo.includes(q) || num.includes(q)
      })
    }
    return list
  }, [ordiniOggiFiltered, ordiniSearch])

  const ordiniRaggruppatiPerOra = useMemo(() => {
    const byKey = {}
    for (const o of ordiniFiltratiPerPagina) {
      const key = orarioVisualizzatoLista(o) || "—"
      if (!byKey[key]) byKey[key] = []
      byKey[key].push(o)
    }
    for (const arr of Object.values(byKey)) {
      arr.sort((a, b) => new Date(ordineCreatedAt(b) || 0) - new Date(ordineCreatedAt(a) || 0))
    }
    return Object.keys(byKey)
      .sort()
      .map((ora) => ({ ora, ordini: byKey[ora] }))
  }, [ordiniFiltratiPerPagina])

  const planningMergedRows = useMemo(() => {
    return (planningSlotsGrid || []).map((slot) => {
      const deliveryOrdini = ordiniPerSlotDelivery[slot.key] ?? 0
      const deliveryPizze = pizzePerSlotDelivery[slot.key] ?? 0
      const deliveryOrdiniList = ordiniBySlotDelivery[slot.key] || []
      const ritiroOrdini = ordiniPerSlotNegozio[slot.key] ?? 0
      const ritiroPizze = pizzePerSlotNegozio[slot.key] ?? 0
      const ritiroOrdiniList = ordiniBySlotNegozio[slot.key] || []
      const totPizzeForno = deliveryPizze + ritiroPizze
      const fornoColor = slotColor(totPizzeForno, maxPizzeFornoUnico, sogliaGiallo)
      return {
        slotKey: slot.key,
        label: slot.label,
        deliveryOrdini,
        deliveryPizze,
        deliveryOrdiniList,
        ritiroOrdini,
        ritiroPizze,
        ritiroOrdiniList,
        totPizzeForno,
        fornoColor,
        deliveryColor: fornoColor,
        ritiroColor: fornoColor,
      }
    })
  }, [
    planningSlotsGrid,
    ordiniPerSlotDelivery,
    ordiniPerSlotNegozio,
    ordiniBySlotDelivery,
    ordiniBySlotNegozio,
    pizzePerSlotDelivery,
    pizzePerSlotNegozio,
    maxPizzeFornoUnico,
    sogliaGiallo,
  ])

  const cassaMobileShell = useMemo(() => {
    if (!cassaMobileLayout) {
      return {
        pageColumnExtra: {},
        wrapperExtra: {},
        ordiniExtra: {},
        productsExtra: {},
        cartExtra: {},
        ordiniItemExtra: {},
        showTabBar: false,
      }
    }
    const tab = cassaMobileTab
    const tabBarPad = "calc(52px + env(safe-area-inset-bottom, 0px))"
    return {
      pageColumnExtra: {
        height: "auto",
        minHeight: "min(100dvh, 100vh)",
        paddingBottom: tabBarPad,
        boxSizing: "border-box",
      },
      wrapperExtra: {
        flexDirection: "column",
        flex: 1,
        minHeight: 0,
        overflow: "hidden",
        width: "100%",
        alignItems: "stretch",
      },
      ordiniExtra: {
        width: "100%",
        maxWidth: "100%",
        borderRight: "none",
        flex: tab === "ordini" ? 1 : undefined,
        minHeight: tab === "ordini" ? 0 : undefined,
        display: tab === "ordini" ? "flex" : "none",
        flexDirection: "column",
        padding: "12px 14px",
      },
      productsExtra: {
        flex: tab === "menu" ? 1 : undefined,
        minHeight: tab === "menu" ? 0 : undefined,
        width: "100%",
        minWidth: 0,
        padding: "12px 14px",
        display: tab === "menu" ? "block" : "none",
        overflowY: tab === "menu" ? "auto" : undefined,
      },
      cartExtra: {
        width: "100%",
        maxWidth: "100%",
        borderLeft: "none",
        height: "auto",
        alignSelf: "stretch",
        flex: tab === "carrello" ? 1 : undefined,
        minHeight: tab === "carrello" ? 0 : undefined,
        display: tab === "carrello" ? "flex" : "none",
        flexDirection: "column",
        overflowY: tab === "carrello" ? "auto" : undefined,
      },
      ordiniItemExtra: { fontSize: 15, padding: "12px 12px" },
      showTabBar: true,
    }
  }, [cassaMobileLayout, cassaMobileTab])

  if (showImpostazioniCassa) {
    return (
      <CassaImpostazioniPage
        onBack={() => {
          setShowImpostazioniCassa(false)
          void refreshTenant()
        }}
      />
    )
  }

  if (showRiepilogo) {
    return (
      <>
        {turnoCassaBloccante ? (
          <div
            role="alert"
            style={{
              marginBottom: 12,
              padding: "12px 14px",
              borderRadius: 10,
              background: "#fff7ed",
              border: "1px solid #fdba74",
              color: "#9a3412",
              fontSize: 14,
              lineHeight: 1.45,
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: 10,
            }}
          >
            <span>
              <strong>Turno cassa obbligatorio:</strong> apri un turno per il punto vendita attivo prima di incassare ordini.
            </span>
            <button
              type="button"
              className="cassa-toolbar-compact-btn"
              onClick={() => navigate("/operative/turni")}
              style={{ fontWeight: 600 }}
            >
              Vai ai turni
            </button>
          </div>
        ) : null}
        <RiepilogoOrdinePage
          staffOverrideClosing
          cart={cart}
          total={total}
          totalCheckout={totalCheckout}
          scontoEuroApplicato={scontoEuroCheckout}
          scontoManualeEuro={scontoManualeEuro}
          scontoPremioFidelityEuro={scontoPremioFidelityEuro}
          checkoutScontoGlobale={checkoutScontoGlobale}
          onCheckoutScontoGlobaleChange={setCheckoutScontoGlobale}
          tipoOrdine={tipoOrdine}
          deliverySearch={deliverySearch}
          checkoutNote={checkoutNote}
          onCheckoutNoteChange={setCheckoutNote}
          checkoutTipoPagamento={checkoutTipoPagamento}
          onCheckoutTipoPagamentoChange={setCheckoutTipoPagamento}
          mistoRighe={mistoRighe}
          onMistoRigaChange={updateMistoRiga}
          onAddMistoRiga={addMistoRiga}
          onRemoveMistoRiga={removeMistoRiga}
          maxMistoRighe={MAX_MISTO_RIGHE}
          cassaArrotonda5Cent={cassaArrotonda5CentFlag}
          checkoutNomeCliente={checkoutNomeCliente}
          onCheckoutNomeClienteChange={setCheckoutNomeCliente}
          checkoutTelefonoCliente={checkoutTelefonoCliente}
          onCheckoutTelefonoClienteChange={setCheckoutTelefonoCliente}
          selectedSlot={checkoutSelectedSlot}
          onSlotSelect={setCheckoutSelectedSlot}
          tipiPagamento={tipiPagamentoCassa}
          parametri={parametri}
          orariSettimana={tenantData?.orari_settimana}
          onConfirm={handleCheckout}
          onBack={() => {
            setShowRiepilogo(false)
            setFidelityQuery("")
            setFidelityHits([])
            setSelectedFidelitySaldo(null)
            setFidelitySearchDone(false)
            setFidelityPremioActive(false)
          }}
          loading={loading}
          checkoutError={checkoutError}
          onIncrease={increaseQty}
          onDecrease={decreaseQty}
          onRemove={(item) => setCart((prev) => prev.filter((p) => p !== item))}
          onEditPizza={openModificaPizzaFromCart}
          pizzePerSlotFromOrders={pizzePerSlotRiepilogo}
          maxPizzeFornoPerSlot={maxPizzeFornoUnico}
          fidelityAbilitato={fidelityServizioOk}
          fidelityQuery={fidelityQuery}
          onFidelityQueryChange={(v) => {
            setFidelityQuery(v)
            setSelectedFidelitySaldo(null)
          }}
          fidelityLoading={fidelityLoading}
          fidelityHits={fidelityHits}
          fidelitySearchDone={fidelitySearchDone}
          selectedFidelity={selectedFidelitySaldo}
          onSelectFidelity={handleSelectFidelitySaldo}
          onNuovaFidelityCliente={() => setNuovoFidelityClienteModalOpen(true)}
          fidelityRedeemInfo={fidelityRedeemInfo}
          fidelityRedeemPuntiCost={fidelityRedeemInfo.cost}
          fidelityPremioDescrizione={fidelityRedeemInfo.premioLabel}
          margheritaPrezzoCatalogo={margheritaPremioPrezzo}
          fidelityPremioActive={fidelityPremioActive}
          onFidelityPremioActiveChange={setFidelityPremioActive}
        />
        <ModificaPizzaModal
          open={productModalOpen}
          onClose={closePizzaModal}
          product={productToAdd}
          tenantId={tenantId}
          tipoOrdine={tipoOrdine}
          parametri={tenantData?.parametri_operativi}
          onConfirm={confirmModificaPizza}
          prefillFromProduct={Boolean(pizzaModalEditCartLine)}
        />
        <NuovoClienteModal
          open={nuovoClienteModalOpen}
          onClose={() => setNuovoClienteModalOpen(false)}
          tenantId={tenantId}
          onSuccess={handleNuovoClienteSuccess}
          parametriOperativi={tenantData?.parametri_operativi}
        />
        <NuovoClienteModal
          open={nuovoFidelityClienteModalOpen}
          onClose={() => setNuovoFidelityClienteModalOpen(false)}
          tenantId={tenantId}
          onSuccess={handleNuovoFidelityClienteSuccess}
          parametriOperativi={tenantData?.parametri_operativi}
        />
      </>
    )
  }

  return (
    <div
      style={{ ...styles.pageColumn, ...cassaMobileShell.pageColumnExtra }}
      className={cassaMobileLayout ? "cassa-page-root cassa-page-root--mobile" : "cassa-page-root"}
    >
      {turnoCassaBloccante ? (
        <div
          role="alert"
          style={{
            marginBottom: 12,
            padding: "12px 14px",
            borderRadius: 10,
            background: "#fff7ed",
            border: "1px solid #fdba74",
            color: "#9a3412",
            fontSize: 14,
            lineHeight: 1.45,
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 10,
          }}
        >
          <span>
            <strong>Turno cassa obbligatorio:</strong> apri un turno per il punto vendita attivo prima di incassare ordini.
          </span>
          <button
            type="button"
            className="cassa-toolbar-compact-btn"
            onClick={() => navigate("/operative/turni")}
            style={{ fontWeight: 600 }}
          >
            Vai ai turni
          </button>
        </div>
      ) : null}
      {offlinePendingCount > 0 ? (
        <div
          role="status"
          style={{
            marginBottom: 12,
            padding: "12px 14px",
            borderRadius: 10,
            background: isOnline ? "#eff6ff" : "#fffbeb",
            border: `1px solid ${isOnline ? "#93c5fd" : "#fcd34d"}`,
            color: isOnline ? "#1e40af" : "#92400e",
            fontSize: 14,
            lineHeight: 1.45,
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 10,
          }}
        >
          <span>
            <strong>Coda offline:</strong> {offlinePendingCount}{" "}
            {offlinePendingCount === 1 ? "ordine in attesa" : "ordini in attesa"} di invio al server.
            {!isOnline ? " Connessione assente — verranno sincronizzati al ripristino." : null}
          </span>
          {isOnline ? (
            <button
              type="button"
              className="cassa-toolbar-compact-btn"
              style={{ fontWeight: 700 }}
              disabled={offlineFlushing}
              onClick={() => void flushOfflineQueue()}
            >
              {offlineFlushing ? "Invio…" : "Invia ora"}
            </button>
          ) : null}
          {lastFlush?.errors?.length ? (
            <span style={{ fontSize: 13, color: "#b91c1c", width: "100%" }}>
              Ultimo tentativo: {lastFlush.errors.join(" · ")}
            </span>
          ) : null}
        </div>
      ) : null}
      {foodcostMismatchCount > 0 && !foodcostAlertDismissed ? (
        <div
          role="alert"
          style={{
            marginBottom: 12,
            padding: "12px 14px",
            borderRadius: 10,
            background: "#fef2f2",
            border: "1px solid #fecaca",
            color: "#991b1b",
            fontSize: 14,
            lineHeight: 1.45,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
            flexWrap: "wrap",
          }}
        >
          <span>
            <strong>Controllo foodcost:</strong> {foodcostMismatchCount} prodotti non allineati con il listino.
            Verifica i prezzi prima del servizio.
          </span>
          <button
            type="button"
            className="cassa-toolbar-compact-btn"
            style={{ fontWeight: 700 }}
            onClick={() => {
              setFoodcostAlertDismissed(true)
              setFoodcostModalOpen(false)
            }}
          >
            Chiudi
          </button>
        </div>
      ) : null}
      {foodcostModalOpen && foodcostMismatchCount > 0 ? (
        <div style={styles.modalOverlay} role="dialog" aria-modal="true" onClick={() => setFoodcostModalOpen(false)}>
          <div style={{ ...styles.detailModal, maxWidth: 520, width: "95%" }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: "0 0 10px", fontSize: 18, color: "#991b1b" }}>Controllo foodcost/listino</h3>
            <p style={{ margin: "0 0 14px", fontSize: 14, lineHeight: 1.5, color: "#334155" }}>
              Sono presenti <strong>{foodcostMismatchCount}</strong> prodotti con prezzo listino non allineato al costo ingredienti.
              Correggi in Admin prima di accettare molti ordini.
            </p>
            {foodcostMismatchPreview.length > 0 ? (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontWeight: 700, marginBottom: 6, color: "#334155" }}>Prime pizze fuori soglia</div>
                <div style={{ maxHeight: 220, overflowY: "auto", border: "1px solid #e2e8f0", borderRadius: 8 }}>
                  {foodcostMismatchPreview.map((item, idx) => (
                    <div
                      key={`${item.nome}_${idx}`}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "minmax(140px,1fr) 88px 88px 78px",
                        gap: 8,
                        padding: "8px 10px",
                        borderBottom: idx < foodcostMismatchPreview.length - 1 ? "1px solid #f1f5f9" : "none",
                        fontSize: 12,
                        alignItems: "center",
                      }}
                    >
                      <strong style={{ color: "#0f172a" }}>{item.nome}</strong>
                      <span>Att. €{item.prezzoListino.toFixed(2)}</span>
                      <span>Target €{item.prezzoCalcolato.toFixed(2)}</span>
                      <span style={{ color: item.delta > 0 ? "#b91c1c" : "#0369a1" }}>
                        Δ {item.delta > 0 ? "+" : ""}
                        {item.delta.toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, flexWrap: "wrap" }}>
              <button
                type="button"
                className="cassa-toolbar-compact-btn"
                onClick={() => {
                  setFoodcostModalOpen(false)
                  setFoodcostAlertDismissed(true)
                  navigate("/admin/listini")
                }}
                style={{ fontWeight: 700 }}
              >
                Vai a Listini
              </button>
              <button
                type="button"
                className="cassa-toolbar-compact-btn"
                onClick={() => {
                  setFoodcostModalOpen(false)
                  setFoodcostAlertDismissed(true)
                }}
                style={{ fontWeight: 700 }}
              >
                Ho capito
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {postCheckoutPayLink ? (() => {
        const fiscalLive = readFiscalConfigFromParametri(tenantData?.parametri_operativi)
        const payLinkConfigured = Boolean(
          fiscalLive.paymentLinkEnabled && fiscalLive.paymentLinkProviderKey,
        )
        const providerKey = fiscalLive.paymentLinkProviderKey || ""
        return (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Pagamento con link"
          style={{
            position: "fixed",
            left: 12,
            right: 12,
            bottom: 12,
            zIndex: 10030,
            padding: "14px 16px",
            borderRadius: 10,
            background: payLinkConfigured ? "#e8f5e9" : "#fff8e1",
            border: `1px solid ${payLinkConfigured ? "#66bb6a" : "#ffb300"}`,
            boxShadow: "0 6px 20px rgba(0,0,0,0.12)",
            fontSize: 13,
            lineHeight: 1.45,
            maxWidth: 520,
            margin: "0 auto",
          }}
        >
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, justifyContent: "space-between" }}>
            <strong>Paga online</strong>
            <button
              type="button"
              className="cassa-toolbar-compact-btn"
              onClick={() => {
                setPostCheckoutPayLink(null)
                setPayLinkMessage("")
              }}
              style={{ fontWeight: 600 }}
            >
              Chiudi
            </button>
          </div>
          <p style={{ margin: "8px 0", color: payLinkConfigured ? "#1b5e20" : "#e65100" }}>
            Ordine <code style={{ fontSize: 12 }}>{postCheckoutPayLink.orderId}</code> — importo €
            {(postCheckoutPayLink.importoCent / 100).toFixed(2)}
            {payLinkConfigured ? (
              <>
                {" "}
                · provider <strong>{providerKey}</strong>
              </>
            ) : (
              <> · <strong>da configurare</strong></>
            )}
          </p>
          {!payLinkConfigured ? (
            <p style={{ margin: "0 0 10px", color: "#bf360c" }}>
              Per inviare o registrare il link abilita «Paga online» in Admin → Parametri e configura Pay-by-link in
              Admin → Pagamenti online.
            </p>
          ) : null}
          <label style={{ display: "block", marginBottom: 8 }}>
            <span style={{ fontWeight: 600 }}>Telefono destinatario (opzionale)</span>
            <input
              type="tel"
              value={payLinkPhone}
              onChange={(e) => setPayLinkPhone(e.target.value)}
              placeholder="+39…"
              style={{ display: "block", marginTop: 6, padding: "8px 10px", width: "100%", maxWidth: 280, boxSizing: "border-box" }}
            />
          </label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {!payLinkConfigured ? (
              <button
                type="button"
                className="cassa-toolbar-compact-btn"
                onClick={() => setShowImpostazioniCassa(true)}
                style={{ fontWeight: 700, background: "#ef6c00", color: "#fff" }}
              >
                Apri impostazioni cassa
              </button>
            ) : (
              <button
                type="button"
                className="cassa-toolbar-compact-btn"
                disabled={payLinkBusy}
                onClick={() => {
                  if (!tenantId || !postCheckoutPayLink) return
                  setPayLinkBusy(true)
                  setPayLinkMessage("")
                  void runUnifiedPayByLinkSetup({
                    tenantId,
                    ordineId: postCheckoutPayLink.orderId,
                    importoCent: postCheckoutPayLink.importoCent,
                    paymentLinkProviderKey: providerKey,
                    destinatarioTelefono: payLinkPhone.trim() || null,
                  })
                    .then((r) => {
                      setPayLinkMessage(r.ok ? r.message || "OK" : r.error || "Errore")
                    })
                    .finally(() => setPayLinkBusy(false))
                }}
                style={{ fontWeight: 700, background: "#2e7d32", color: "#fff" }}
              >
                {payLinkBusy ? "Registrazione…" : "Registra / invia richiesta link"}
              </button>
            )}
          </div>
          {payLinkMessage ? (
            <p
              style={{
                margin: "10px 0 0",
                fontSize: 12,
                color: payLinkConfigured ? "#33691e" : "#bf360c",
              }}
            >
              {payLinkMessage}
            </p>
          ) : null}
        </div>
        )
      })() : null}
      {chiudiGiornataConfirmOpen ? (
        <div
          style={styles.modalOverlay}
          onClick={() => !chiudiGiornataLoading && setChiudiGiornataConfirmOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="chiudi-giornata-title"
        >
          <div style={styles.detailModal} onClick={(e) => e.stopPropagation()}>
            <h3 id="chiudi-giornata-title" style={{ margin: "0 0 12px", fontSize: 17 }}>
              Confermi chiusura giornata?
            </h3>
            <p style={{ margin: "0 0 16px", fontSize: 14, color: "#444", lineHeight: 1.5 }}>
              Verrà creato il salvataggio per contabilità e lo storico giornaliero si resetta. L&apos;operazione non è
              annullabile da qui.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "flex-end" }}>
              <button
                type="button"
                style={styles.planningBarToggle}
                disabled={chiudiGiornataLoading}
                onClick={() => setChiudiGiornataConfirmOpen(false)}
              >
                Annulla
              </button>
              <button
                type="button"
                style={{ ...styles.chiudiGiornataBtn, cursor: chiudiGiornataLoading ? "default" : "pointer", opacity: chiudiGiornataLoading ? 0.7 : 1 }}
                disabled={chiudiGiornataLoading}
                onClick={() => void handleChiudiGiornataConfirmed()}
              >
                {chiudiGiornataLoading ? "…" : "Sì, chiudi giornata"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      <div
        aria-live="polite"
        style={{
          position: "fixed",
          right: 16,
          bottom: 16,
          zIndex: 10040,
          display: "flex",
          flexDirection: "column",
          gap: 8,
          maxWidth: 320,
          pointerEvents: "none",
        }}
      >
        {cassaWebToasts.map((tw) => (
          <div
            key={tw.toastId}
            style={{
              pointerEvents: "auto",
              padding: "12px 14px",
              borderRadius: 10,
              background: tw.pendingAccept ? "#9a3412" : "#0f172a",
              color: "#fff",
              boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
              fontSize: 14,
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
              <span>
                {tw.pendingAccept ? "Ordine web da accettare" : "Nuovo ordine web"}
                {tw.numero != null && tw.numero !== "—" ? (
                  <>
                    {" "}
                    <strong>#{tw.numero}</strong>
                  </>
                ) : null}
              </span>
              <button
                type="button"
                onClick={() => setCassaWebToasts((prev) => prev.filter((x) => x.toastId !== tw.toastId))}
                style={{
                  border: "none",
                  background: "transparent",
                  color: "#94a3b8",
                  cursor: "pointer",
                  fontSize: 18,
                  lineHeight: 1,
                  padding: 0,
                }}
                aria-label="Chiudi"
              >
                ×
              </button>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              <button
                type="button"
                onClick={() => {
                  void openOrdineDetail(tw.ordineId)
                  setCassaWebToasts((prev) => prev.filter((x) => x.toastId !== tw.toastId))
                }}
                style={{
                  border: "none",
                  borderRadius: 6,
                  padding: "6px 10px",
                  background: "#fff",
                  color: "#0f172a",
                  fontWeight: 600,
                  fontSize: 12,
                  cursor: "pointer",
                }}
              >
                Apri
              </button>
              {tw.pendingAccept ? (
                <button
                  type="button"
                  disabled={accettazioneWebBusy}
                  onClick={() => void handleAccettaOrdineWeb(tw.ordineId)}
                  style={{
                    border: "none",
                    borderRadius: 6,
                    padding: "6px 10px",
                    background: "#16a34a",
                    color: "#fff",
                    fontWeight: 600,
                    fontSize: 12,
                    cursor: accettazioneWebBusy ? "default" : "pointer",
                    opacity: accettazioneWebBusy ? 0.7 : 1,
                  }}
                >
                  Accetta
                </button>
              ) : null}
            </div>
          </div>
        ))}
      </div>
      {fuoriAreaModal && (
        <div style={styles.modalOverlay} role="dialog" aria-modal="true" aria-labelledby="fuori-area-title">
          <div
            style={{ ...styles.detailModal, maxWidth: 420, width: "92%" }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="fuori-area-title" style={{ margin: "0 0 12px" }}>Indirizzo fuori area</h3>
            <p style={{ margin: "0 0 16px", fontSize: 14, color: "#444", lineHeight: 1.5 }}>
              L&apos;indirizzo di consegna risulta <strong>fuori dal poligono</strong> impostato in Parametri operativi.
              In cassa puoi confermare comunque l&apos;ordine; i clienti che ordinano da casa verranno bloccati dal sistema.
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button
                type="button"
                style={styles.comandaBannerDismiss}
                onClick={() => setFuoriAreaModal(null)}
              >
                Modifica indirizzo
              </button>
              <button
                type="button"
                style={styles.comandaBannerBtn}
                onClick={() => {
                  setFuoriAreaModal(null)
                  bypassFuoriAreaCheckRef.current = true
                  void handleCheckout()
                }}
              >
                Conferma ordine
              </button>
            </div>
          </div>
        </div>
      )}
      {(pendingComandaPrint || pendingRicevutaPrint) && (
        <div style={styles.comandaBanner} role="status">
          <span>
            Ordine registrato
            {(() => {
              const n = pendingComandaPrint?.numero ?? pendingRicevutaPrint?.numero
              return n != null && n !== "" ? ` (#${n})` : ""
            })()}
            .
            {pendingComandaPrint ? " Stampa la comanda per la cucina." : ""}
            {pendingRicevutaPrint
              ? pendingComandaPrint
                ? " Stampa anche la ricevuta di cortesia per il cliente se serve."
                : " Stampa la ricevuta di cortesia per il cliente."
              : ""}
          </span>
          <div style={{ display: "flex", gap: 8, flexShrink: 0, flexWrap: "wrap" }}>
            {pendingComandaPrint ? (
              <>
                <button
                  type="button"
                  style={styles.comandaBannerBtn}
                  onClick={() => {
                    printComandaKitchen(pendingComandaPrint)
                  }}
                >
                  Stampa comanda
                </button>
                {haStampantiReparto && (
                  <button
                    type="button"
                    style={{ ...styles.comandaBannerBtn, background: "#37474f" }}
                    onClick={() => {
                      printComandaKitchenPerReparto(pendingComandaPrint)
                    }}
                  >
                    Stampa per reparto
                  </button>
                )}
              </>
            ) : null}
            {pendingRicevutaPrint ? (
              <button
                type="button"
                style={{ ...styles.comandaBannerBtn, background: "#6a1b9a" }}
                onClick={() => printRicevuta(pendingRicevutaPrint)}
              >
                Stampa ricevuta di cortesia
              </button>
            ) : null}
            <button
              type="button"
              style={styles.comandaBannerDismiss}
              onClick={() => {
                setPendingComandaPrint(null)
                setPendingRicevutaPrint(null)
              }}
            >
              Chiudi
            </button>
          </div>
        </div>
      )}
      <div
        style={{ ...styles.wrapper, ...cassaMobileShell.wrapperExtra }}
        className="cassa-main-columns"
      >
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
                        const iconPagamento = iconTipoPagamentoLista(o.tipo_pagamento)
                        const labelPagamento = labelTipoPagamentoLista(o.tipo_pagamento)
                        const isDelivery = ordineIsDelivery(o)
                        const indirizzoSecondaRiga = isDelivery ? deliveryIndirizzoRiga(o) : ""
                        const idOrdine = `#${o.numero ?? o.numero_ordine ?? o.numeroOrdine ?? "—"}`
                        const ann = ordineIsAnnullato(o)
                        const pendingAccept = ordineRichiedeAccettazioneCassa(o)
                        return (
                          <li key={o.id}>
                            <button
                              type="button"
                              style={{
                                ...styles.ordiniItem,
                                ...(ann ? { opacity: 0.72, borderLeft: "3px solid #b71c1c" } : {}),
                                ...(!ann && pendingAccept ? { borderLeft: "3px solid #ea580c" } : {}),
                              }}
                              onClick={() => { openOrdineDetail(o.id); setShowPaginaOrdini(false); }}
                              title="Apri dettaglio"
                            >
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <OrdineCardTitleRows o={o} isDelivery={isDelivery} />
                                  <div style={{ fontSize: 11, color: "#666", marginTop: 4, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                                    <span>{idOrdine}</span>
                                    {ann ? <span style={{ color: "#b71c1c", fontWeight: 700 }}>Annullato</span> : null}
                                    {!ann && pendingAccept ? (
                                      <span style={{ color: "#c2410c", fontWeight: 700 }}>Da accettare</span>
                                    ) : null}
                                  </div>
                                  {indirizzoSecondaRiga ? (
                                    <div style={{ fontSize: 11, color: "#555", marginTop: 2 }}>{indirizzoSecondaRiga}</div>
                                  ) : null}
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
      {/* Planning desktop: nasconde elenco ordini e carrello (come il menù) per usare tutta la larghezza. */}
      {!(showPlanningBar && !cassaMobileLayout) ? (
      <div style={{ ...styles.ordiniSection, ...cassaMobileShell.ordiniExtra }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
          <h3 style={{ ...styles.ordiniTitle, margin: 0, ...(cassaMobileLayout ? { fontSize: 18 } : {}) }}>Ordini</h3>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            {!cassaOrdineInCorso ? (
              <button
                type="button"
                onClick={() => navigate("/operative/cassa/fidelity")}
                style={{
                  padding: "6px 12px",
                  borderRadius: 8,
                  border: "none",
                  background: fidelityServizioOk ? "#7b1fa2" : "#9e9e9e",
                  color: "#fff",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
                title="Apri gestione Fidelity Card"
              >
                Fidelity Card
              </button>
            ) : null}
            <button
              type="button"
              style={styles.chiudiGiornataBtn}
              onClick={() => setChiudiGiornataConfirmOpen(true)}
              disabled={chiudiGiornataLoading}
            >
              {chiudiGiornataLoading ? "…" : "Chiudi giornata"}
            </button>
          </div>
        </div>
        {ordiniWebInAttesaAccettazione.length > 0 ? (
          <div
            role="status"
            style={{
              marginBottom: 12,
              padding: "10px 12px",
              borderRadius: 8,
              background: "#fff7ed",
              border: "1px solid #fb923c",
              color: "#9a3412",
              fontSize: 13,
              lineHeight: 1.45,
            }}
          >
            <strong>Ordini web da accettare:</strong> {ordiniWebInAttesaAccettazione.length}.{" "}
            {ordiniWebInAttesaAccettazione.slice(0, 8).map((o, i) => (
              <button
                key={o.id}
                type="button"
                onClick={() => void openOrdineDetail(o.id)}
                style={{
                  marginLeft: i === 0 ? 0 : 6,
                  padding: "2px 8px",
                  borderRadius: 6,
                  border: "1px solid #fdba74",
                  background: "#fff",
                  color: "#9a3412",
                  fontWeight: 600,
                  fontSize: 12,
                  cursor: "pointer",
                }}
              >
                #{o.numero ?? o.numero_ordine ?? o.numeroOrdine ?? "—"}
              </button>
            ))}
            {ordiniWebInAttesaAccettazione.length > 8 ? "…" : null}
          </div>
        ) : null}
        {deliveryAttenzioneInfo.count > 0 ? (
          <div
            role="alert"
            style={{
              marginBottom: 12,
              padding: "10px 12px",
              borderRadius: 8,
              background: "#fff3e0",
              border: "1px solid #e65100",
              color: "#bf360c",
              fontSize: 13,
              lineHeight: 1.45,
            }}
          >
            <strong>Consegne in criticità:</strong> {deliveryAttenzioneInfo.count} ordine
            {deliveryAttenzioneInfo.count === 1 ? "" : "i"} (forno / partenza / ritardo). Numeri:{" "}
            {deliveryAttenzioneInfo.numeri.join(", ")}
            {deliveryAttenzioneInfo.count > deliveryAttenzioneInfo.numeri.length ? "…" : ""}
          </div>
        ) : null}
        <ul style={styles.ordiniList}>
          {ordiniOggiFiltered.map((o) => {
            const iconPagamento = iconTipoPagamentoLista(o.tipo_pagamento)
            const labelPagamento = labelTipoPagamentoLista(o.tipo_pagamento)
            const isDelivery = ordineIsDelivery(o)
            const indirizzoSecondaRiga = isDelivery ? deliveryIndirizzoRiga(o) : ""
            const idOrdine = `#${o.numero ?? o.numero_ordine ?? o.numeroOrdine ?? "—"}`
            const ann = ordineIsAnnullato(o)
            const pendingAccept = ordineRichiedeAccettazioneCassa(o)
            return (
              <li key={o.id}>
                <button
                  type="button"
                  style={{
                    ...styles.ordiniItem,
                    ...cassaMobileShell.ordiniItemExtra,
                    width: "100%",
                    boxSizing: "border-box",
                    ...(ann ? { opacity: 0.72, borderLeft: "3px solid #b71c1c" } : {}),
                    ...(!ann && pendingAccept ? { borderLeft: "3px solid #ea580c" } : {}),
                  }}
                  onClick={() => openOrdineDetail(o.id)}
                  title="Apri dettaglio"
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <OrdineCardTitleRows o={o} isDelivery={isDelivery} />
                      <div
                        style={{
                          fontSize: cassaMobileLayout ? 13 : 11,
                          color: "#666",
                          marginTop: 4,
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          flexWrap: "wrap",
                        }}
                      >
                        <span>{idOrdine}</span>
                        {ann ? (
                          <span style={{ color: "#b71c1c", fontWeight: 700 }}>Annullato</span>
                        ) : null}
                        {!ann && pendingAccept ? (
                          <span style={{ color: "#c2410c", fontWeight: 700 }}>Da accettare</span>
                        ) : null}
                      </div>
                      {indirizzoSecondaRiga ? (
                        <div style={{ fontSize: cassaMobileLayout ? 13 : 11, color: "#555", marginTop: 2 }}>{indirizzoSecondaRiga}</div>
                      ) : null}
                    </div>
                    <span style={{ fontSize: cassaMobileLayout ? 16 : 14 }}>€ {typeof o.totale === "number" ? o.totale.toFixed(2) : o.totale ?? "—"}</span>
                    <span style={{ fontSize: 12, marginLeft: 4 }} title={labelPagamento}>{iconPagamento}</span>
                  </div>
                </button>
              </li>
            )
          })}
        </ul>
      </div>
      ) : null}
      <div
        ref={cassaProductsAreaRef}
        style={{
          ...styles.productsArea,
          ...cassaMobileShell.productsExtra,
          ...(showPlanningBar
            ? {
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
                padding: 12,
                minHeight: 0,
                flex: 1,
                minWidth: 0,
                width: "100%",
              }
            : {}),
        }}
      >
        {showPlanningBar ? (
          <CassaPlanningBoard
            rows={planningMergedRows}
            pizzePerOrdine={pizzePerOrdine}
            parametri={tenantData?.parametri_operativi}
            tenantId={tenantId}
            canEditPony={canAnnullaOrdineCassa || fullDemoAccess}
            maxPizzeForno={maxPizzeFornoUnico}
            onClose={() => setShowPlanningBar(false)}
            onOpenOrdine={(id) => void openOrdineDetail(id)}
            ordiniOnlineToggle={
              <button
                type="button"
                disabled={
                  ordiniOnlineToggleSaving ||
                  !tenantId ||
                  (ordiniOnlineDisabilitati && !ordiniOnlineInLicenza)
                }
                onClick={() => {
                  if (!tenantId || ordiniOnlineToggleSaving) return
                  const nextDisabilitati = !ordiniOnlineDisabilitati
                  if (!nextDisabilitati && !ordiniOnlineInLicenza) {
                    window.alert(
                      "Il servizio «Ordini online» non è incluso nella licenza del locale (Super Admin). Non è possibile abilitare la vetrina.",
                    )
                    return
                  }
                  setOrdiniOnlineToggleSaving(true)
                  const base =
                    tenantData?.parametri_operativi && typeof tenantData.parametri_operativi === "object"
                      ? tenantData.parametri_operativi
                      : {}
                  const po = { ...base, ordini_online_attivi: !nextDisabilitati }
                  void updateTenantSettings(tenantId, { parametri_operativi: po })
                    .then(() => refreshTenant())
                    .catch((err) => {
                      console.error(err)
                      window.alert(err?.message || "Salvataggio non riuscito")
                    })
                    .finally(() => setOrdiniOnlineToggleSaving(false))
                }}
                style={{
                  padding: "7px 12px",
                  borderRadius: 999,
                  border: "1px solid transparent",
                  background: ordiniOnlineDisabilitati ? "#c62828" : "#2e7d32",
                  color: "#fff",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: ordiniOnlineToggleSaving || !tenantId ? "default" : "pointer",
                  opacity: ordiniOnlineToggleSaving ? 0.75 : 1,
                }}
              >
                {ordiniOnlineToggleSaving
                  ? "Salvataggio…"
                  : ordiniOnlineDisabilitati
                    ? "Ordini online disattivi"
                    : "Ordini online attivi"}
              </button>
            }
          />
        ) : null}

        {planningSlotModal && (
          <div style={styles.modalOverlay} onClick={() => setPlanningSlotModal(null)} role="dialog" aria-modal="true">
            <div style={{ ...styles.detailModal, maxWidth: 520, width: "95%" }} onClick={(e) => e.stopPropagation()}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <h3 style={{ margin: 0 }}>
                  Ordini · {planningSlotModal.slotLabel} ·{" "}
                  {planningSlotModal.type === "delivery"
                    ? "Consegne"
                    : planningSlotModal.type === "ritiro"
                      ? "Ritiro negozio"
                      : "Totale fascia"}
                </h3>
                <button type="button" style={styles.planningBarClose} onClick={() => setPlanningSlotModal(null)}>✕</button>
              </div>
              {planningSlotModal.ordini.length === 0 ? (
                <p style={{ color: "#666" }}>Nessun ordine in questa fascia.</p>
              ) : (
                <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                  {planningSlotModal.ordini.map((o) => {
                    const isDelivery =
                      planningSlotModal.type === "delivery" ||
                      o._planningCanale === "delivery" ||
                      (planningSlotModal.type === "totale" && ordineIsDelivery(o))
                    const nome = ordineNomeCliente(o) || "—"
                    const indirizzo = ordineIndirizzoConsegna(o)
                    const numero = o.numero ?? o.numero_ordine ?? o.numeroOrdine ?? "—"
                    const orarioCorrente = ordineOrarioRitiro(o)
                    const loading = planningSpostaLoading === o.id
                    return (
                      <li key={o.id} style={{ borderBottom: "1px solid #eee", padding: "12px 0" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
                          <div
                            style={{ flex: 1, minWidth: 0, cursor: "pointer" }}
                            role="button"
                            tabIndex={0}
                            onClick={() => {
                              void openOrdineDetail(o.id)
                              setPlanningSlotModal(null)
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                void openOrdineDetail(o.id)
                                setPlanningSlotModal(null)
                              }
                            }}
                            title="Apri riepilogo ordine"
                          >
                            <div style={{ fontWeight: 600 }}>
                              #{numero} · {nome}
                              {planningSlotModal.type === "totale" ? (
                                <span
                                  style={{
                                    marginLeft: 8,
                                    fontSize: 11,
                                    fontWeight: 600,
                                    color: isDelivery ? "#1565c0" : "#7b1fa2",
                                  }}
                                >
                                  {isDelivery ? "consegna" : "ritiro"}
                                </span>
                              ) : null}
                            </div>
                            {isDelivery && indirizzo && (
                              <div style={{ fontSize: 12, color: "#555", marginTop: 4 }}>
                                {formatIndirizzoDisplayItaliano(indirizzo)}
                              </div>
                            )}
                            <div style={{ fontSize: 12, color: "#666", marginTop: 2 }}>€ {typeof o.totale === "number" ? o.totale.toFixed(2) : o.totale ?? "—"}</div>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <button
                              type="button"
                              onClick={() => {
                                void openOrdineDetail(o.id)
                                setPlanningSlotModal(null)
                              }}
                              style={{ ...styles.impostazioniBtn, marginTop: 0, background: "#1565c0", color: "#fff", padding: "6px 10px" }}
                              title="Apri riepilogo ordine"
                            >
                              Riepilogo
                            </button>
                            <label style={{ fontSize: 12, fontWeight: 500 }}>Sposta a:</label>
                            <select
                              value={orarioCorrente}
                              onChange={(e) => {
                                const val = e.target.value
                                if (val && val !== orarioCorrente) handleSpostaOrdinePlanning(o.id, val)
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

        {!showPlanningBar ? (
          <>
            <div style={{ marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
              <input
                type="text"
                placeholder="Cerca pizza..."
                value={searchPizza}
                onChange={(e) => setSearchPizza(e.target.value)}
                style={{
                  flex: 1,
                  padding: cassaMobileLayout ? "12px 14px" : "10px 14px",
                  borderRadius: 8,
                  border: "1px solid #ddd",
                  fontSize: cassaMobileLayout ? 16 : 14,
                  minHeight: cassaMobileLayout ? 48 : undefined,
                  boxSizing: "border-box",
                }}
              />
            </div>
            <CategoryTabs
              categories={categories}
              activeCategory={activeCategory}
              onSelect={setActiveCategory}
              compact={cassaMobileLayout}
            />

            <ProductGrid
              products={filteredProducts}
              ingredientiMap={productIngredientiMap}
              rowBackground={menuRowBackground}
              onAdd={addToCart}
              onModifica={(p) => {
                setPizzaModalEditCartLine(null)
                setProductToAdd(p)
                setProductModalOpen(true)
              }}
              showModifica={showModificaCategoria}
              disabledProductIds={disabledProductIds}
              layoutDensity={cassaMobileLayout ? "comfortable" : "default"}
            />
          </>
        ) : null}
      </div>

      {!(showPlanningBar && !cassaMobileLayout) ? (
      <div style={{ ...styles.riepilogoSection, ...cassaMobileShell.cartExtra }}>
        <Cart
          cart={cart}
          total={total}
          tipoOrdine={tipoOrdine}
          deliverySearch={deliverySearch}
          onIncrease={increaseQty}
          onDecrease={decreaseQty}
          onRemove={(item) => setCart((prev) => prev.filter((p) => p !== item))}
          onEditPizza={openModificaPizzaFromCart}
          onCheckout={openRiepilogo}
          onClear={clearCart}
          checkoutError={checkoutError}
          loading={false}
          variant={cassaMobileLayout ? "mobile" : "default"}
        />
      </div>
      ) : null}

      <ModificaPizzaModal
        open={productModalOpen}
        onClose={closePizzaModal}
        product={productToAdd}
        tenantId={tenantId}
        tipoOrdine={tipoOrdine}
        parametri={tenantData?.parametri_operativi}
        onConfirm={confirmModificaPizza}
        prefillFromProduct={Boolean(pizzaModalEditCartLine)}
      />

      <NuovoClienteModal
        open={nuovoClienteModalOpen}
        onClose={() => setNuovoClienteModalOpen(false)}
        tenantId={tenantId}
        onSuccess={handleNuovoClienteSuccess}
        parametriOperativi={tenantData?.parametri_operativi}
      />

      <NuovoClienteModal
        key={selectedCliente?.id ? `anagrafica-${selectedCliente.id}` : "anagrafica-none"}
        open={profiloClienteModalOpen}
        onClose={() => setProfiloClienteModalOpen(false)}
        tenantId={tenantId}
        onSuccess={handleProfiloClienteSuccess}
        initialData={selectedCliente}
        parametriOperativi={tenantData?.parametri_operativi}
      />

      {clienteDomicilioQuickOpen && selectedCliente ? (
        <div
          style={styles.modalOverlay}
          onClick={() => setClienteDomicilioQuickOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="cliente-dom-quick-title"
        >
          <div style={{ ...styles.detailModal, maxWidth: 420, width: "92%" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <h3 id="cliente-dom-quick-title" style={{ margin: 0, fontSize: 17 }}>
                Cliente consegna
              </h3>
              <button
                type="button"
                style={styles.planningBarClose}
                onClick={() => setClienteDomicilioQuickOpen(false)}
                aria-label="Chiudi"
              >
                ✕
              </button>
            </div>
            <div style={{ fontSize: 14, lineHeight: 1.55, color: "#333" }}>
              <p style={{ margin: "0 0 8px", fontWeight: 700 }}>{selectedCliente.nome || "—"}</p>
              {selectedCliente.indirizzo ? (
                <p style={{ margin: "0 0 8px" }}>{formatIndirizzoDisplayItaliano(selectedCliente.indirizzo)}</p>
              ) : null}
              {selectedCliente.telefono ? (
                <p style={{ margin: "0 0 8px" }}>
                  <span style={{ color: "#666" }}>Tel. </span>
                  {selectedCliente.telefono}
                </p>
              ) : null}
              {selectedCliente.email ? (
                <p style={{ margin: "0 0 12px", wordBreak: "break-word" }}>
                  <span style={{ color: "#666" }}>Email </span>
                  {selectedCliente.email}
                </p>
              ) : null}
            </div>
            <button type="button" style={styles.impostazioniBtn} onClick={() => setClienteDomicilioQuickOpen(false)}>
              Continua ordine
            </button>
          </div>
        </div>
      ) : null}

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
              <h3 style={{ margin: 0 }}>Ordine #{ordineDetail.numero ?? ordineDetail.numero_ordine ?? ordineDetail.numeroOrdine ?? "—"}</h3>
              <button type="button" style={styles.planningBarClose} onClick={() => setOrdineDetail(null)}>✕</button>
            </div>
            {ordineIsAnnullato(ordineDetail) ? (
              <p
                style={{
                  margin: "0 0 12px",
                  padding: "8px 10px",
                  background: "#ffebee",
                  color: "#b71c1c",
                  borderRadius: 6,
                  fontWeight: 600,
                  fontSize: 14,
                }}
              >
                Ordine annullato — escluso da planning e dai totali giornata.
              </p>
            ) : null}
            {ordineRichiedeAccettazioneCassa(ordineDetail) && !ordineIsAnnullato(ordineDetail) ? (
              <div
                style={{
                  margin: "0 0 12px",
                  padding: "10px 12px",
                  background: "#fff7ed",
                  border: "1px solid #fdba74",
                  borderRadius: 8,
                  fontSize: 14,
                  lineHeight: 1.45,
                }}
              >
                <p style={{ margin: "0 0 10px", fontWeight: 600, color: "#9a3412" }}>
                  In attesa di accettazione cassa — non ancora in cucina.
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  <button
                    type="button"
                    disabled={accettazioneWebBusy}
                    onClick={() => void handleAccettaOrdineWeb(ordineDetail.id)}
                    style={{
                      padding: "8px 12px",
                      borderRadius: 8,
                      border: "none",
                      background: "#16a34a",
                      color: "#fff",
                      fontWeight: 600,
                      cursor: accettazioneWebBusy ? "default" : "pointer",
                      opacity: accettazioneWebBusy ? 0.7 : 1,
                    }}
                  >
                    Accetta
                  </button>
                  <button
                    type="button"
                    disabled={accettazioneWebBusy}
                    onClick={() => openModificaOrdine(ordineDetail)}
                    style={{
                      padding: "8px 12px",
                      borderRadius: 8,
                      border: "1px solid #c2410c",
                      background: "#fff",
                      color: "#9a3412",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Sposta orario
                  </button>
                  <button
                    type="button"
                    disabled={accettazioneWebBusy}
                    onClick={() => void handleRifiutaOrdineWeb(ordineDetail.id)}
                    style={{
                      padding: "8px 12px",
                      borderRadius: 8,
                      border: "none",
                      background: "#b91c1c",
                      color: "#fff",
                      fontWeight: 600,
                      cursor: accettazioneWebBusy ? "default" : "pointer",
                      opacity: accettazioneWebBusy ? 0.7 : 1,
                    }}
                  >
                    Rifiuta
                  </button>
                </div>
              </div>
            ) : null}
            <p style={{ margin: "0 0 8px", color: "#666" }}>
              {ordineIsDelivery(ordineDetail) ? "Consegna" : "Ritiro in negozio"}
            </p>
            {ordineIsDelivery(ordineDetail) && ordineIndirizzoConsegna(ordineDetail) && (
              <p style={{ margin: "0 0 12px", fontWeight: 500 }}>
                Indirizzo: {formatIndirizzoDisplayItaliano(ordineIndirizzoConsegna(ordineDetail))}
              </p>
            )}
            {!ordineIsDelivery(ordineDetail) && (
              <>
                {ordineNomeCliente(ordineDetail) && (
                  <p style={{ margin: "0 0 4px", fontWeight: 500 }}>Cliente: <strong>{ordineNomeCliente(ordineDetail)}</strong></p>
                )}
                {ordineTelefonoRitiro(ordineDetail) ? (
                  <p style={{ margin: "0 0 4px", color: "#555" }}>Tel. (ritiro): <strong>{ordineTelefonoRitiro(ordineDetail)}</strong></p>
                ) : null}
                {ordineOrarioRitiro(ordineDetail) && (
                  <p style={{ margin: "0 0 12px", color: "#555" }}>Orario ritiro: {ordineOrarioRitiro(ordineDetail)}</p>
                )}
              </>
            )}
            <ul style={{ listStyle: "none", padding: 0, margin: "0 0 12px", borderTop: "1px solid #eee", paddingTop: 12 }}>
              {(ordineDetail.righe || []).map((r, i) => {
                const nomeProdotto = ordineDetail.productNames?.[r.prodottoId ?? r.prodotto_id] ?? "—"
                const formatoNome = r.formatoNome ?? r.formato_nome
                const label = formatoNome ? `${nomeProdotto} (${formatoNome})` : nomeProdotto
                const ing = r.ingredientiCotturaSummary ?? r.ingredienti_cottura_summary ?? ""
                const modsOnly = extractModificheFromIngredientiSummary(ing)
                return (
                  <li key={r.id || i} style={{ padding: "8px 0", borderBottom: "1px dashed #eee" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                      <span>{label} × {r.quantita}</span>
                      <span>€ {(Number(r.prezzo) * (r.quantita || 1)).toFixed(2)}</span>
                    </div>
                    {modsOnly ? (
                      <div style={{ fontSize: 12, color: "#b71c1c", marginTop: 4, lineHeight: 1.35, fontWeight: 700 }}>
                        {modsOnly}
                      </div>
                    ) : null}
                  </li>
                )
              })}
            </ul>
            <p style={{ fontWeight: 600, marginBottom: 12 }}>Totale: € {typeof ordineDetail.totale === "number" ? ordineDetail.totale.toFixed(2) : ordineDetail.totale ?? "—"}</p>
            <p style={{ marginBottom: 12, fontSize: 13 }}>
              Pagamento:{" "}
              {tipoPagamentoInAttesa(ordineDetail.tipo_pagamento)
                ? isTipoPagamentoLink(ordineDetail.tipo_pagamento)
                  ? TIPO_PAGAMENTO_PAGA_ONLINE
                  : "⏳ Da pagare"
                : ordineDetail.tipo_pagamento || "—"}
            </p>
            {(ordinePuntoVenditaId(ordineDetail) || ordineTurnoOperatoriId(ordineDetail) != null) ? (
              <p style={{ marginBottom: 12, fontSize: 12, color: "#555", lineHeight: 1.45 }}>
                {ordinePuntoVenditaId(ordineDetail) ? (
                  <>
                    Punto vendita:{" "}
                    <strong>
                      {(() => {
                        const id = ordinePuntoVenditaId(ordineDetail)
                        const nome = pvList.find((p) => String(p.id) === String(id))?.nome
                        return nome ? `${nome}` : id.slice(0, 8) + "…"
                      })()}
                    </strong>
                  </>
                ) : null}
                {ordineTurnoOperatoriId(ordineDetail) != null ? (
                  <>
                    {ordinePuntoVenditaId(ordineDetail) ? " · " : null}
                    Turno cassa: <strong>#{ordineTurnoOperatoriId(ordineDetail)}</strong>
                  </>
                ) : null}
              </p>
            ) : null}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
              {!ordineIsAnnullato(ordineDetail) && ordineIsDelivery(ordineDetail) ? (
                <button
                  type="button"
                  style={{ ...styles.impostazioniBtn, marginTop: 8, background: "#455a64", color: "#fff" }}
                  onClick={async () => {
                    try {
                      await updateOrder(ordineDetail.id, { tipo_ordine: TIPO_ORDINE.NEGOZIO, indirizzo_consegna: null })
                      await loadOrdini()
                      await openOrdineDetail(ordineDetail.id)
                    } catch (e) {
                      console.error(e)
                      alert("Errore passaggio a ritiro in negozio. " + (e?.message || ""))
                    }
                  }}
                >
                  Passa a ritiro in negozio
                </button>
              ) : null}
              <button
                type="button"
                style={{ ...styles.impostazioniBtn, marginTop: 8, background: "#6a1b9a", color: "#fff" }}
                onClick={() => {
                  const payload = ricevutaPayloadFromOrdineDetail(ordineDetail, tenantData)
                  if (payload) printRicevuta(payload)
                }}
              >
                {canRepartoStampareRicevutaCortesia(tenantData?.parametri_operativi, "cassa")
                  ? "Stampa ricevuta di cortesia"
                  : "Stampa ricevuta"}
              </button>
              <button
                type="button"
                style={{ ...styles.impostazioniBtn, marginTop: 8, background: "#1565c0" }}
                onClick={() => {
                  const payload = comandaPayloadFromOrdineDetail(ordineDetail, tenantData)
                  if (payload) printComandaKitchen(payload)
                }}
              >
                Stampa comanda
              </button>
              {haStampantiReparto && (
                <button
                  type="button"
                  style={{ ...styles.impostazioniBtn, marginTop: 8, background: "#37474f", color: "#fff" }}
                  onClick={() => {
                    const payload = comandaPayloadFromOrdineDetail(ordineDetail, tenantData)
                    if (payload) printComandaKitchenPerReparto(payload)
                  }}
                >
                  Stampa per reparto
                </button>
              )}
              {!ordineIsAnnullato(ordineDetail) && isTipoPagamentoLink(ordineDetail.tipo_pagamento) ? (
                <button
                  type="button"
                  style={{ ...styles.impostazioniBtn, marginTop: 8, background: "#2e7d32", color: "#fff" }}
                  onClick={() => {
                    const tot =
                      typeof ordineDetail.totale === "number"
                        ? ordineDetail.totale
                        : Number(ordineDetail.totale) || 0
                    setPostCheckoutPayLink({
                      orderId: ordineDetail.id,
                      importoCent: Math.max(1, Math.round(tot * 100)),
                    })
                    setPayLinkPhone(String(ordineDetail.telefono || ordineDetail.telefono_ritiro || "").trim())
                    setPayLinkMessage("")
                    setOrdineDetail(null)
                  }}
                >
                  Link pagamento (invia / registra)
                </button>
              ) : null}
              {!ordineIsAnnullato(ordineDetail) && tipoPagamentoInAttesa(ordineDetail.tipo_pagamento) ? (
                <button
                  type="button"
                  style={{ ...styles.impostazioniBtn, marginTop: 8 }}
                  onClick={() => setSegnaPagatoModal(ordineDetail.id)}
                >
                  Segna come pagato
                </button>
              ) : null}
              {!ordineIsAnnullato(ordineDetail) ? (
                <button
                  type="button"
                  style={{ ...styles.impostazioniBtn, marginTop: 8 }}
                  onClick={() => openModificaOrdine(ordineDetail)}
                >
                  Modifica
                </button>
              ) : null}
              {canAnnullaOrdineCassa && !ordineIsAnnullato(ordineDetail) ? (
                <button
                  type="button"
                  style={{ ...styles.impostazioniBtn, marginTop: 8, background: "#b71c1c", color: "#fff" }}
                  onClick={() => handleAnnullaOrdine(ordineDetail.id)}
                >
                  Annulla ordine
                </button>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {segnaPagatoModal && (
        <div style={styles.modalOverlay} onClick={() => setSegnaPagatoModal(null)} role="dialog" aria-modal="true">
          <div style={styles.detailModal} onClick={(e) => e.stopPropagation()}>
            <p style={{ margin: "0 0 12px", fontWeight: 600 }}>Segna ordine come pagato</p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {(isOrdineOnlineCanale(
                (ordiniOggiAttivi || []).find((o) => o.id === segnaPagatoModal) ||
                  (ordineDetail?.id === segnaPagatoModal ? ordineDetail : null),
              )
                ? tipiPagamentoOrdineOnline
                : tipiPagamentoCassa
              )
                .filter((t) => t === TIPO_PAGAMENTO_CONTANTI || t === TIPO_PAGAMENTO_CARTA)
                .map((t) => (
                  <button
                    key={t}
                    type="button"
                    style={styles.impostazioniBtn}
                    onClick={() => handleSegnaPagato(segnaPagatoModal, t)}
                  >
                    {t}
                  </button>
                ))}
              <button type="button" style={styles.planningBarToggle} onClick={() => setSegnaPagatoModal(null)}>
                Annulla
              </button>
            </div>
          </div>
        </div>
      )}

      {modificaOrdineModal ? (
        <CassaModificaOrdineModal
          styles={styles}
          ordine={modificaOrdineModal}
          saving={modificaOrdineSaving}
          modificaForm={modificaForm}
          setModificaForm={setModificaForm}
          modificaRighe={modificaRighe}
          setModificaRighe={setModificaRighe}
          modificaProdottiList={modificaProdottiList}
          modificaTotaleAnteprima={modificaTotaleAnteprima}
          tipiPagamento={
            isOrdineOnlineCanale(modificaOrdineModal) ? tipiPagamentoOrdineOnline : tipiPagamentoCassa
          }
          onSave={handleSalvaModificaOrdine}
        />
      ) : null}

      {lastOrderLoading && (
        <div style={styles.modalOverlay}>
          <div style={{ background: "#fff", padding: 24, borderRadius: 8 }}>Caricamento ultimo ordine...</div>
        </div>
      )}

      {lastOrderModalDetail && !lastOrderLoading && (
        <div style={styles.modalOverlay} onClick={() => setLastOrderModalDetail(null)} role="dialog" aria-modal="true">
          <div style={{ ...styles.detailModal, maxWidth: lastOrderModalDetail.mode === "list" ? 520 : 560 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ margin: 0 }}>
                {lastOrderModalDetail.mode === "detail"
                  ? `Ordine #${lastOrderModalDetail.numero ?? lastOrderModalDetail.numero_ordine ?? lastOrderModalDetail.numeroOrdine ?? "—"}`
                  : "Storico ordini"}
              </h3>
              <button type="button" style={styles.planningBarClose} onClick={() => setLastOrderModalDetail(null)}>✕</button>
            </div>
            {lastOrderModalDetail.empty ? (
              <p style={{ color: "#666" }}>Nessun ordine trovato per questo cliente negli ultimi ordini caricati.</p>
            ) : lastOrderModalDetail.error ? (
              <p style={{ color: "#c62828" }}>{lastOrderModalDetail.error}</p>
            ) : lastOrderModalDetail.mode === "list" ? (
              <>
                <p style={{ margin: "0 0 12px", fontSize: 13, color: "#666" }}>
                  Seleziona un ordine (dal più recente). Elenco fino a 400 ordini del locale.
                </p>
                <ul style={{ listStyle: "none", padding: 0, margin: 0, maxHeight: "min(60vh, 420px)", overflowY: "auto" }}>
                  {(lastOrderModalDetail.ordini || []).map((o) => {
                    const num = o.numero ?? o.numero_ordine ?? o.numeroOrdine ?? "—"
                    const when = o.createdAt ?? o.created_at
                    const whenStr = when ? new Date(when).toLocaleString("it-IT") : "—"
                    const incompleto = ordineStatoIncompleto(o)
                    return (
                      <li key={o.id} style={{ borderBottom: "1px solid #eee" }}>
                        <button
                          type="button"
                          onClick={() => loadClienteOrdineDetail(o.id)}
                          disabled={lastOrderDetailLoading}
                          style={{
                            width: "100%",
                            textAlign: "left",
                            padding: "12px 8px",
                            border: "none",
                            background: incompleto ? "#fff7ed" : "transparent",
                            cursor: lastOrderDetailLoading ? "wait" : "pointer",
                            fontSize: 14,
                          }}
                        >
                          <div style={{ fontWeight: 600 }}>
                            #{num} · € {typeof o.totale === "number" ? o.totale.toFixed(2) : o.totale ?? "—"}
                            {incompleto ? (
                              <span style={{ marginLeft: 8, fontSize: 11, color: "#c2410c", fontWeight: 700 }}>
                                Non concluso
                              </span>
                            ) : null}
                          </div>
                          <div style={{ fontSize: 12, color: "#666", marginTop: 4 }}>{whenStr}</div>
                        </button>
                      </li>
                    )
                  })}
                </ul>
                {lastOrderDetailLoading && <p style={{ marginTop: 12, color: "#666" }}>Caricamento dettaglio…</p>}
              </>
            ) : (
              <>
                <button
                  type="button"
                  style={{ ...styles.planningBarToggle, marginBottom: 14 }}
                  onClick={() =>
                    setLastOrderModalDetail({ mode: "list", ordini: lastOrderModalDetail.historyOrdini || [] })
                  }
                >
                  ← Torna all&apos;elenco
                </button>
                <p style={{ margin: "0 0 8px", color: "#666" }}>
                  {ordineIsDelivery(lastOrderModalDetail) ? "Consegna" : "Ritiro in negozio"}
                </p>
                {ordineIsDelivery(lastOrderModalDetail) && ordineIndirizzoConsegna(lastOrderModalDetail) && (
                  <p style={{ margin: "0 0 12px", fontWeight: 500 }}>Indirizzo: {ordineIndirizzoConsegna(lastOrderModalDetail)}</p>
                )}
                {ordineNomeCliente(lastOrderModalDetail) && (
                  <p style={{ margin: "0 0 12px", fontWeight: 500 }}>Cliente: {ordineNomeCliente(lastOrderModalDetail)}</p>
                )}
                {ordineOrarioRitiro(lastOrderModalDetail) && (
                  <p style={{ margin: "0 0 12px", color: "#555" }}>Orario: {ordineOrarioRitiro(lastOrderModalDetail)}</p>
                )}
                <ul style={{ listStyle: "none", padding: 0, margin: "0 0 12px", borderTop: "1px solid #eee", paddingTop: 12 }}>
                  {(lastOrderModalDetail.righe || []).map((r, i) => {
                    const nomeProdotto = lastOrderModalDetail.productNames?.[r.prodottoId ?? r.prodotto_id] ?? "—"
                    const formatoNome = r.formatoNome ?? r.formato_nome
                    const label = formatoNome ? `${nomeProdotto} (${formatoNome})` : nomeProdotto
                    const ing =
                      r.ingredientiCotturaSummary ?? r.ingredienti_cottura_summary ?? ""
                    const modsOnly = extractModificheFromIngredientiSummary(ing)
                    return (
                      <li key={r.id || i} style={{ padding: "8px 0", borderBottom: "1px dashed #eee" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                              <span>{label} × {r.quantita}</span>
                              <span>€ {(Number(r.prezzo) * (r.quantita || 1)).toFixed(2)}</span>
                            </div>
                            {modsOnly ? (
                              <div style={{ fontSize: 12, color: "#b71c1c", marginTop: 4, lineHeight: 1.35, fontWeight: 700 }}>
                                {modsOnly}
                              </div>
                            ) : null}
                          </div>
                          <button
                            type="button"
                            title="Aggiungi questa riga al carrello (con modifiche)"
                            style={{
                              flexShrink: 0,
                              border: "1px solid #cbd5e1",
                              background: "#fff",
                              borderRadius: 8,
                              padding: "6px 10px",
                              fontSize: 12,
                              fontWeight: 700,
                              cursor: "pointer",
                            }}
                            onClick={() => addHistoryLineToCart(r, lastOrderModalDetail)}
                          >
                            Aggiungi
                          </button>
                        </div>
                      </li>
                    )
                  })}
                </ul>
                <p style={{ fontWeight: 600, marginBottom: 12 }}>Totale: € {typeof lastOrderModalDetail.totale === "number" ? lastOrderModalDetail.totale.toFixed(2) : lastOrderModalDetail.totale ?? "—"}</p>
                <p style={{ margin: 0, fontSize: 13 }}>Pagamento: {lastOrderModalDetail.tipo_pagamento || "—"}</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 16 }}>
                  <button
                    type="button"
                    style={{ ...styles.impostazioniBtn, background: "#0f172a" }}
                    onClick={() => recallHistoryOrderToCart(lastOrderModalDetail)}
                  >
                    Ripeti ordine completo
                  </button>
                  <button
                    type="button"
                    style={{ ...styles.impostazioniBtn, background: "#1565c0" }}
                    onClick={() => {
                      const payload = comandaPayloadFromOrdineDetail(lastOrderModalDetail, tenantData)
                      if (payload) printComandaKitchen(payload)
                    }}
                  >
                    Stampa comanda
                  </button>
                  {haStampantiReparto && (
                    <button
                      type="button"
                      style={{ ...styles.impostazioniBtn, background: "#37474f", color: "#fff" }}
                      onClick={() => {
                        const payload = comandaPayloadFromOrdineDetail(lastOrderModalDetail, tenantData)
                        if (payload) printComandaKitchenPerReparto(payload)
                      }}
                    >
                      Stampa per reparto
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
      </div>
      {cassaMobileShell.showTabBar ? (
        <nav className="cassa-mobile-tabbar" aria-label="Sezioni cassa">
          <button
            type="button"
            aria-current={cassaMobileTab === "ordini" ? "true" : undefined}
            onClick={() => setCassaMobileTab("ordini")}
          >
            Ordini
          </button>
          <button
            type="button"
            aria-current={cassaMobileTab === "menu" ? "true" : undefined}
            onClick={() => setCassaMobileTab("menu")}
          >
            Menù
          </button>
          <button
            type="button"
            aria-current={cassaMobileTab === "carrello" ? "true" : undefined}
            onClick={() => setCassaMobileTab("carrello")}
          >
            <span style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "center", flexWrap: "wrap" }}>
              Carrello
              {cart.length > 0 ? (
                <span className="cassa-mobile-tabbar-badge">{cart.length}</span>
              ) : null}
            </span>
          </button>
        </nav>
      ) : null}
    </div>
  )
}

const styles = {
  pageColumn: {
    display: "flex",
    flexDirection: "column",
    height: "100vh",
    width: "100%",
    minHeight: 0,
  },
  wrapper: {
    display: "flex",
    flex: 1,
    minHeight: 0,
  },
  comandaBanner: {
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
    padding: "10px 16px",
    background: "#e8f5e9",
    borderBottom: "1px solid #a5d6a7",
    fontSize: 14,
    color: "#1b5e20",
  },
  comandaBannerBtn: {
    padding: "8px 14px",
    background: "#2e7d32",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    cursor: "pointer",
    fontWeight: 600,
    fontSize: 14,
  },
  comandaBannerDismiss: {
    padding: "8px 14px",
    background: "#fff",
    color: "#333",
    border: "1px solid #ccc",
    borderRadius: 8,
    cursor: "pointer",
    fontSize: 14,
  },
  productsArea: {
    flex: 3,
    padding: "20px",
    overflowY: "auto",
    minHeight: 0,
  },
  topBar: {
    marginBottom: 16,
  },
  tipoOrdineRow: {
    display: "flex",
    gap: 8,
    marginBottom: 12,
  },
  tipoOrdineBtn: cassaTipoOrdineBtn,
  tipoOrdineBtnActive: cassaTipoOrdineBtnActive,
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
  nuovoClienteBtn: cassaNuovoClienteBtn,
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
    zIndex: 2300,
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
    marginBottom: 12,
    padding: "10px 12px",
    background: "#ffffff",
    border: "1px solid #d6e2ee",
    borderRadius: 10,
    boxShadow: "0 2px 8px rgba(15,23,42,0.06)",
    display: "flex",
    flexDirection: "column",
    maxHeight: "min(70vh, 640px)",
    minHeight: 280,
  },
  planningBarHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 6,
    gap: 8,
    flexWrap: "wrap",
    flexShrink: 0,
  },
  planningBarTitleWrap: {
    display: "flex",
    flexDirection: "column",
    gap: 1,
  },
  planningBarTitle: {
    color: "#0f172a",
    fontSize: 15,
  },
  planningBarSubtitle: {
    fontSize: 11,
    color: "#64748b",
  },
  planningBarClose: {
    background: "none",
    border: "none",
    cursor: "pointer",
    fontSize: 16,
    padding: "0 4px",
  },
  planningHint: {
    fontSize: 11,
    color: "#64748b",
    margin: "0 0 8px 0",
    lineHeight: 1.35,
    flexShrink: 0,
  },
  planningMergedTable: {
    border: "1px solid #d6e2ee",
    borderRadius: 8,
    overflow: "hidden",
    marginTop: 0,
    background: "#fff",
    display: "flex",
    flexDirection: "column",
    flex: 1,
    minHeight: 0,
  },
  planningMergedHeader: {
    display: "grid",
    gridTemplateColumns: "52px minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr)",
    gap: 0,
    fontSize: 11,
    fontWeight: 700,
    color: "#333",
    flexShrink: 0,
    position: "sticky",
    top: 0,
    zIndex: 1,
  },
  planningMergedBody: {
    overflowY: "auto",
    flex: 1,
    minHeight: 0,
  },
  planningMergedRow: {
    display: "grid",
    gridTemplateColumns: "52px minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr)",
    gap: 0,
    fontSize: 12,
    borderTop: "1px solid #e2e8f0",
  },
  planningMergedCellTime: {
    padding: "4px 6px",
    background: "#f8fafc",
    borderRight: "1px solid #e2e8f0",
    fontWeight: 700,
    color: "#0f172a",
    fontSize: 12,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  planningMergedHeadCell: {
    padding: "5px 6px",
    borderRight: "1px solid #d6e2ee",
    textAlign: "center",
    fontSize: 11,
    fontWeight: 700,
    color: "#0f172a",
  },
  planningMergedCell: {
    padding: "3px 4px",
    borderRight: "1px solid #d6e2ee",
    borderBottom: "none",
    cursor: "pointer",
    textAlign: "center",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 0,
    minHeight: 28,
    lineHeight: 1.15,
    font: "inherit",
  },
  planningMergedCellMain: {
    fontSize: 13,
    fontWeight: 700,
    color: "#0f172a",
    letterSpacing: 0.02,
  },
  planningMergedCellSep: {
    margin: "0 2px",
    fontWeight: 500,
    color: "#64748b",
  },
  planningMergedCellUnit: {
    fontSize: 9,
    color: "#64748b",
    fontWeight: 500,
    lineHeight: 1.1,
  },
  planningMergedHeadTitle: {
    display: "block",
    fontSize: 12,
    color: "#0f172a",
    fontWeight: 700,
  },
  planningMergedHeadMeta: {
    display: "block",
    marginTop: 2,
    fontSize: 10,
    color: "#475569",
    fontWeight: 500,
  },
  planningMergedHeadMetaStrong: {
    display: "block",
    marginTop: 2,
    fontSize: 11,
    color: "#0f172a",
    fontWeight: 700,
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