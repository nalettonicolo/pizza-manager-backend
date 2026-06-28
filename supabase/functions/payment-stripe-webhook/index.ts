import { createClient } from "jsr:@supabase/supabase-js@2.49.2"
import Stripe from "npm:stripe@17.5.0"

function extractPaymentIntentId(event: Stripe.Event): string | null {
  const obj = event.data?.object as { id?: string } | undefined
  if (!obj?.id) return null
  if (event.type.startsWith("payment_intent.")) return obj.id
  if (event.type === "charge.refunded") {
    const ch = event.data.object as Stripe.Charge
    const pi = ch.payment_intent
    return typeof pi === "string" ? pi : (pi as Stripe.PaymentIntent | null)?.id ?? null
  }
  return null
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 })
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  const globalWhSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET") || ""
  const isProd = Boolean(Deno.env.get("DENO_DEPLOYMENT_ID") || Deno.env.get("SUPABASE_URL")?.includes(".supabase.co"))

  const body = await req.text()
  const sig = req.headers.get("stripe-signature") || ""

  const admin = createClient(supabaseUrl, serviceKey)

  let event: Stripe.Event
  const stripeProbe = new Stripe("sk_test_dummy", { apiVersion: "2024-12-18.acacia" })

  try {
    let verifySecret = globalWhSecret

    if (!verifySecret) {
      if (isProd) {
        console.error("STRIPE_WEBHOOK_SECRET mancante in produzione")
        return new Response("Webhook non configurato", { status: 503 })
      }
      event = JSON.parse(body) as Stripe.Event
      console.warn("STRIPE_WEBHOOK_SECRET mancante: evento non verificato (solo dev)")
    } else {
      try {
        event = stripeProbe.webhooks.constructEvent(body, sig, verifySecret)
      } catch {
        let parsed: Stripe.Event
        try {
          parsed = JSON.parse(body) as Stripe.Event
        } catch {
          throw new Error("Payload webhook non valido")
        }
        const piId = extractPaymentIntentId(parsed)
        if (piId) {
          const { data: tenantId } = await admin.rpc("get_tenant_id_by_stripe_payment_intent", {
            p_payment_intent_id: piId,
          })
          if (tenantId) {
            const { data: tenantWh } = await admin.rpc("get_stripe_webhook_secret_for_tenant_edge", {
              p_tenant_id: tenantId,
            })
            if (tenantWh && typeof tenantWh === "string") {
              verifySecret = tenantWh
              event = stripeProbe.webhooks.constructEvent(body, sig, verifySecret)
            } else {
              throw new Error("Firma webhook non valida")
            }
          } else {
            throw new Error("Firma webhook non valida")
          }
        } else {
          throw new Error("Firma webhook non valida")
        }
      }
    }
  } catch (e) {
    console.error("webhook signature", e)
    return new Response(`Webhook error: ${(e as Error).message}`, { status: 400 })
  }

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
