import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

/**
 * Worker stub: claim fiscal_outbox batch e marca sent/failed (adapter RT reale → vendor).
 * Invocare con service role (cron o manuale Super Admin).
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

  const processed: string[] = []
  const failed: string[] = []

  for (const row of rows || []) {
    try {
      if (row.kind === "export_file") {
        await admin.rpc("complete_fiscal_outbox_item", {
          p_id: row.id,
          p_status: "sent",
          p_provider_response: { mode: "export_file", note: "stub_ok" },
          p_last_error: null,
        })
      } else if (row.kind === "noop_test") {
        await admin.rpc("complete_fiscal_outbox_item", {
          p_id: row.id,
          p_status: "ack",
          p_provider_response: { noop: true },
          p_last_error: null,
        })
      } else {
        await admin.rpc("complete_fiscal_outbox_item", {
          p_id: row.id,
          p_status: "failed",
          p_provider_response: null,
          p_last_error: "adapter_rt_non_configurato",
        })
        failed.push(row.id)
        continue
      }
      processed.push(row.id)
    } catch (e) {
      console.error("process row", row.id, e)
      await admin.rpc("complete_fiscal_outbox_item", {
        p_id: row.id,
        p_status: "failed",
        p_provider_response: null,
        p_last_error: String((e as Error).message || e),
      })
      failed.push(row.id)
    }
  }

  return new Response(
    JSON.stringify({
      claimed: (rows || []).length,
      processed: processed.length,
      failed: failed.length,
    }),
    { headers: { "Content-Type": "application/json" } },
  )
})
