/**
 * Notifiche al locale su nuovo ordine web (email / Edge / webhook).
 * Se `parametri_operativi.stampa_comanda_ordine_web_automatica` è true, non accodare notifiche:
 * il locale si affida alla stampa comanda in sala.
 */

export function shouldQueueWebOrderEmailNotification(parametri) {
  if (!parametri || typeof parametri !== "object") return true
  if (parametri.stampa_comanda_ordine_web_automatica === true) return false
  return true
}

/**
 * Chiamata best-effort dopo creazione ordine. Richiede `VITE_NOTIFY_ORDER_WEBHOOK_URL` opzionale (POST JSON).
 */
export async function maybeNotifyNewWebOrder({ tenantId, ordineId, parametri }) {
  if (!shouldQueueWebOrderEmailNotification(parametri)) return
  const url = typeof import.meta !== "undefined" ? import.meta.env?.VITE_NOTIFY_ORDER_WEBHOOK_URL : null
  if (!url || typeof url !== "string" || !url.startsWith("http")) return
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tenantId, ordineId, source: "web_checkout" }),
    })
  } catch (e) {
    console.warn("maybeNotifyNewWebOrder", e)
  }
}
