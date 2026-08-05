import type { AdapterSendContext, AdapterSendResult } from "../types.ts"

/**
 * SMS generico: POST JSON verso gateway HTTP del tenant/piattaforma.
 *
 * Env:
 * - NOTIFY_SMS_API_URL (obbligatorio)
 * - NOTIFY_SMS_API_KEY (opzionale, Bearer o header custom)
 * - NOTIFY_SMS_API_HEADER (default Authorization)
 * - NOTIFY_SMS_PROVIDER_KEY (alias legacy: se presente e manca URL → NOT_CONFIGURED con messaggio chiaro)
 */
export async function sendSms(ctx: AdapterSendContext): Promise<AdapterSendResult> {
  const apiUrl = ctx.env.NOTIFY_SMS_API_URL?.trim()
  const providerHint = ctx.env.NOTIFY_SMS_PROVIDER_KEY?.trim()
  if (!apiUrl) {
    return {
      ok: false,
      code: "NOT_CONFIGURED",
      message: providerHint
        ? "sms: impostare NOTIFY_SMS_API_URL (NOTIFY_SMS_PROVIDER_KEY da solo non basta)"
        : "sms: NOTIFY_SMS_API_URL non impostato",
    }
  }

  const to = String(ctx.row.destinatario || "").trim()
  if (!to) {
    return { ok: false, code: "FAILED", message: "sms: destinatario mancante" }
  }

  const text = buildSmsBody(ctx)

  try {
    const headerName = (ctx.env.NOTIFY_SMS_API_HEADER || "Authorization").trim()
    const key = ctx.env.NOTIFY_SMS_API_KEY?.trim()
    const headers: Record<string, string> = { "Content-Type": "application/json" }
    if (key) {
      headers[headerName] =
        headerName.toLowerCase() === "authorization" ? `Bearer ${key}` : key
    }

    const res = await fetch(apiUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({
        to,
        text,
        tenant_id: ctx.row.tenant_id,
        notifica_id: ctx.row.id,
        tipo: ctx.row.tipo,
        provider: providerHint || undefined,
        payload: ctx.row.payload,
      }),
    })

    if (!res.ok) {
      const body = await res.text().catch(() => "")
      return {
        ok: false,
        code: "FAILED",
        message: `sms HTTP ${res.status}: ${body.slice(0, 200)}`,
      }
    }
    return { ok: true }
  } catch (e) {
    return {
      ok: false,
      code: "FAILED",
      message: `sms: ${e instanceof Error ? e.message : String(e)}`.slice(0, 400),
    }
  }
}

function buildSmsBody(ctx: AdapterSendContext): string {
  const p = ctx.row.payload || {}
  if (typeof p.text === "string" && p.text.trim()) return p.text.trim().slice(0, 640)
  if (typeof p.body === "string" && p.body.trim()) return p.body.trim().slice(0, 640)
  if (typeof p.testo === "string" && p.testo.trim()) return p.testo.trim().slice(0, 640)
  return `Notifica ${ctx.row.tipo || "ordine"}`.slice(0, 160)
}
