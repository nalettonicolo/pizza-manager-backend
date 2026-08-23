import { createClient } from "jsr:@supabase/supabase-js@2.49.2"
import Stripe from "npm:stripe@17.5.0"
import { corsHeaders, jsonResponse } from "../_shared/cors.ts"

/**
 * Pagina di pagamento ospitata (pay-by-link): a differenza di payment-stripe-create-intent
 * (richiede il JWT del cliente loggato che ha fatto il checkout online), questa funzione è
 * pensata per un link condiviso fuori dall'app — WhatsApp/SMS — quindi NON richiede
 * autenticazione. L'autorizzazione è l'id (uuid, non enumerabile) di payment_link_intents,
 * generato da cassa quando registra la richiesta di pagamento online.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405)
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
  if (!supabaseUrl || !serviceKey) {
    return jsonResponse({ error: "Server misconfigured" }, 500)
  }

  let body: { intent_id?: string }
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ error: "Body JSON non valido" }, 400)
  }
  const intentId = String(body?.intent_id || "").trim()
  if (!intentId) {
    return jsonResponse({ error: "intent_id obbligatorio" }, 400)
  }

  const admin = createClient(supabaseUrl, serviceKey)

  const { data: intent, error: getErr } = await admin.rpc("edge_payment_link_intent_get", {
    p_intent_id: intentId,
  })
  if (getErr) {
    console.error("edge_payment_link_intent_get", getErr)
    return jsonResponse({ error: "Errore lettura richiesta di pagamento" }, 500)
  }
  if (!intent?.tenantId) {
    return jsonResponse({ error: "Link non valido o scaduto" }, 404)
  }

  const importoCent = Number(intent.importoCent)
  const valuta = String(intent.valuta || "eur").toLowerCase()
  const numero = intent.numero ?? null
  const tenantNome = intent.tenantNome || null
  const logoUrl = intent.logoUrl || null

  if (intent.status === "paid") {
    return jsonResponse({ alreadyPaid: true, importoCent, valuta, numero, tenantNome, logoUrl })
  }
  if (intent.status === "cancelled" || intent.status === "expired") {
    return jsonResponse({ error: "Questo link di pagamento non è più valido." }, 410)
  }
  if (!Number.isFinite(importoCent) || importoCent < 50) {
    return jsonResponse({ error: "Importo non valido" }, 400)
  }
  if (String(intent.providerKey || "").toLowerCase() !== "stripe") {
    return jsonResponse({ error: "Questo link non è configurato per un pagamento con carta." }, 400)
  }
  if (!intent.stripePublishableKey) {
    return jsonResponse({ error: "Pagamento con carta non configurato per questo locale." }, 400)
  }

  const { data: secret, error: secErr } = await admin.rpc("get_stripe_secret_for_tenant_edge", {
    p_tenant_id: intent.tenantId,
  })
  if (secErr || !secret || typeof secret !== "string" || !secret.startsWith("sk_")) {
    console.error("stripe secret", secErr)
    return jsonResponse({ error: "Pagamento con carta non configurato per questo locale." }, 400)
  }

  const stripe = new Stripe(secret, { apiVersion: "2024-12-18.acacia" })

  // Riusa il PaymentIntent già creato se è ancora pagabile (evita di duplicarne uno ad ogni
  // apertura del link da parte del cliente).
  if (intent.providerIntentId) {
    try {
      const existing = await stripe.paymentIntents.retrieve(intent.providerIntentId)
      if (existing.status === "requires_payment_method" || existing.status === "requires_confirmation") {
        return jsonResponse({
          clientSecret: existing.client_secret,
          paymentIntentId: existing.id,
          stripePublishableKey: intent.stripePublishableKey,
          importoCent,
          valuta,
          numero,
          tenantNome,
          logoUrl,
        })
      }
    } catch (e) {
      console.warn("stripe.paymentIntents.retrieve (fallback a nuovo intent)", e)
    }
  }

  let pi: Stripe.PaymentIntent
  try {
    pi = await stripe.paymentIntents.create({
      amount: importoCent,
      currency: valuta,
      // Solo carta (allineato a checkout vetrina).
      payment_method_types: ["card"],
      metadata: {
        tenant_id: intent.tenantId,
        ordine_id: intent.ordineId,
        payment_link_intent_id: intentId,
      },
    })
  } catch (e) {
    console.error("stripe.paymentIntents.create", e)
    return jsonResponse({ error: "Stripe: impossibile creare il pagamento" }, 502)
  }

  const { error: attachErr } = await admin.rpc("edge_payment_link_attach_stripe_intent", {
    p_intent_id: intentId,
    p_provider_intent_id: pi.id,
    p_status: "sent",
  })
  if (attachErr) {
    console.error("edge_payment_link_attach_stripe_intent", attachErr)
    try {
      await stripe.paymentIntents.cancel(pi.id)
    } catch {
      /* ignore */
    }
    return jsonResponse({ error: "Impossibile registrare il pagamento" }, 500)
  }

  return jsonResponse({
    clientSecret: pi.client_secret,
    paymentIntentId: pi.id,
    stripePublishableKey: intent.stripePublishableKey,
    importoCent,
    valuta,
    numero,
    tenantNome,
    logoUrl,
  })
})
