import { useMemo, useState } from "react"
import { loadStripe } from "@stripe/stripe-js"
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js"
import { isStripePublishableTestKey } from "@/constants/onlinePaymentTestCards"
import OnlinePaymentTestCardsHint from "@/features/public/components/OnlinePaymentTestCardsHint"

function InnerPay({ onSuccess, onError, returnUrl }) {
  const stripe = useStripe()
  const elements = useElements()
  const [busy, setBusy] = useState(false)

  const handlePay = async () => {
    if (!stripe || !elements) {
      onError?.("Modulo carta non ancora pronto. Attendi un momento e riprova.")
      return
    }
    setBusy(true)
    try {
      const { error } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: returnUrl,
        },
        redirect: "if_required",
      })
      if (error) {
        onError(error.message || "Pagamento non completato")
        return
      }
      await onSuccess?.()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <PaymentElement />
      <button
        type="button"
        disabled={!stripe || busy}
        onClick={() => void handlePay()}
        style={{
          padding: "12px 18px",
          borderRadius: 8,
          border: "none",
          background: busy ? "#94a3b8" : "#0f766e",
          color: "#fff",
          fontWeight: 700,
          cursor: busy || !stripe ? "default" : "pointer",
        }}
      >
        {busy ? "Pagamento in corso…" : "Paga con carta"}
      </button>
    </div>
  )
}

/**
 * Payment Element Stripe (SCA / 3DS gestiti da Stripe).
 * Non usa <form> interno: il checkout vetrina ha già un form esterno (nested form = click ignora confirmPayment).
 */
export default function StripePaymentForm({ publishableKey, clientSecret, onSuccess, onError }) {
  const stripePromise = useMemo(() => {
    const pk = String(publishableKey || "").trim()
    if (!pk.startsWith("pk_")) return null
    return loadStripe(pk)
  }, [publishableKey])

  const returnUrl = useMemo(() => {
    try {
      return new URL("/cliente/ordini", window.location.origin).href
    } catch {
      return `${window.location.origin}/cliente/ordini`
    }
  }, [])

  if (!clientSecret) {
    return (
      <p style={{ marginTop: 12, color: "#b91c1c", fontSize: 14 }}>
        Pagamento non avviato (manca il riferimento carta). Torna indietro e conferma di nuovo l’ordine.
      </p>
    )
  }

  if (!stripePromise) {
    return (
      <p style={{ marginTop: 12, color: "#b91c1c", fontSize: 14 }}>
        Chiave pubblica Stripe assente o non valida. Configurala in Amministrazione → Pagamenti online.
      </p>
    )
  }

  const isTestMode = isStripePublishableTestKey(publishableKey)

  return (
    <div style={{ marginTop: 12 }}>
      <p style={{ fontSize: 13, color: "#0f766e", fontWeight: 600, marginBottom: 10 }}>
        Ordine registrato. Inserisci i dati della carta (eventuale verifica 3-D Secure su finestra banca).
      </p>
      {isTestMode ? <OnlinePaymentTestCardsHint providerKey="stripe" compact /> : null}
      <Elements key={clientSecret} stripe={stripePromise} options={{ clientSecret }}>
        <InnerPay onSuccess={onSuccess} onError={onError} returnUrl={returnUrl} />
      </Elements>
    </div>
  )
}
