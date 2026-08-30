import { useEffect, useMemo, useRef, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { supabase } from "@/lib/supabaseClient"
import { useAuth } from "@/app/contexts/AuthContext"
import { usePublicCart } from "@/app/contexts/PublicCartContext"
import { getPublicTenantInfo } from "@/features/services/publicService"
import Loader from "@/components/feedback/Loader"
import {
  getTodayOrari,
  buildPublicCheckoutDeliverySlots,
  buildPublicCheckoutDeliverySlotsClosedCalendar,
  getWebVetrinaSlotQuarterFilter,
  isSlotAllowedForWebDeliveryFull,
} from "@/features/operative/cassa/utils/planningUtils"
import {
  maxPizzePerSlot,
  cartPizzeCount,
  isSlotFull,
  filterSlotsExcludingFull,
  filterSlotsExcludingPast,
} from "@/features/operative/cassa/utils/slotCapacityUtils"
import { maybeNotifyNewWebOrder } from "@/utils/webOrderNotifications"
import { geocodeAddressForDelivery } from "@/utils/geocodeAddress"
import { getDeliveryPolygonOuterRing, pointInPolygonRing } from "@/utils/deliveryArea"
import { readConsegnaDomicilioAttiva } from "@/utils/fidelityProgramConfig"
import {
  readOrdiniOnlineVetrinaAllowed,
  tenantHasOrdiniOnlineServizioLicenza,
} from "@/utils/ordiniOnlineAttivi"
import { resolveMatchingPuntiVendita } from "@/utils/resolvePvForDelivery"
import {
  OnlinePaymentPlaceholder,
  OnlinePaymentProviderPicker,
} from "@/features/public/components/OnlinePaymentPlaceholder"
import { getCheckoutLiveProviders } from "@/constants/onlinePaymentProviders"
import StripePaymentForm from "@/features/public/components/StripePaymentForm"
import { createStripePaymentIntentForOrdine, createSumUpCheckoutForOrdine, finalizeStripeCheckoutOrdine } from "@/features/public/services/onlinePaymentService"
import { createOrder, fetchVetrinaSlotCaricoOggi } from "@/features/admin/services/adminService"
import {
  isCassaPagamentoContantiAbilitato,
  isCassaPagamentoCartaAbilitato,
  isCassaPagamentoPagaOnlineAbilitato,
  TIPO_PAGAMENTO_CONTANTI,
  TIPO_PAGAMENTO_CARTA,
} from "@/features/operative/cassa/utils/cassaPagamentiOptions"

const PARAMETRI_OPERATIVI_VUOTI = {}

function isTodayClosed(orariSettimana) {
  if (!Array.isArray(orariSettimana) || !orariSettimana.length) return false
  const jsDay = new Date().getDay()
  const giornoKey = (jsDay + 6) % 7
  const row = orariSettimana.find((o) => Number(o.giorno) === giornoKey)
  if (!row) return false
  return !row.aperto
}

export default function PublicOrdineCheckoutPage() {
  const navigate = useNavigate()
  const { user, tenantId: authTenantId } = useAuth()
  const { items, total, clearCart, totalQty } = usePublicCart()
  const [tenant, setTenant] = useState(null)
  const [clienteRow, setClienteRow] = useState(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  /**
   * Bug trovato in audit: senza questa chiave, una connessione instabile (molto comune su mobile
   * durante il checkout — es. rete che scatta proprio mentre l'ordine parte) fa vedere un errore
   * al cliente anche quando l'ordine è stato creato lato server; il cliente riprova e si ritrova
   * con due ordini (e, se paga online, potenzialmente due addebiti). Una chiave stabile per tutto
   * il montaggio della pagina fa sì che i retry dello stesso tentativo restituiscano lo stesso
   * ordine invece di crearne uno nuovo (create_order_with_items la supporta già via
   * p_idempotency_key, semplicemente non era mai stata collegata qui).
   */
  const idempotencyKeyRef = useRef(null)
  const [address, setAddress] = useState("")
  const [coords, setCoords] = useState(null)
  const [geoBusy, setGeoBusy] = useState(false)
  const [selectedSlot, setSelectedSlot] = useState(null)
  const [paymentMode, setPaymentMode] = useState("contanti")
  const [puntiVendita, setPuntiVendita] = useState([])
  const [selectedPvId, setSelectedPvId] = useState(null)
  const [pvMatchIds, setPvMatchIds] = useState([])
  /** Aggiorna le fasce disponibili quando passa il minuto (regola lead-time). */
  const [slotTick, setSlotTick] = useState(0)
  /** Checkout online: dopo creazione ordine, clientSecret per Stripe Elements */
  const [stripeCheckout, setStripeCheckout] = useState(null)
  const [selectedOnlineProvider, setSelectedOnlineProvider] = useState("")
  const [slotCarico, setSlotCarico] = useState({})

  const checkoutLiveProviders = useMemo(() => getCheckoutLiveProviders(tenant), [tenant])

  useEffect(() => {
    if (checkoutLiveProviders.length === 1) {
      setSelectedOnlineProvider(checkoutLiveProviders[0].provider_key)
    } else if (
      selectedOnlineProvider &&
      !checkoutLiveProviders.some((p) => p.provider_key === selectedOnlineProvider)
    ) {
      setSelectedOnlineProvider("")
    }
  }, [checkoutLiveProviders, selectedOnlineProvider])

  useEffect(() => {
    let c = false
    ;(async () => {
      try {
        const t = await getPublicTenantInfo()
        if (!c) setTenant(t)
        if (user?.id) {
          const { data } = await supabase
            .from("clienti")
            .select("nome, indirizzo, telefono, email, latitudine, longitudine")
            .eq("id", user.id)
            .maybeSingle()
          if (!c && data) {
            setClienteRow(data)
            setAddress((data.indirizzo || "").trim())
          }
        }
      } finally {
        if (!c) setLoading(false)
      }
    })()
    return () => {
      c = true
    }
  }, [user?.id])

  useEffect(() => {
    if (!tenant?.id || !authTenantId || tenant.id !== authTenantId) return
    let cancelled = false
    void supabase
      .from("punti_vendita")
      .select("id, nome, attivo, consegna_area_poligono")
      .eq("tenant_id", tenant.id)
      .then(({ data, error }) => {
        if (cancelled || error) return
        setPuntiVendita(Array.isArray(data) ? data : [])
      })
    return () => {
      cancelled = true
    }
  }, [tenant?.id, authTenantId])

  useEffect(() => {
    if (!tenant?.id || !authTenantId || tenant.id !== authTenantId) return
    let cancelled = false
    void fetchVetrinaSlotCaricoOggi(tenant.id)
      .then((data) => {
        if (!cancelled) setSlotCarico(data || {})
      })
      .catch(() => {
        if (!cancelled) setSlotCarico({})
      })
    const refresh = setInterval(() => {
      void fetchVetrinaSlotCaricoOggi(tenant.id).then((data) => {
        if (!cancelled) setSlotCarico(data || {})
      })
    }, 60 * 1000)
    return () => {
      cancelled = true
      clearInterval(refresh)
    }
  }, [tenant?.id, authTenantId])

  useEffect(() => {
    const id = setInterval(() => setSlotTick((n) => n + 1), 60 * 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (paymentMode !== "online") setStripeCheckout(null)
  }, [paymentMode])

  const orariOggi = useMemo(() => getTodayOrari(tenant?.orari_settimana), [tenant?.orari_settimana])
  const parametri = useMemo(() => {
    const po = tenant?.parametri_operativi
    return po && typeof po === "object" ? po : PARAMETRI_OPERATIVI_VUOTI
  }, [tenant?.parametri_operativi])
  // Con accettazione manuale in cassa il pagamento online NON va offerto in vetrina: se il locale
  // rifiuta un ordine già pagato, il rimborso è complicato. In manuale il cliente paga solo alla
  // consegna/ritiro (contanti o carta al POS).
  const accettazioneManualeCassa =
    String(parametri.ordini_web_accettazione_mode || "auto").toLowerCase() === "manuale"
  const payContantiOk = isCassaPagamentoContantiAbilitato(parametri)
  const payCartaOk = isCassaPagamentoCartaAbilitato(parametri)
  const payOnlineOk =
    isCassaPagamentoPagaOnlineAbilitato(parametri) &&
    checkoutLiveProviders.length > 0 &&
    !accettazioneManualeCassa

  useEffect(() => {
    const allowed = []
    if (payContantiOk) allowed.push("contanti")
    if (payCartaOk) allowed.push("carta")
    if (payOnlineOk) allowed.push("online")
    if (!allowed.length) return
    if (!allowed.includes(paymentMode)) setPaymentMode(allowed[0])
  }, [payContantiOk, payCartaOk, payOnlineOk, paymentMode])

  const consegnaOn = readConsegnaDomicilioAttiva(parametri)
  const ordiniVetrinaConsentiti = readOrdiniOnlineVetrinaAllowed(parametri, tenant)
  const closedToday = isTodayClosed(tenant?.orari_settimana)
  const calendarClosed = closedToday || !orariOggi.aperto
  const quarterFilterUi = useMemo(() => getWebVetrinaSlotQuarterFilter(parametri), [parametri])

  const slots = useMemo(() => {
    void slotTick
    const now = new Date()
    let raw = []
    if (!calendarClosed) {
      raw = buildPublicCheckoutDeliverySlots(orariOggi, now, parametri)
    } else if (ordiniVetrinaConsentiti) {
      raw = buildPublicCheckoutDeliverySlotsClosedCalendar(now, parametri)
    }
    const cartPizze = cartPizzeCount(items)
    const maxPerSlot = maxPizzePerSlot(parametri)
    const notPast = filterSlotsExcludingPast(raw, now)
    return filterSlotsExcludingFull(notPast, slotCarico, cartPizze, maxPerSlot)
  }, [calendarClosed, ordiniVetrinaConsentiti, orariOggi, slotTick, parametri, slotCarico, items])

  // Un ordine con più pizze della capacità massima di UNA fascia non entrerebbe mai, nemmeno in una
  // fascia completamente vuota: in quel caso "Nessuna fascia disponibile" è fuorviante (sembra che
  // il locale sia chiuso/pieno), mentre il problema è solo la quantità di questo ordine.
  const cartTroppoGrandePerUnaFascia = useMemo(
    () => cartPizzeCount(items) > maxPizzePerSlot(parametri),
    [items, parametri],
  )

  useEffect(() => {
    setSelectedSlot((prev) => {
      if (!prev) return prev
      const ok = slots.some((s) => s.key === prev.key)
      return ok ? prev : null
    })
  }, [slots])

  const ring = useMemo(() => getDeliveryPolygonOuterRing(parametri), [parametri])

  const verifyAddress = async () => {
    const addr = address.trim()
    if (!addr) {
      setError("Completa l’indirizzo nel profilo prima di confermare.")
      return
    }
    setGeoBusy(true)
    setError(null)
    try {
      const latSaved = Number(clienteRow?.latitudine)
      const lngSaved = Number(clienteRow?.longitudine)
      let c =
        Number.isFinite(latSaved) &&
        Number.isFinite(lngSaved) &&
        Math.abs(latSaved) <= 90 &&
        Math.abs(lngSaved) <= 180
          ? { lat: latSaved, lng: lngSaved }
          : null
      if (!c) {
        c = await geocodeAddressForDelivery(addr)
      }
      if (!c) {
        setError("Non siamo riusciti a localizzare l’indirizzo del profilo. Aggiornalo dal profilo e riprova.")
        setCoords(null)
        setPvMatchIds([])
        setSelectedPvId(null)
        return
      }

      if (!puntiVendita.length) {
        if (!ring) {
          setError("Area di consegna non configurata dalla pizzeria. Contatta il locale.")
          setCoords(null)
          setPvMatchIds([])
          setSelectedPvId(null)
          return
        }
        const inside = pointInPolygonRing(c.lng, c.lat, ring)
        if (inside === false) {
          setError("L’indirizzo risulta fuori dall’area di consegna coperta dalla pizzeria.")
          setCoords(null)
          setPvMatchIds([])
          setSelectedPvId(null)
          return
        }
        setCoords({ lng: c.lng, lat: c.lat })
        setPvMatchIds([])
        setSelectedPvId(null)
        return
      }

      const { matchIds, reason } = resolveMatchingPuntiVendita(puntiVendita, c.lng, c.lat, parametri)
      if (reason === "nessuna_sede") {
        setError("Nessuna sede attiva configurata. Contatta la pizzeria.")
        setCoords(null)
        setPvMatchIds([])
        setSelectedPvId(null)
        return
      }
      if (reason === "nessun_poligono") {
        setError("Area di consegna non configurata (né per il locale né per le sedi). Contatta la pizzeria.")
        setCoords(null)
        setPvMatchIds([])
        setSelectedPvId(null)
        return
      }
      if (matchIds.length === 0) {
        setError("L’indirizzo risulta fuori dall’area di consegna coperta dalla pizzeria.")
        setCoords(null)
        setPvMatchIds([])
        setSelectedPvId(null)
        return
      }

      setCoords({ lng: c.lng, lat: c.lat })
      setPvMatchIds(matchIds)
      if (matchIds.length === 1) {
        setSelectedPvId(matchIds[0])
      } else {
        setSelectedPvId(null)
      }
    } finally {
      setGeoBusy(false)
    }
  }

  const nomeCliente = useMemo(() => {
    const n = (clienteRow?.nome || "").trim()
    if (n) return n
    const meta = user?.user_metadata
    return (meta?.nome || "").trim() || (user?.email || "").split("@")[0] || "Cliente"
  }, [clienteRow?.nome, user])

  const telefonoCliente = useMemo(
    () => String(clienteRow?.telefono || "").trim(),
    [clienteRow?.telefono],
  )

  const emailCliente = useMemo(
    () => String(clienteRow?.email || user?.email || "").trim(),
    [clienteRow?.email, user?.email],
  )

  const profiloCompleto = Boolean(address.trim() && nomeCliente && telefonoCliente)

  const tenantOk = tenant?.id && authTenantId && tenant.id === authTenantId

  /** Verifica automatica dell’indirizzo dal profilo. */
  useEffect(() => {
    if (!address.trim() || !tenantOk) return
    if (coords) return
    const t = window.setTimeout(() => {
      void verifyAddress()
    }, 200)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- auto solo su indirizzo/tenant/PV
  }, [address, tenantOk, puntiVendita.length])

  const submit = async (e) => {
    e.preventDefault()
    setError(null)
    if (stripeCheckout) {
      setError("Completa il pagamento con carta qui sopra, oppure torna a «Pagamento alla consegna» per annullare questo passaggio.")
      return
    }
    if (!tenantOk || !authTenantId) {
      setError("Sessione o pizzeria non valida. Esci e accedi di nuovo.")
      return
    }
    if (!items.length) {
      setError("Il carrello è vuoto.")
      return
    }
    if (!consegnaOn) {
      setError("La consegna a domicilio non è attiva per questo locale.")
      return
    }
    if (calendarClosed && !ordiniVetrinaConsentiti) {
      setError("Oggi il locale è chiuso.")
      return
    }
    if (!selectedSlot) {
      setError("Seleziona una fascia oraria di consegna.")
      return
    }
    if (!isSlotAllowedForWebDeliveryFull(selectedSlot.date, new Date(), parametri)) {
      setError(
        "La fascia scelta non è più disponibile: serve almeno un intervallo di preparazione (non si può prenotare il quarto d’ora subito dopo l’orario attuale). Aggiorna le fasce e riprova.",
      )
      return
    }
    const maxPerSlot = maxPizzePerSlot(parametri)
    if (isSlotFull(selectedSlot.key, slotCarico, cartPizzeCount(items), maxPerSlot)) {
      setError("La fascia oraria selezionata è al completo (capacità forno). Scegli un’altra fascia.")
      return
    }
    if (!coords) {
      setError(
        address.trim()
          ? "L’indirizzo del profilo non risulta ancora verificato nell’area di consegna. Attendi la verifica o aggiorna l’indirizzo dal profilo."
          : "Completa indirizzo e telefono nel profilo prima di confermare.",
      )
      return
    }
    if (puntiVendita.length > 0 && !selectedPvId) {
      setError("L’indirizzo ricade in più zone: scegli la sede in cui vuoi ricevere la consegna.")
      return
    }
    const provider =
      paymentMode === "online"
        ? selectedOnlineProvider || (checkoutLiveProviders.length === 1 ? checkoutLiveProviders[0].provider_key : "")
        : ""
    if (paymentMode === "online" && !provider) {
      setError(
        checkoutLiveProviders.length > 1
          ? "Seleziona un gestore di pagamento online."
          : "Pagamento online non ancora configurato dal locale. Scegli pagamento alla consegna oppure riprova più tardi.",
      )
      return
    }

    setSubmitting(true)
    try {
      const statoFinale = paymentMode === "online" ? "IN_ATTESA" : "IN_PREPARAZIONE"
      let tipoPag
      let notePay
      if (paymentMode === "online") {
        tipoPag =
          provider === "stripe"
            ? "Carta (Stripe — in attesa)"
            : provider === "sumup"
              ? "Carta (SumUp — in attesa)"
              : "Carta (online — in attesa)"
        notePay = "Ordine web · consegna · pagamento online da confermare"
      } else if (paymentMode === "carta") {
        tipoPag = TIPO_PAGAMENTO_CARTA
        notePay = "Ordine web · consegna · pagamento carta alla consegna"
      } else {
        tipoPag = TIPO_PAGAMENTO_CONTANTI
        notePay = "Ordine web · consegna · pagamento contanti alla consegna"
      }

      if (!idempotencyKeyRef.current) {
        idempotencyKeyRef.current =
          typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `web-${Date.now()}-${Math.random().toString(36).slice(2)}`
      }

      const orderId = await createOrder(authTenantId, {
        totale: total,
        stato: statoFinale,
        idempotencyKey: idempotencyKeyRef.current,
        items: items.map((p) => ({
          prodotto_id: p.id,
          quantita: p.qty,
          prezzo: p.prezzo,
          formatoNome: p.formatoNome,
          ingredientiCotturaSummary: p.ingredientiCotturaSummary || null,
        })),
        note: notePay,
        tipoPagamento: tipoPag,
        tipoOrdine: "delivery",
        nomeCliente,
        orarioRitiro: selectedSlot.label,
        indirizzoConsegna: address.trim(),
        telefonoRitiro: String(clienteRow?.telefono || "").trim() || undefined,
        consegnaLng: coords.lng,
        consegnaLat: coords.lat,
        puntoVenditaId: puntiVendita.length > 0 ? selectedPvId : null,
      })
      void maybeNotifyNewWebOrder({
        tenantId: authTenantId,
        ordineId: orderId,
        parametri,
      })

      if (paymentMode === "online" && provider === "stripe") {
        const { clientSecret } = await createStripePaymentIntentForOrdine(orderId)
        if (!clientSecret) {
          throw new Error("Risposta pagamento incompleta.")
        }
        setStripeCheckout({ orderId, clientSecret })
        setSubmitting(false)
        return
      }

      if (paymentMode === "online" && provider === "sumup") {
        const redirectUrl = `${window.location.origin}/cliente/ordini?nuovo=${encodeURIComponent(orderId)}&sumup=1`
        const { hostedCheckoutUrl } = await createSumUpCheckoutForOrdine(orderId, redirectUrl)
        if (!hostedCheckoutUrl) {
          throw new Error("Risposta SumUp incompleta (manca URL checkout).")
        }
        clearCart()
        window.location.assign(hostedCheckoutUrl)
        return
      }

      clearCart()
      navigate(`/cliente/ordini?nuovo=${encodeURIComponent(orderId)}`)
    } catch (err) {
      console.error(err)
      setError(err?.message || "Impossibile inviare l’ordine.")
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <Loader />

  if (!tenant) {
    return (
      <div style={{ padding: 24 }}>
        <p>Impossibile caricare i dati della pizzeria.</p>
        <Link to="/">Torna al menù</Link>
      </div>
    )
  }

  if (!tenantOk) {
    return (
      <div style={{ padding: 24, maxWidth: 520, margin: "0 auto" }}>
        <p style={{ color: "#b91c1c", marginBottom: 16 }}>
          Il tuo account non è collegato a questa pizzeria. Accedi dal sito del locale dove ti sei registrato.
        </p>
        <Link to="/login">Vai al login</Link>
      </div>
    )
  }

  if (!ordiniVetrinaConsentiti) {
    const licenzaOk = tenantHasOrdiniOnlineServizioLicenza(tenant)
    return (
      <div style={{ padding: 24, maxWidth: 560, margin: "0 auto" }}>
        <h1 style={{ fontSize: 22, marginBottom: 12 }}>Ordine online non disponibile</h1>
        <p style={{ color: "#64748b", marginBottom: 16 }}>
          {!licenzaOk
            ? "Questo locale non ha il servizio ordini online incluso nel piano licenza (configurazione Super Admin). Puoi consultare il menù; per ordinare contatta la pizzeria."
            : "Il locale ha temporaneamente disattivato gli ordini dalla vetrina. Puoi consultare il menù; per ordinare contatta direttamente la pizzeria."}
        </p>
        <Link to="/" style={{ fontWeight: 600, color: "#c0392b" }}>
          ← Torna al menù
        </Link>
      </div>
    )
  }

  if (!items.length) {
    return (
      <div style={{ padding: 24, maxWidth: 560, margin: "0 auto" }}>
        <h1 style={{ fontSize: 22 }}>Carrello vuoto</h1>
        <p style={{ color: "#64748b" }}>Aggiungi prodotti dal menù prima di ordinare.</p>
        <Link to="/" style={{ fontWeight: 600, color: "#c0392b" }}>
          ← Torna al menù
        </Link>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "24px 16px 48px" }}>
      <h1 style={{ fontSize: 24, marginBottom: 8 }}>Checkout consegna a domicilio</h1>
      <p style={{ color: "#64748b", fontSize: 14, marginBottom: 20 }}>
        Solo consegna ({totalQty} {totalQty === 1 ? "articolo" : "articoli"}) · totale <strong>€ {total.toFixed(2)}</strong>
      </p>

      {!consegnaOn ? (
        <p style={{ padding: 14, background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8, color: "#92400e" }}>
          La consegna a domicilio non è attiva. Contatta la pizzeria.
        </p>
      ) : null}
      {calendarClosed && ordiniVetrinaConsentiti ? (
        <p style={{ padding: 14, background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8, color: "#92400e" }}>
          Il calendario segnala chiusura oggi: con gli ordini online attivi puoi comunque prenotare la consegna nelle fasce
          disponibili.
        </p>
      ) : null}

      <form
        onSubmit={submit}
        onKeyDown={(e) => {
          if (e.key === "Enter" && stripeCheckout && paymentMode === "online") {
            e.preventDefault()
          }
        }}
        style={{ display: "flex", flexDirection: "column", gap: 20 }}
      >
        <section>
          <h2 style={{ fontSize: 16, marginBottom: 8 }}>Dati di consegna</h2>
          <div
            style={{
              padding: "10px 12px",
              borderRadius: 8,
              border: "1px solid #e2e8f0",
              background: "#f8fafc",
              fontSize: 14,
              lineHeight: 1.45,
              color: "#0f172a",
            }}
          >
            <div style={{ fontWeight: 700 }}>
              {nomeCliente}
              {telefonoCliente ? (
                <span style={{ fontWeight: 500, color: "#334155" }}> — {telefonoCliente}</span>
              ) : null}
            </div>
            <div style={{ marginTop: 4, color: "#334155" }}>
              {address.trim() || (
                <span style={{ color: "#b45309" }}>Indirizzo mancante — aggiorna il profilo</span>
              )}
            </div>
            {emailCliente ? (
              <div style={{ marginTop: 4, color: "#64748b", fontSize: 13 }}>{emailCliente}</div>
            ) : null}
          </div>
          <p style={{ margin: "8px 0 0", fontSize: 13, color: "#64748b" }}>
            Per modificare questi dati vai al{" "}
            <Link to="/cliente/profilo" style={{ color: "#0f766e", fontWeight: 600 }}>
              profilo
            </Link>
            .
          </p>
          {!profiloCompleto ? (
            <p style={{ margin: "8px 0 0", fontSize: 13, color: "#b45309" }}>
              Nome, telefono e indirizzo sono necessari per completare l’ordine.
            </p>
          ) : null}
          {geoBusy ? (
            <p style={{ margin: "8px 0 0", fontSize: 13, color: "#64748b" }}>Verifica area di consegna…</p>
          ) : null}
          {address.trim() && !coords && !geoBusy ? (
            <button
              type="button"
              onClick={() => void verifyAddress()}
              style={{
                marginTop: 8,
                padding: "6px 12px",
                borderRadius: 8,
                border: "1px solid #0f766e",
                background: "#fff",
                color: "#0f766e",
                fontWeight: 600,
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              Riprova verifica indirizzo
            </button>
          ) : null}
          {coords && pvMatchIds.length > 1 ? (
            <div style={{ marginTop: 14 }}>
              <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, color: "#0f172a" }}>
                Più sedi coprono questo indirizzo. Dove vuoi ordinare?
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {puntiVendita
                  .filter((pv) => pvMatchIds.includes(String(pv.id)))
                  .map((pv) => {
                    const sel = String(selectedPvId) === String(pv.id)
                    return (
                      <button
                        key={pv.id}
                        type="button"
                        onClick={() => setSelectedPvId(String(pv.id))}
                        style={{
                          padding: "12px 14px",
                          borderRadius: 8,
                          border: sel ? "2px solid #0f766e" : "1px solid #cbd5e1",
                          background: sel ? "#ecfdf5" : "#fff",
                          textAlign: "left",
                          cursor: "pointer",
                          fontWeight: sel ? 700 : 500,
                        }}
                      >
                        {pv.nome || "Sede"}
                      </button>
                    )
                  })}
              </div>
            </div>
          ) : null}
          {coords && puntiVendita.length > 0 && selectedPvId ? (
            <p style={{ marginTop: 10, fontSize: 13, color: "#334155" }}>
              Consegna assegnata a:{" "}
              <strong>{puntiVendita.find((p) => String(p.id) === String(selectedPvId))?.nome || "Sede"}</strong>
            </p>
          ) : null}
        </section>

        <section>
          <h2 style={{ fontSize: 16, marginBottom: 8 }}>Fascia oraria</h2>
          <p style={{ fontSize: 13, color: "#64748b", marginBottom: 10, lineHeight: 1.45 }}>
            Solo fasce ancora disponibili: quelle piene o già passate non compaiono. L’elenco si aggiorna con
            l’orario.
            {quarterFilterUi.enabled ? (
              <>
                {" "}
                Prima delle <strong>{quarterFilterUi.endHour}:00</strong> le consegne sono proposte solo ai minuti{" "}
                <strong>:{String(quarterFilterUi.minute).padStart(2, "0")}</strong>; dalle{" "}
                <strong>{quarterFilterUi.endHour}:00</strong> in poi tutti i quarti d’ora. Configurabile in
                Amministrazione → Parametri operativi.
              </>
            ) : null}
          </p>
          {slots.length === 0 && cartTroppoGrandePerUnaFascia ? (
            <p style={{ color: "#b45309" }}>
              Il tuo ordine è troppo grande per essere preparato in un&apos;unica fascia oraria. Contatta
              direttamente il locale per organizzare la consegna.
            </p>
          ) : slots.length === 0 ? (
            <p style={{ color: "#b45309" }}>
              Nessuna fascia disponibile
              {calendarClosed && ordiniVetrinaConsentiti
                ? " nelle ore rimanenti di oggi (tempi di preparazione, capacità o filtri orari)."
                : " (orario di chiusura, giorno chiuso o fasce piene)."}
            </p>
          ) : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {slots.map((s) => {
                const sel = selectedSlot?.key === s.key
                return (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => setSelectedSlot(s)}
                    style={{
                      padding: "10px 14px",
                      borderRadius: 8,
                      border: sel ? "2px solid #0f766e" : "1px solid #cbd5e1",
                      background: sel ? "#ecfdf5" : "#fff",
                      cursor: "pointer",
                      fontWeight: sel ? 700 : 500,
                    }}
                  >
                    {s.label}
                  </button>
                )
              })}
            </div>
          )}
        </section>

        <section>
          <h2 style={{ fontSize: 16, marginBottom: 8 }}>Pagamento</h2>
          {!payContantiOk && !payCartaOk && !payOnlineOk ? (
            <p style={{ color: "#b45309", fontSize: 14 }}>
              Nessun metodo di pagamento attivo per gli ordini online. Contatta la pizzeria.
            </p>
          ) : null}
          {payContantiOk ? (
            <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, cursor: "pointer" }}>
              <input
                type="radio"
                name="pay"
                checked={paymentMode === "contanti"}
                onChange={() => setPaymentMode("contanti")}
              />
              Contanti (alla consegna)
            </label>
          ) : null}
          {payCartaOk ? (
            <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, cursor: "pointer" }}>
              <input
                type="radio"
                name="pay"
                checked={paymentMode === "carta"}
                onChange={() => setPaymentMode("carta")}
              />
              Carta (POS alla consegna)
            </label>
          ) : null}
          {payOnlineOk ? (
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
              <input
                type="radio"
                name="pay"
                checked={paymentMode === "online"}
                onChange={() => setPaymentMode("online")}
                disabled={checkoutLiveProviders.length === 0}
              />
              Paga online (carta)
            </label>
          ) : null}
          {accettazioneManualeCassa && isCassaPagamentoPagaOnlineAbilitato(parametri) ? (
            <p style={{ margin: "6px 0 0", fontSize: 12, color: "#9a3412", lineHeight: 1.4 }}>
              Il pagamento online non è disponibile perché la pizzeria conferma gli ordini manualmente:
              pagherai alla consegna o al ritiro.
            </p>
          ) : null}
          {paymentMode === "online" ? (
            <>
              <OnlinePaymentProviderPicker
                tenant={tenant}
                selectedKey={selectedOnlineProvider}
                onChange={setSelectedOnlineProvider}
                totalEuro={total}
              />
              <OnlinePaymentPlaceholder
                tenant={tenant}
                totalEuro={total}
                selectedProviderKey={selectedOnlineProvider}
              />
              {stripeCheckout?.clientSecret && selectedOnlineProvider === "stripe" ? (
                <div
                  onKeyDown={(e) => {
                    if (e.key === "Enter") e.preventDefault()
                  }}
                >
                <StripePaymentForm
                  publishableKey={
                    checkoutLiveProviders.find((p) => p.provider_key === "stripe")?.public_config
                      ?.stripe_publishable_key || tenant?.stripe_publishable_key
                  }
                  clientSecret={stripeCheckout.clientSecret}
                  onSuccess={async () => {
                    const oid = stripeCheckout?.orderId
                    if (!oid) return
                    setSubmitting(true)
                    setError(null)
                    try {
                      const fin = await finalizeStripeCheckoutOrdine(oid)
                      clearCart()
                      const q = fin?.deferred
                        ? `nuovo=${encodeURIComponent(oid)}&pay=pending`
                        : `nuovo=${encodeURIComponent(oid)}`
                      navigate(`/cliente/ordini?${q}`)
                    } catch (e) {
                      setError(e?.message || "Conferma pagamento in attesa")
                    } finally {
                      setSubmitting(false)
                    }
                  }}
                  onError={(msg) => setError(msg)}
                />
                </div>
              ) : null}
            </>
          ) : null}
        </section>

        {error ? (
          <p style={{ padding: 12, background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, color: "#991b1b" }}>
            {error}
          </p>
        ) : null}

        {accettazioneManualeCassa ? (
          <p
            style={{
              margin: 0,
              padding: 12,
              background: "#fff7ed",
              border: "1px solid #fdba74",
              borderRadius: 8,
              color: "#9a3412",
              fontSize: 14,
              lineHeight: 1.45,
            }}
          >
            Dopo l&apos;invio, l&apos;ordine resta in attesa di conferma da parte del locale (accettazione in cassa).
            Riceverai l&apos;aggiornamento quando verrà accettato.
          </p>
        ) : null}

        <button
          type="submit"
          disabled={
            submitting ||
            Boolean(stripeCheckout && paymentMode === "online") ||
            !consegnaOn ||
            (calendarClosed && !ordiniVetrinaConsentiti)
          }
          style={{
            padding: "14px 20px",
            borderRadius: 10,
            border: "none",
            background: submitting ? "#94a3b8" : "#c0392b",
            color: "#fff",
            fontSize: 16,
            fontWeight: 700,
            cursor: submitting || (stripeCheckout && paymentMode === "online") ? "default" : "pointer",
          }}
        >
          {submitting
            ? "Invio…"
            : stripeCheckout && paymentMode === "online"
              ? "Ordine creato — completa il pagamento sopra"
              : "Conferma ordine"}
        </button>
        {!stripeCheckout && (!coords || !slots.length || (puntiVendita.length > 0 && !selectedPvId)) ? (
          <p style={{ margin: "-8px 0 0", fontSize: 13, color: "#64748b", lineHeight: 1.45 }}>
            Prima di confermare
            {!coords ? ": attendi la verifica dell’indirizzo del profilo (o aggiornalo dal profilo)" : ""}
            {!slots.length ? `${!coords ? "," : ":"} attendi le fasce disponibili` : ""}
            {puntiVendita.length > 0 && !selectedPvId ? " e scegli la sede" : ""}
            . Se manca qualcosa, il pulsante ti mostrerà il messaggio preciso.
          </p>
        ) : null}
      </form>

      <p style={{ marginTop: 20 }}>
        <Link to="/" style={{ color: "#64748b" }}>
          ← Torna al menù
        </Link>
      </p>
    </div>
  )
}
