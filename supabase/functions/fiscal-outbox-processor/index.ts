import { createClient } from "jsr:@supabase/supabase-js@2.49.2"
import { processFiscalOutboxBatch } from "../_shared/fiscal/processBatch.ts"

/**
 * Worker fiscal outbox: export file + adapter RT/SDI (stub fino a FISCAL_RT_API_*).
 */
Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 })
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  const admin = createClient(supabaseUrl, serviceKey)

  const limit = Number(new URL(req.url).searchParams.get("limit") || "20")

  const { data: rows, error: claimErr } = await admin.rpc("claim_fiscal_outbox_batch", {
    p_limit: limit,
  })
  if (claimErr) {
    console.error("claim_fiscal_outbox_batch", claimErr)
    return new Response(JSON.stringify({ error: claimErr.message }), { status: 500 })
  }

  const { processed, failed } = await processFiscalOutboxBatch(admin, rows || [])

  return new Response(
    JSON.stringify({
      claimed: (rows || []).length,
      processed,
      failed,
    }),
    { headers: { "Content-Type": "application/json" } },
  )
})
