import type { FiscalAdapterResult, FiscalOutboxRow } from "../types.ts"

/** Adapter RT/SDI reale: implementare invio verso provider tenant (Aruba, Fatture in Cloud, …). */
export async function sendRtSdi(ctx: {
  row: FiscalOutboxRow
  env: Record<string, string | undefined>
}): Promise<FiscalAdapterResult> {
  const url = ctx.env.FISCAL_RT_API_URL
  const key = ctx.env.FISCAL_RT_API_KEY
  if (!url || !key) {
    return { ok: false, code: "NOT_CONFIGURED", message: "adapter_rt_non_configurato" }
  }
  // TODO: POST documento verso RT/SDI del tenant
  return { ok: false, code: "NOT_IMPLEMENTED", message: "adapter_rt_da_completare" }
}
