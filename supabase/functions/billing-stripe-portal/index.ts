import { createClient } from "jsr:@supabase/supabase-js@2.49.2"

/**
 * Stub billing Stripe tenant: portal checkout abbonamenti SaaS.
 * Completare con Stripe Billing API + webhook su tenants.stripe_customer_id.
 */
Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 })
  }

  const stripeKey = Deno.env.get("STRIPE_BILLING_SECRET_KEY")
  if (!stripeKey) {
    return new Response(
      JSON.stringify({ error: "STRIPE_BILLING_SECRET_KEY non configurata", code: "NOT_CONFIGURED" }),
      { status: 501, headers: { "Content-Type": "application/json" } },
    )
  }

  const body = await req.json().catch(() => ({}))
  const tenantId = body?.tenant_id
  if (!tenantId) {
    return new Response(JSON.stringify({ error: "tenant_id obbligatorio" }), { status: 400 })
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  const admin = createClient(supabaseUrl, serviceKey)

  // TODO: creare/recuperare Stripe Customer e sessione Billing Portal
  return new Response(
    JSON.stringify({
      ok: false,
      code: "NOT_IMPLEMENTED",
      message: "billing_stripe_da_completare",
      tenant_id: tenantId,
    }),
    { status: 501, headers: { "Content-Type": "application/json" } },
  )
})
