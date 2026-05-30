import { createClient } from "@supabase/supabase-js"
import Stripe from "stripe"

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 })
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  const whSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET") || ""
  const isProd = Boolean(Deno.env.get("DENO_DEPLOYMENT_ID") || Deno.env.get("SUPABASE_URL")?.includes(".supabase.co"))

  const body = await req.text()
  const sig = req.headers.get("stripe-signature") || ""

  let event: Stripe.Event
  try {
    if (!whSecret) {
      if (isProd) {
        console.error("STRIPE_WEBHOOK_SECRET mancante in produzione")
        return new Response("Webhook non configurato", { status: 503 })
      }
      event = JSON.parse(body) as Stripe.Event
      console.warn("STRIPE_WEBHOOK_SECRET mancante: evento non verificato (solo dev)")
    } else {
      const stripe = new Stripe("sk_test_dummy", { apiVersion: "2024-12-18.acacia" })
      event = stripe.webhooks.constructEvent(body, sig, whSecret)
    }
  } catch (e) {
    console.error("webhook signature", e)
    return new Response(`Webhook error: ${(e as Error).message}`, { status: 400 })
  }

  const admin = createClient(supabaseUrl, serviceKey)

  try {
    switch (event.type) {
      case "payment_intent.succeeded": {
        const pi = event.data.object as Stripe.PaymentIntent
        const ch = pi.latest_charge
        const chargeId = typeof ch === "string" ? ch : (ch as Stripe.Charge | null)?.id || ""
        const { error } = await admin.rpc("edge_stripe_mark_payment_succeeded", {
          p_payment_intent_id: pi.id,
          p_charge_id: chargeId,
        })
        if (error) console.error("edge_stripe_mark_payment_succeeded", error)
        break
      }
      case "payment_intent.payment_failed": {
        const pi = event.data.object as Stripe.PaymentIntent
        const msg = pi.last_payment_error?.message || "payment_failed"
        const { error } = await admin.rpc("edge_stripe_mark_payment_failed", {
          p_payment_intent_id: pi.id,
          p_message: msg,
        })
        if (error) console.error("edge_stripe_mark_payment_failed", error)
        break
      }
      case "charge.refunded": {
        const ch = event.data.object as Stripe.Charge
        const piId = typeof ch.payment_intent === "string"
          ? ch.payment_intent
          : (ch.payment_intent as Stripe.PaymentIntent | null)?.id
        if (piId) {
          const { error } = await admin.rpc("edge_stripe_append_refund", {
            p_payment_intent_id: piId,
            p_refund_id: (ch.refunds?.data?.[0]?.id) || ch.id,
            p_amount_cent: ch.amount_refunded ?? 0,
          })
          if (error) console.error("edge_stripe_append_refund", error)
        }
        break
      }
      default:
        break
    }
  } catch (e) {
    console.error("webhook handler", e)
    return new Response("Handler error", { status: 500 })
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { "Content-Type": "application/json" },
  })
})
