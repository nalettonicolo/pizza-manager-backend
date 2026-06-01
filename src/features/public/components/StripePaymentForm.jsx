import { useMemo, useState } from "react"
import { loadStripe } from "@stripe/stripe-js"
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js"

function InnerPay({ onSuccess, onError, returnUrl }) {
  const stripe = useStripe()
  const elements = useElements()
  const [busy, setBusy] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!stripe || !elements) return
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
    <form onSubmit={(ev) => void handleSubmit(ev)} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <PaymentElement />
      <button
        type="submit"
        disabled={!stripe || busy}
        style={{
          padding: "12px 18px",
          borderRadius: 8,
          border: "none",
          background: busy ? "#94a3b8" : "#0f766e",
          color: "#fff",
          fontWeight: 700,
          cursor: busy ? "default" : "pointer",
        }}
      >
        {busy ? "Pagamento in corso…" : "Paga con carta"}
      </button>
    </form>
  )
}

/**
 * Payment Element Stripe (SCA / 3DS gestiti da Stripe).
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

  if (!stripePromise || !clientSecret) {
    return null
  }

  return (
    <div style={{ marginTop: 12 }}>
      <p style={{ fontSize: 13, color: "#0f766e", fontWeight: 600, marginBottom: 10 }}>
        Ordine registrato. Inserisci i dati della carta (eventuale verifica 3-D Secure su finestra banca).
      </p>
      <Elements key={clientSecret} stripe={stripePromise} options={{ clientSecret }}>
        <InnerPay onSuccess={onSuccess} onError={onError} returnUrl={returnUrl} />
      </Elements>
    </div>
  )
}
