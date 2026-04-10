import { useEffect, useMemo, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { supabase } from "@/lib/supabaseClient"
import { useAuth } from "@/app/contexts/AuthContext"
import { usePublicCart } from "@/app/contexts/PublicCartContext"
import { getPublicTenantInfo } from "@/features/services/publicService"
import { createOrder } from "@/features/admin/services/adminService"
import Loader from "@/components/feedback/Loader"
import {
  getTodayOrari,
  buildPublicCheckoutDeliverySlots,
  getWebVetrinaSlotQuarterFilter,
  isSlotAllowedForWebDeliveryFull,
} from "@/features/operative/cassa/utils/planningUtils"
import { maybeNotifyNewWebOrder } from "@/utils/webOrderNotifications"
import { geocodeAddressForDelivery } from "@/utils/geocodeAddress"
import { getDeliveryPolygonOuterRing, pointInPolygonRing } from "@/utils/deliveryArea"
import { readConsegnaDomicilioAttiva } from "@/utils/fidelityProgramConfig"
import { readOrdiniOnlineAttivi } from "@/utils/ordiniOnlineAttivi"
import { resolveMatchingPuntiVendita } from "@/utils/resolvePvForDelivery"
import { OnlinePaymentPlaceholder, describePaymentProvider } from "@/features/public/components/OnlinePaymentPlaceholder"
import StripePaymentForm from "@/features/public/components/StripePaymentForm"
import { createStripePaymentIntentForOrdine } from "@/features/public/services/onlinePaymentService"

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
  const [address, setAddress] = useState("")
  const [coords, setCoords] = useState(null)
  const [geoBusy, setGeoBusy] = useState(false)
  const [selectedSlot, setSelectedSlot] = useState(null)
  const [paymentMode, setPaymentMode] = useState("cash")
  const [puntiVendita, setPuntiVendita] = useState([])
  const [selectedPvId, setSelectedPvId] = useState(null)
  const [pvMatchIds, setPvMatchIds] = useState([])
  /** Aggiorna le fasce disponibili quando passa il minuto (regola lead-time). */
  const [slotTick, setSlotTick] = useState(0)
  /** Checkout online: dopo creazione ordine, clientSecret per Stripe Elements */
  const [stripeCheckout, setStripeCheckout] = useState(null)

  useEffect(() => {
    let c = false
    ;(async () => {
      try {
        const t = await getPublicTenantInfo()
        if (!c) setTenant(t)
        if (user?.id) {
          const { data } = await supabase.from("clienti").select("nome, indirizzo, telefono").eq("id", user.id).maybeSingle()
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
  const consegnaOn = readConsegnaDomicilioAttiva(parametri)
  const closedToday = isTodayClosed(tenant?.orari_settimana)
  const quarterFilterUi = useMemo(() => getWebVetrinaSlotQuarterFilter(parametri), [parametri])

  const slots = useMemo(() => {
    if (closedToday || !orariOggi.aperto) return []
    return buildPublicCheckoutDeliverySlots(orariOggi, new Date(), parametri)
  }, [closedToday, orariOggi, slotTick, parametri])

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
      setError("Indica l’indirizzo di consegna.")
      return
    }
    setGeoBusy(true)
    setError(null)
    try {
      const c = await geocodeAddressForDelivery(addr)
      if (!c) {
        setError("Non siamo riusciti a localizzare l’indirizzo. Prova con via, civico e città.")
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

  const tenantOk = tenant?.id && authTenantId && tenant.id === authTenantId

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
    if (closedToday || !orariOggi.aperto) {
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
    if (!coords) {
      setError('Verifica l’indirizzo con il pulsante "Verifica indirizzo" prima di confermare.')
      return
    }
    if (puntiVendita.length > 0 && !selectedPvId) {
      setError("L’indirizzo ricade in più zone: scegli la sede in cui vuoi ricevere la consegna.")
      return
    }
    const provider = describePaymentProvider(tenant)
    if (paymentMode === "online" && !provider) {
      setError("Pagamento online non ancora configurato dal locale. Scegli pagamento alla consegna oppure riprova più tardi.")
      return
    }

    setSubmitting(true)
    try {
      const statoFinale = paymentMode === "online" ? "IN_ATTESA" : "IN_PREPARAZIONE"
      const tipoPag =
        paymentMode === "online"
          ? provider === "stripe"
            ? "Carta (Stripe — in attesa)"
            : provider === "sumup"
              ? "Carta (SumUp — in attesa)"
              : "Carta (online — in attesa)"
          : "Da pagare"

      const orderId = await createOrder(authTenantId, {
        totale: total,
        stato: statoFinale,
        items: items.map((p) => ({
          prodotto_id: p.id,
          quantita: p.qty,
          prezzo: p.prezzo,
          formatoNome: p.formatoNome,
        })),
        note:
          paymentMode === "online"
            ? "Ordine web · consegna · pagamento online da confermare"
            : "Ordine web · consegna · pagamento alla consegna",
        tipoPagamento: tipoPag,
        tipoOrdine: "delivery",
        nomeCliente,
        orarioRitiro: selectedSlot.label,
        indirizzoConsegna: address.trim(),
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
        setError(
          "SumUp non è ancora collegato da questo flusso: usa pagamento alla consegna oppure Stripe. (Endpoint placeholder: payment-sumup-placeholder.)",
        )
        setSubmitting(false)
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

  if (!readOrdiniOnlineAttivi(parametri)) {
    return (
      <div style={{ padding: 24, maxWidth: 560, margin: "0 auto" }}>
        <h1 style={{ fontSize: 22, marginBottom: 12 }}>Ordine online non disponibile</h1>
        <p style={{ color: "#64748b", marginBottom: 16 }}>
          Il locale ha temporaneamente disattivato gli ordini dalla vetrina. Puoi consultare il menù; per ordinare contatta direttamente la pizzeria.
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
      {closedToday ? (
        <p style={{ padding: 14, background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, color: "#991b1b" }}>
          Oggi il locale è chiuso: non è possibile ordinare.
        </p>
      ) : null}

      <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <section>
          <h2 style={{ fontSize: 16, marginBottom: 8 }}>Indirizzo di consegna</h2>
          <textarea
            value={address}
            onChange={(e) => {
              setAddress(e.target.value)
              setCoords(null)
              setPvMatchIds([])
              setSelectedPvId(null)
            }}
            rows={3}
            placeholder="Via, numero civico, citofono, città…"
            style={{ width: "100%", padding: 12, borderRadius: 8, border: "1px solid #cbd5e1", boxSizing: "border-box" }}
          />
          <button
            type="button"
            onClick={() => void verifyAddress()}
            disabled={geoBusy}
            style={{
              marginTop: 10,
              padding: "10px 16px",
              borderRadius: 8,
              border: "1px solid #0f766e",
              background: geoBusy ? "#94a3b8" : "#0f766e",
              color: "#fff",
              fontWeight: 600,
              cursor: geoBusy ? "default" : "pointer",
            }}
          >
            {geoBusy ? "Verifica in corso…" : "Verifica indirizzo nell’area di consegna"}
          </button>
          {coords ? (
            <p style={{ marginTop: 10, fontSize: 13, color: "#166534", fontWeight: 600 }}>Indirizzo ok per la consegna.</p>
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
            Le prime fasce troppo vicine all’orario attuale non sono selezionabili (tempo minimo di preparazione).
            {quarterFilterUi.enabled && new Date().getHours() < quarterFilterUi.endHour ? (
              <>
                {" "}
                Fino alle <strong>{quarterFilterUi.endHour}:00</strong> le consegne sono proposte solo ai minuti{" "}
                <strong>:{String(quarterFilterUi.minute).padStart(2, "0")}</strong> (es. 11:{String(quarterFilterUi.minute).padStart(2, "0")}),
                compatibilmente con i tempi di preparazione e consegna. Configurabile in Amministrazione → Parametri operativi.
              </>
            ) : null}
          </p>
          {slots.length === 0 ? (
            <p style={{ color: "#b45309" }}>Nessuna fascia disponibile (orario di chiusura o giorno chiuso).</p>
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
          <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, cursor: "pointer" }}>
            <input
              type="radio"
              name="pay"
              checked={paymentMode === "cash"}
              onChange={() => setPaymentMode("cash")}
            />
            Pagamento alla consegna (contanti o POS in pizzeria)
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
            <input
              type="radio"
              name="pay"
              checked={paymentMode === "online"}
              onChange={() => setPaymentMode("online")}
            />
            Pagamento online (carta)
          </label>
          {paymentMode === "online" ? (
            <>
              <OnlinePaymentPlaceholder tenant={tenant} totalEuro={total} />
              {stripeCheckout?.clientSecret && describePaymentProvider(tenant) === "stripe" ? (
                <StripePaymentForm
                  publishableKey={tenant?.stripe_publishable_key}
                  clientSecret={stripeCheckout.clientSecret}
                  onSuccess={() => {
                    clearCart()
                    navigate(`/cliente/ordini?nuovo=${encodeURIComponent(stripeCheckout.orderId)}`)
                  }}
                  onError={(msg) => setError(msg)}
                />
              ) : null}
            </>
          ) : null}
        </section>

        {error ? (
          <p style={{ padding: 12, background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, color: "#991b1b" }}>
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={
            submitting ||
            Boolean(stripeCheckout && paymentMode === "online") ||
            !consegnaOn ||
            closedToday ||
            !slots.length ||
            !coords ||
            (puntiVendita.length > 0 && !selectedPvId)
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
      </form>

      <p style={{ marginTop: 20 }}>
        <Link to="/" style={{ color: "#64748b" }}>
          ← Torna al menù
        </Link>
      </p>
    </div>
  )
}
