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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/**
 * Attende conferma webhook Stripe su ordine (online_payment.status = succeeded).
 * @param {string} ordineId
 * @param {{ maxAttempts?: number, intervalMs?: number }} opts
 */
export async function pollStripeOrdinePaymentConfirmed(ordineId, opts = {}) {
  const maxAttempts = opts.maxAttempts ?? 15
  const intervalMs = opts.intervalMs ?? 2000
  for (let i = 0; i < maxAttempts; i += 1) {
    const { data, error } = await supabase
      .from("Ordine")
      .select("online_payment")
      .eq("id", ordineId)
      .maybeSingle()
    if (error) throw error
    const op = data?.online_payment ?? data?.onlinePayment ?? {}
    const status = String(op?.status ?? "").toLowerCase()
    if (status === "succeeded") return op
    await sleep(intervalMs)
  }
  throw new Error(
    "Pagamento ricevuto da Stripe ma la conferma sul server è in ritardo. Controlla «I miei ordini» tra poco o contatta il locale.",
  )
}
