/**
 * Notifiche al locale su nuovo ordine web.
 *
 * Percorso primario prodotto: stampa comanda automatica in sala (`stampa_comanda_ordine_web_automatica`).
 * Percorso alternativo: coda `notifiche_outbox` → worker Edge con adapter (email/sms/whatsapp/in_app).
 * Gli adapter sono stub: vedi `supabase/functions/_shared/notifications/adapters/` e
 * `docs/NOTIFICHE_INTEGRAZIONE.md`.
 */

import { supabase } from "@/lib/supabaseClient"

export function shouldQueueWebOrderEmailNotification(parametri) {
  if (!parametri || typeof parametri !== "object") return true
  if (parametri.stampa_comanda_ordine_web_automatica === true) return false
  return true
}

async function enqueueWebOrderNotificationRpc(tenantId, ordineId) {
  if (!tenantId || !ordineId) return false
  const { error } = await supabase.rpc("enqueue_nuovo_ordine_web_notifica", {
    p_tenant_id: tenantId,
    p_ordine_id: ordineId,
  })
  if (error) {
    console.warn("enqueue_nuovo_ordine_web_notifica", error.message ?? error)
    return false
  }
  return true
}

/**
 * Chiamata best-effort dopo creazione ordine.
 * Accoda su `notifiche_outbox` (canale da parametri tenant, modulo SQL 24).
 */
export async function maybeNotifyNewWebOrder({ tenantId, ordineId, parametri }) {
  if (!shouldQueueWebOrderEmailNotification(parametri)) return
  if (!tenantId || !ordineId) return
  await enqueueWebOrderNotificationRpc(tenantId, ordineId)
}
