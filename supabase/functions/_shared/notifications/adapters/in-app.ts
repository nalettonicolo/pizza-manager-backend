import type { AdapterSendContext, AdapterSendResult } from "../types.ts"

/**
 * Nessun invio esterno: l’ordine è già visibile su cucina/cassa/delivery (polling).
 * La coda registra solo l’evento per audit / monitor admin.
 */
export async function sendInApp(_ctx: AdapterSendContext): Promise<AdapterSendResult> {
  return { ok: true }
}
