import type { AdapterSendContext, AdapterSendResult } from "../types.ts"

/**
 * Email via SMTP (tenant o piattaforma).
 * TODO: completare con libreria SMTP Deno o POST verso Nest `POST /notifications/email`.
 *
 * Env previste (nessun SaaS obbligatorio):
 * - NOTIFY_SMTP_HOST, NOTIFY_SMTP_PORT, NOTIFY_SMTP_USER, NOTIFY_SMTP_PASS
 * - NOTIFY_FROM_EMAIL
 */
export async function sendEmailSmtp(ctx: AdapterSendContext): Promise<AdapterSendResult> {
  const host = ctx.env.NOTIFY_SMTP_HOST
  const from = ctx.env.NOTIFY_FROM_EMAIL
  if (!host || !from) {
    return {
      ok: false,
      code: "NOT_CONFIGURED",
      message: "email_smtp: impostare NOTIFY_SMTP_HOST e NOTIFY_FROM_EMAIL (Edge secrets o Nest)",
    }
  }

  // ---------------------------------------------------------------------------
  // TODO(INTEGRATION): implementare invio SMTP reale qui oppure delegare a Koyeb:
  //   await fetch(`${NEST_API_URL}/internal/notifications/email`, { method: 'POST', body: ... })
  // ---------------------------------------------------------------------------
  void ctx.row.destinatario
  void ctx.row.payload
  return {
    ok: false,
    code: "NOT_IMPLEMENTED",
    message: "email_smtp: adapter stub — implementare invio in adapters/email-smtp.ts",
  }
}
