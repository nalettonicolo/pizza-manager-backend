import { createClient } from "jsr:@supabase/supabase-js@2.49.2"
import Stripe from "npm:stripe@17.5.0"
import { corsHeaders, jsonResponse } from "../_shared/cors.ts"

/**
 * Conferma pagamento dopo Payment Element (fallback se webhook Stripe è in ritardo o non configurato).
 * Verifica su Stripe che il PaymentIntent sia succeeded, poi marca l'ordine via RPC service_role.
 */
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

  let body: { ordine_id?: string }
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ error: "Body JSON non valido" }, 400)
  }
  const ordineId = String(body?.ordine_id || "").trim()
  if (!ordineId) {
    return jsonResponse({ error: "ordine_id obbligatorio" }, 400)
  }

  const admin = createClient(supabaseUrl, serviceKey)

  const { data: rows, error: snapErr } = await admin.rpc("edge_ordine_snapshot_for_stripe", {
    p_ordine_id: ordineId,
    p_user_id: userId,
  })
  if (snapErr) {
    const msg = snapErr.message || ""
    if (msg.includes("non in attesa")) {
      const { data: ctxRows } = await admin.rpc("edge_get_ordine_payment_context", {
        p_ordine_id: ordineId,
      })
      const ctx = Array.isArray(ctxRows) ? ctxRows[0] : null
      const op = (ctx?.online_payment ?? {}) as Record<string, string>
      if (op?.status === "succeeded") {
        return jsonResponse({ ok: true, alreadyConfirmed: true })
      }
    }
    return jsonResponse({ error: snapErr.message || "Ordine non valido" }, 400)
  }
  const row = Array.isArray(rows) ? rows[0] : null
  if (!row?.tenant_id) {
    return jsonResponse({ error: "Ordine non trovato" }, 400)
  }

  const tenantId = row.tenant_id as string

  const { data: ctxRows, error: ctxErr } = await admin.rpc("edge_get_ordine_payment_context", {
    p_ordine_id: ordineId,
  })
  if (ctxErr) {
    return jsonResponse({ error: "Contesto pagamento non disponibile" }, 500)
  }
  const ctx = Array.isArray(ctxRows) ? ctxRows[0] : null
  const onlinePayment = (ctx?.online_payment ?? {}) as Record<string, string>
  const piId = onlinePayment?.stripe_payment_intent_id
  if (!piId) {
    return jsonResponse({ error: "PaymentIntent non associato all'ordine" }, 400)
  }

  const { data: secret, error: secErr } = await admin.rpc("get_stripe_secret_for_tenant_edge", {
    p_tenant_id: tenantId,
  })
  if (secErr || !secret || typeof secret !== "string" || !secret.startsWith("sk_")) {
    return jsonResponse({ error: "Stripe non configurato (chiave segreta)" }, 400)
  }

  const stripe = new Stripe(secret, { apiVersion: "2024-12-18.acacia" })
  let pi: Stripe.PaymentIntent
  try {
    pi = await stripe.paymentIntents.retrieve(piId)
  } catch (e) {
    console.error("stripe.paymentIntents.retrieve", e)
    return jsonResponse({ error: "Impossibile verificare il pagamento su Stripe" }, 502)
  }

  if (pi.status !== "succeeded") {
    return jsonResponse(
      {
        error: `Pagamento non ancora completato (stato Stripe: ${pi.status})`,
        stripeStatus: pi.status,
      },
      402,
    )
  }

  const ch = pi.latest_charge
  const chargeId = typeof ch === "string" ? ch : (ch as Stripe.Charge | null)?.id || ""

  const { error: markErr } = await admin.rpc("edge_stripe_mark_payment_succeeded", {
    p_payment_intent_id: pi.id,
    p_charge_id: chargeId,
  })
  if (markErr) {
    console.error("edge_stripe_mark_payment_succeeded", markErr)
    return jsonResponse({ error: markErr.message || "Conferma ordine non riuscita" }, 500)
  }

  return jsonResponse({ ok: true, ordineId, paymentIntentId: pi.id })
})
