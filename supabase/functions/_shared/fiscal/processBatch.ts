import type { SupabaseClient } from "jsr:@supabase/supabase-js@2.49.2"
import type { FiscalOutboxRow } from "./types.ts"
import { getExportFileHandler, resolveFiscalAdapter } from "./registry.ts"

function envMap(): Record<string, string | undefined> {
  return {
    FISCAL_RT_API_URL: Deno.env.get("FISCAL_RT_API_URL") ?? undefined,
    FISCAL_RT_API_KEY: Deno.env.get("FISCAL_RT_API_KEY") ?? undefined,
  }
}

export async function processFiscalOutboxBatch(
  admin: SupabaseClient,
  rows: FiscalOutboxRow[],
): Promise<{ processed: number; failed: number }> {
  const env = envMap()
  const exportHandler = getExportFileHandler()
  let processed = 0
  let failed = 0

  for (const row of rows || []) {
    try {
      if (exportHandler.supports(row.kind)) {
        await admin.rpc("complete_fiscal_outbox_item", {
          p_id: row.id,
          p_status: row.kind === "noop_test" ? "ack" : "sent",
          p_provider_response: { mode: row.kind, note: "export_ok" },
          p_last_error: null,
        })
        processed += 1
        continue
      }

      const adapter = resolveFiscalAdapter(row)
      if (!adapter) {
        await admin.rpc("complete_fiscal_outbox_item", {
          p_id: row.id,
          p_status: "failed",
          p_provider_response: null,
          p_last_error: "adapter_fiscale_sconosciuto",
        })
        failed += 1
        continue
      }

      const result = await adapter.send({ row, env })
      if (result.ok) {
        await admin.rpc("complete_fiscal_outbox_item", {
          p_id: row.id,
          p_status: "sent",
          p_provider_response: result.providerResponse ?? { ok: true },
          p_last_error: null,
        })
        processed += 1
      } else {
        await admin.rpc("complete_fiscal_outbox_item", {
          p_id: row.id,
          p_status: "failed",
          p_provider_response: null,
          p_last_error: `${result.code}:${result.message}`.slice(0, 500),
        })
        failed += 1
      }
    } catch (e) {
      await admin.rpc("complete_fiscal_outbox_item", {
        p_id: row.id,
        p_status: "failed",
        p_provider_response: null,
        p_last_error: String((e as Error).message || e).slice(0, 500),
      })
      failed += 1
    }
  }

  return { processed, failed }
}
