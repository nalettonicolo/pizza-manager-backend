import type { AdapterSendContext, AdapterSendResult } from "../types.ts"

/**
 * SMS verso staff/cliente.
 * TODO: collegare gateway scelto dal tenant (credenziali in DB o env per tenant).
 *
 * Env / DB future:
 * - NOTIFY_SMS_PROVIDER_KEY, NOTIFY_SMS_API_URL, NOTIFY_SMS_API_KEY
 * - oppure parametri_operativi.notifica_ordine_web_telefono_sms + provider tenant
 */
export async function sendSms(ctx: AdapterSendContext): Promise<AdapterSendResult> {
  const provider = ctx.env.NOTIFY_SMS_PROVIDER_KEY
  if (!provider) {
    return {
      ok: false,
      code: "NOT_CONFIGURED",
      message: "sms: NOTIFY_SMS_PROVIDER_KEY non impostato — scegliere gateway e implementare adapters/sms.ts",
    }
  }

  // TODO(INTEGRATION): chiamata API SMS del provider tenant
  void ctx.row.destinatario
  return {
    ok: false,
    code: "NOT_IMPLEMENTED",
    message: "sms: adapter stub — implementare invio in adapters/sms.ts",
  }
}
