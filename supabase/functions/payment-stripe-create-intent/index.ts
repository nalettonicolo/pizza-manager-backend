import { createClient } from "@supabase/supabase-js"
import Stripe from "stripe"
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
    console.error("edge_ordine_snapshot_for_stripe", snapErr)
    return jsonResponse({ error: snapErr.message || "Ordine non valido per il pagamento" }, 400)
  }
  const row = Array.isArray(rows) ? rows[0] : null
  if (!row?.tenant_id) {
    return jsonResponse({ error: "Ordine non trovato o non pagabile" }, 400)
  }

  const tenantId = row.tenant_id as string
  const totale = Number(row.totale)
  if (!Number.isFinite(totale) || totale <= 0) {
    return jsonResponse({ error: "Totale ordine non valido" }, 400)
  }
  const amountCent = Math.round(totale * 100)
  if (amountCent < 50) {
    return jsonResponse({ error: "Importo troppo basso" }, 400)
  }

  const { data: secret, error: secErr } = await admin.rpc("get_stripe_secret_for_tenant_edge", {
    p_tenant_id: tenantId,
  })
  if (secErr || !secret || typeof secret !== "string" || !secret.startsWith("sk_")) {
    console.error("stripe secret", secErr)
    return jsonResponse({ error: "Stripe non configurato per questo locale (chiave segreta)" }, 400)
  }

  const stripe = new Stripe(secret, { apiVersion: "2024-12-18.acacia" })

  let pi: Stripe.PaymentIntent
  try {
    pi = await stripe.paymentIntents.create({
      amount: amountCent,
      currency: "eur",
      automatic_payment_methods: { enabled: true },
      metadata: {
        tenant_id: tenantId,
        ordine_id: ordineId,
        supabase_user_id: userId,
      },
    })
  } catch (e) {
    console.error("stripe.paymentIntents.create", e)
    return jsonResponse({ error: "Stripe: impossibile creare il pagamento" }, 502)
  }

  const { error: attachErr } = await admin.rpc("edge_stripe_attach_payment_intent", {
    p_ordine_id: ordineId,
    p_payment_intent_id: pi.id,
    p_status: pi.status,
    p_amount_cent: amountCent,
  })
  if (attachErr) {
    console.error("edge_stripe_attach_payment_intent", attachErr)
    try {
      await stripe.paymentIntents.cancel(pi.id)
    } catch {
      /* ignore */
    }
    return jsonResponse({ error: "Impossibile associare il pagamento all'ordine" }, 500)
  }

  return jsonResponse({
    clientSecret: pi.client_secret,
    paymentIntentId: pi.id,
  })
})
