import type { FiscalAdapterResult, FiscalOutboxRow } from "../types.ts"

/**
 * Adapter RT/SDI generico: POST JSON verso endpoint vendor (Aruba, Fatture in Cloud, …).
 *
 * Env: FISCAL_RT_API_URL, FISCAL_RT_API_KEY
 * Opzionale: FISCAL_RT_API_HEADER (default Authorization Bearer)
 */
export async function sendRtSdi(ctx: {
  row: FiscalOutboxRow
  env: Record<string, string | undefined>
}): Promise<FiscalAdapterResult> {
  const url = ctx.env.FISCAL_RT_API_URL?.trim()
  const key = ctx.env.FISCAL_RT_API_KEY?.trim()
  if (!url || !key) {
    return { ok: false, code: "NOT_CONFIGURED", message: "adapter_rt_non_configurato" }
  }

  try {
    const headerName = (ctx.env.FISCAL_RT_API_HEADER || "Authorization").trim()
    const authValue = headerName.toLowerCase() === "authorization" ? `Bearer ${key}` : key
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        [headerName]: authValue,
      },
      body: JSON.stringify({
        id: ctx.row.id,
        tenant_id: ctx.row.tenant_id,
        kind: ctx.row.kind,
        payload: ctx.row.payload ?? {},
      }),
    })

    const rawText = await res.text().catch(() => "")
    let parsed: Record<string, unknown> = { status: res.status, body: rawText.slice(0, 500) }
    try {
      parsed = { status: res.status, ...(JSON.parse(rawText) as Record<string, unknown>) }
    } catch {
      /* keep text body */
    }

    if (!res.ok) {
      return {
        ok: false,
        code: "FAILED",
        message: `rt_sdi HTTP ${res.status}: ${rawText.slice(0, 200)}`,
      }
    }

    return { ok: true, providerResponse: parsed }
  } catch (e) {
    return {
      ok: false,
      code: "FAILED",
      message: `rt_sdi: ${e instanceof Error ? e.message : String(e)}`.slice(0, 400),
    }
  }
}
