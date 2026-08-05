import type { AdapterSendContext, AdapterSendResult } from "../types.ts"

/**
 * WhatsApp generico: POST JSON verso Cloud API / bridge self-hosted.
 *
 * Env:
 * - NOTIFY_WHATSAPP_API_URL (obbligatorio)
 * - NOTIFY_WHATSAPP_TOKEN (Bearer se header Authorization)
 * - NOTIFY_WHATSAPP_API_HEADER (default Authorization)
 */
export async function sendWhatsApp(ctx: AdapterSendContext): Promise<AdapterSendResult> {
  const apiUrl = ctx.env.NOTIFY_WHATSAPP_API_URL?.trim()
  if (!apiUrl) {
    return {
      ok: false,
      code: "NOT_CONFIGURED",
      message: "whatsapp: NOTIFY_WHATSAPP_API_URL non impostato",
    }
  }

  const to = String(ctx.row.destinatario || "").trim()
  if (!to) {
    return { ok: false, code: "FAILED", message: "whatsapp: destinatario mancante" }
  }

  const text = buildWhatsAppBody(ctx)
  const token = ctx.env.NOTIFY_WHATSAPP_TOKEN?.trim()

  try {
    const headerName = (ctx.env.NOTIFY_WHATSAPP_API_HEADER || "Authorization").trim()
    const headers: Record<string, string> = { "Content-Type": "application/json" }
    if (token) {
      headers[headerName] =
        headerName.toLowerCase() === "authorization" ? `Bearer ${token}` : token
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
        payload: ctx.row.payload,
      }),
    })

    if (!res.ok) {
      const body = await res.text().catch(() => "")
      return {
        ok: false,
        code: "FAILED",
        message: `whatsapp HTTP ${res.status}: ${body.slice(0, 200)}`,
      }
    }
    return { ok: true }
  } catch (e) {
    return {
      ok: false,
      code: "FAILED",
      message: `whatsapp: ${e instanceof Error ? e.message : String(e)}`.slice(0, 400),
    }
  }
}

function buildWhatsAppBody(ctx: AdapterSendContext): string {
  const p = ctx.row.payload || {}
  if (typeof p.text === "string" && p.text.trim()) return p.text.trim()
  if (typeof p.body === "string" && p.body.trim()) return p.body.trim()
  if (typeof p.testo === "string" && p.testo.trim()) return p.testo.trim()
  try {
    return JSON.stringify(p)
  } catch {
    return `Notifica ${ctx.row.tipo || ""}`
  }
}
