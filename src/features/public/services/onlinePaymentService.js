import { supabase } from "@/lib/supabaseClient"

function functionsUrl(name) {
  const base = import.meta.env.VITE_SUPABASE_URL
  if (!base) throw new Error("VITE_SUPABASE_URL non configurato")
  return `${String(base).replace(/\/$/, "")}/functions/v1/${name}`
}

/**
 * Crea un PaymentIntent Stripe lato Edge e restituisce clientSecret per Elements (3DS gestito da Stripe).
 * @param {string} ordineId
 * @returns {Promise<{ clientSecret: string | null, paymentIntentId: string }>}
 */
export async function createStripePaymentIntentForOrdine(ordineId) {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const token = session?.access_token
  if (!token) throw new Error("Sessione scaduta: effettua di nuovo l’accesso.")

  const res = await fetch(functionsUrl("payment-stripe-create-intent"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ ordine_id: ordineId }),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(json.error || `Errore pagamento (${res.status})`)
  }
  return {
    clientSecret: json.clientSecret ?? null,
    paymentIntentId: json.paymentIntentId ?? "",
  }
}

/**
 * Rimborso Stripe (cassa/admin). Richiede ordine con pagamento registrato.
 * @param {string} ordineId
 * @param {number | null} amountCent importo parziale in centesimi, o null per totale
 */
export async function requestStripeRefundForOrdine(ordineId, amountCent = null) {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const token = session?.access_token
  if (!token) throw new Error("Sessione scaduta")

  const body = { ordine_id: ordineId }
  if (amountCent != null && Number.isFinite(Number(amountCent))) {
    body.amount_cent = Math.floor(Number(amountCent))
  }

  const res = await fetch(functionsUrl("payment-stripe-refund"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(json.error || `Rimborso non riuscito (${res.status})`)
  }
  return json
}
