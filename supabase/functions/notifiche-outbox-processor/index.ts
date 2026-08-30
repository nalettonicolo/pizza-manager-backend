import { createClient } from "jsr:@supabase/supabase-js@2.49.2"
import { processNotificheOutboxBatch } from "../_shared/notifications/processBatch.ts"
import { assertCronCaller } from "../_shared/cronAuth.ts"

/**
 * Worker `notifiche_outbox`: routing per canale (email / sms / whatsapp / in_app).
 * Gli adapter in `_shared/notifications/adapters/` sono stub — completare solo le API SMTP/SMS/WhatsApp.
 * Nessun SaaS obbligatorio (Resend/Twilio rimossi dal perimetro prodotto).
 */
Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 })
  }
  const cronDenied = assertCronCaller(req)
  if (cronDenied) return cronDenied

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  const admin = createClient(supabaseUrl, serviceKey)

  const limit = Number(new URL(req.url).searchParams.get("limit") || "30")

  const { data: rows, error: claimErr } = await admin.rpc("claim_notifiche_outbox_batch", {
    p_limit: limit,
  })
  if (claimErr) {
    console.error("claim_notifiche_outbox_batch", claimErr)
    return new Response(JSON.stringify({ error: claimErr.message }), { status: 500 })
  }

  const { sent, failed, skipped } = await processNotificheOutboxBatch(admin, rows || [])

  return new Response(
    JSON.stringify({
      claimed: (rows || []).length,
      sent,
      failed,
      pending_integration: skipped,
    }),
    { headers: { "Content-Type": "application/json" } },
  )
})
