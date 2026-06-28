import type { AdapterSendContext, AdapterSendResult } from "../types.ts"

/**
 * WhatsApp Business API (credenziali del singolo tenant / locale).
 * TODO: implementare Cloud API Meta o bridge self-hosted del tenant.
 *
 * Env / DB future:
 * - NOTIFY_WHATSAPP_API_URL, NOTIFY_WHATSAPP_TOKEN (o per-tenant in admin.tenant_notification_secrets)
 */
export async function sendWhatsApp(ctx: AdapterSendContext): Promise<AdapterSendResult> {
  const apiUrl = ctx.env.NOTIFY_WHATSAPP_API_URL
  if (!apiUrl) {
    return {
      ok: false,
      code: "NOT_CONFIGURED",
      message:
        "whatsapp: NOTIFY_WHATSAPP_API_URL non impostato — implementare adapters/whatsapp.ts con API tenant",
    }
  }

  // TODO(INTEGRATION): POST messaggio template/session al numero ctx.row.destinatario
  void ctx.row.payload
  return {
    ok: false,
    code: "NOT_IMPLEMENTED",
    message: "whatsapp: adapter stub — implementare invio in adapters/whatsapp.ts",
  }
}
