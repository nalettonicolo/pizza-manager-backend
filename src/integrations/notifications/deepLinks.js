/**
 * Link nativi telefono (nessun gateway esterno PizzaManager).
 * Lo staff apre WhatsApp/SMS sul proprio device e invia manualmente o semi-manualmente.
 */

function digitsOnly(phone) {
  return String(phone ?? "").replace(/\D/g, "")
}

/** @param {string} phone @param {string} text */
export function buildWhatsAppDeepLink(phone, text) {
  const digits = digitsOnly(phone)
  if (!digits) return null
  const q = encodeURIComponent(String(text ?? "").trim())
  return `https://wa.me/${digits}${q ? `?text=${q}` : ""}`
}

/** @param {string} phone @param {string} text */
export function buildSmsDeepLink(phone, text) {
  const digits = digitsOnly(phone)
  if (!digits) return null
  const body = encodeURIComponent(String(text ?? "").trim())
  return `sms:${digits}${body ? `?body=${body}` : ""}`
}

/** Testo breve per avviso nuovo ordine web (deep link / copia). */
export function formatNuovoOrdineWebStaffMessage({ ordineId, numero, totale, nomeCliente } = {}) {
  const parts = ["Nuovo ordine web PizzaManager"]
  if (numero != null) parts.push(`#${numero}`)
  if (nomeCliente) parts.push(String(nomeCliente).trim())
  if (totale != null) parts.push(`€ ${Number(totale).toFixed(2)}`)
  if (ordineId) parts.push(`id:${String(ordineId).slice(0, 8)}`)
  return parts.join(" · ")
}
