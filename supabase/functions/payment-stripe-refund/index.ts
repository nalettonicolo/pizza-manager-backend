import { createClient } from "jsr:@supabase/supabase-js@2.49.2"
import Stripe from "npm:stripe@17.5.0"
import { corsHeaders, jsonResponse } from "../_shared/cors.ts"

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405)
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
  if (!supabaseUrl || !anonKey || !serviceKey) {
    return jsonResponse({ error: "Server misconfigured" }, 500)
  }

  const authHeader = req.headers.get("Authorization") || ""
  const jwt = authHeader.replace(/^Bearer\s+/i, "").trim()
  if (!jwt) {
    return jsonResponse({ error: "Authorization richiesta" }, 401)
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  })
  const { data: userData, error: userErr } = await userClient.auth.getUser(jwt)
  if (userErr || !userData?.user?.id) {
    return jsonResponse({ error: "Sessione non valida" }, 401)
  }
  const userId = userData.user.id

  let body: { ordine_id?: string; amount_cent?: number }
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ error: "Body JSON non valido" }, 400)
  }
  const ordineId = String(body?.ordine_id || "").trim()
  if (!ordineId) {
    return jsonResponse({ error: "ordine_id obbligatorio" }, 400)
  }
  const partialAmount = body.amount_cent != null ? Math.floor(Number(body.amount_cent)) : null

  const admin = createClient(supabaseUrl, serviceKey)

  const { data: allowed, error: alErr } = await admin.rpc("stripe_refund_allowed", {
    p_ordine_id: ordineId,
    p_user_id: userId,
  })
  if (alErr || !allowed) {
    return jsonResponse({ error: "Permesso negato per il rimborso" }, 403)
  }

  const { data: ordRows, error: oErr } = await admin.rpc("edge_get_ordine_payment_context", {
    p_ordine_id: ordineId,
  })
  const ordRow = Array.isArray(ordRows) ? ordRows[0] : null

  if (oErr || !ordRow) {
    return jsonResponse({ error: "Ordine non trovato" }, 404)
  }

  const tenantId = String((ordRow as { tenant_id?: string }).tenant_id || "")
  const online = (ordRow as { online_payment?: Record<string, unknown> }).online_payment
  const piId = online && typeof online === "object" ? String((online as { stripe_payment_intent_id?: string }).stripe_payment_intent_id || "") : ""

  if (!tenantId || !piId) {
    return jsonResponse({ error: "Ordine senza pagamento Stripe registrato" }, 400)
  }

  const { data: secret, error: secErr } = await admin.rpc("get_stripe_secret_for_tenant_edge", {
    p_tenant_id: tenantId,
  })
  if (secErr || !secret || typeof secret !== "string") {
    return jsonResponse({ error: "Stripe non configurato" }, 400)
  }

  const stripe = new Stripe(secret)

  let chargeId = ""
  try {
    const pi = await stripe.paymentIntents.retrieve(piId, { expand: ["latest_charge"] })
    const lc = pi.latest_charge
    chargeId = typeof lc === "string" ? lc : (lc as Stripe.Charge)?.id || ""
  } catch (e) {
    console.error("retrieve pi", e)
    return jsonResponse({ error: "Impossibile leggere il pagamento Stripe" }, 502)
  }

  if (!chargeId) {
    return jsonResponse({ error: "Charge non disponibile" }, 400)
  }

  try {
    const params: Stripe.RefundCreateParams = { charge: chargeId }
    if (partialAmount != null && partialAmount > 0) {
      params.amount = partialAmount
    }
    const refund = await stripe.refunds.create(params)
    const { error: recErr } = await admin.rpc("edge_stripe_append_refund", {
      p_payment_intent_id: piId,
      p_refund_id: refund.id,
      p_amount_cent: refund.amount,
    })
    if (recErr) console.error("edge_stripe_append_refund", recErr)
    return jsonResponse({ refund_id: refund.id, status: refund.status, amount: refund.amount })
  } catch (e) {
    console.error("refund", e)
    return jsonResponse({ error: (e as Error).message || "Rimborso fallito" }, 502)
  }
})
