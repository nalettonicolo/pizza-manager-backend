import { supabase } from "@/lib/supabaseClient"
import { PAYMENT_LINK_STATUS } from "./fiscalConstants"

/**
 * Crea un intent pay-by-link (URL + SMS gestiti da Edge/worker in seguito).
 * @param {{
 *   tenantId: string,
 *   ordineId: string,
 *   importoCent: number,
 *   idempotencyKey: string,
 *   destinatarioTelefono?: string | null,
 *   providerKey?: string | null,
 * }} p
 */
export async function createPaymentLinkIntent(p) {
  const row = {
    tenant_id: p.tenantId,
    ordine_id: p.ordineId,
    importo_cent: Math.round(p.importoCent),
    status: PAYMENT_LINK_STATUS.PENDING,
    idempotency_key: p.idempotencyKey,
    destinatario_telefono: p.destinatarioTelefono ?? null,
    provider_key: p.providerKey ?? null,
  }
  return supabase.from("payment_link_intents").insert(row).select("id").maybeSingle()
}

/**
 * @param {string} intentId
 * @param {Record<string, unknown>} patch
 */
export async function updatePaymentLinkIntent(intentId, patch) {
  if (!intentId) return { data: null, error: new Error("intentId mancante") }
  return supabase.from("payment_link_intents").update(patch).eq("id", intentId).select("id").maybeSingle()
}
