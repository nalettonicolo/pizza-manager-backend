import { supabase } from "@/lib/supabaseClient"
import { FISCAL_OUTBOX_KINDS, FISCAL_OUTBOX_STATUS } from "./fiscalConstants"

/**
 * Accoda un messaggio fiscal (no-op finché non esiste worker / Edge Function).
 * Idempotente per (tenant_id, idempotency_key).
 *
 * @param {{
 *   tenantId: string,
 *   ordineId?: string | null,
 *   puntoVenditaId?: string | null,
 *   kind: string,
 *   idempotencyKey: string,
 *   payloadCanonical?: Record<string, unknown>,
 *   providerKey?: string | null,
 * }} row
 * @returns {Promise<{ data: object | null, error: Error | null }>}
 */
export async function enqueueFiscalOutbox(row) {
  const payload = {
    tenant_id: row.tenantId,
    ordine_id: row.ordineId ?? null,
    punto_vendita_id: row.puntoVenditaId ?? null,
    kind: row.kind,
    status: FISCAL_OUTBOX_STATUS.PENDING,
    idempotency_key: row.idempotencyKey,
    payload_canonical: row.payloadCanonical ?? {},
    provider_key: row.providerKey ?? null,
  }
  const { data, error } = await supabase.from("fiscal_outbox").insert(payload).select("id").maybeSingle()
  return { data, error }
}

/**
 * Esempio hook post-checkout: in modalità none l'adapter non invia nulla;
 * in futuro qui si ramifica verso export o RT.
 */
export async function enqueueCorrispettivoAfterCheckoutIfConfigured({
  tenantId,
  ordineId,
  puntoVenditaId,
  fiscalMode,
  fiscalProviderKey,
  checkoutSnapshot,
}) {
  if (!tenantId || !ordineId) return { skipped: true, reason: "missing_ids" }
  if (!fiscalMode || fiscalMode === "none") return { skipped: true, reason: "fiscal_mode_none" }

  const idempotencyKey = `corrispettivo:${ordineId}`
  return enqueueFiscalOutbox({
    tenantId,
    ordineId,
    puntoVenditaId: puntoVenditaId ?? null,
    kind: FISCAL_OUTBOX_KINDS.CORRISPETTIVO_RT,
    idempotencyKey,
    payloadCanonical: { ordine_id: ordineId, snapshot: checkoutSnapshot ?? {} },
    providerKey: fiscalProviderKey,
  })
}
