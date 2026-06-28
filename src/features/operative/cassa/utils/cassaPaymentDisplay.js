/**
 * Icone e etichette brevi per tipo_pagamento in lista ordini cassa.
 * Ordine dei match: tipi più specifici prima di quelli generici (es. Stripe prima di "Carta").
 */

export function iconTipoPagamentoLista(tipoPagamento) {
  const t = String(tipoPagamento || "").toLowerCase()
  if (t.includes("misto")) return "🔀"
  if (t.includes("link") || t.includes("carta da casa") || t.includes("pay-by-link")) return "🔗"
  if (t.includes("stripe") || t.includes("online") || t.includes("3ds")) return "🛒"
  if (t.includes("sumup")) return "📲"
  if (t.includes("satispay")) return "📱"
  if (t.includes("bonifico")) return "🏦"
  if (t.includes("voucher") || t.includes("buono")) return "🎟️"
  if (t.includes("contanti") || t.includes("cash")) return "💵"
  if (t.includes("carta") || t.includes("pos") || t.includes("bancomat")) return "💳"
  if (t.includes("altro")) return "🧾"
  if (t.includes("da pagare") || t.includes("in attesa")) return "⏳"
  return "📋"
}

export function labelTipoPagamentoLista(tipoPagamento) {
  const t = String(tipoPagamento || "").toLowerCase()
  if (t.includes("misto")) return "Misto"
  if (t.includes("link") || t.includes("carta da casa")) return "Link"
  if (t.includes("stripe") || (t.includes("carta") && t.includes("online"))) return "Online"
  if (t.includes("sumup")) return "SumUp"
  if (t.includes("da pagare") || (t.includes("in attesa") && !t.includes("stripe"))) return "Da pag."
  if (t.includes("altro")) return "Altro"
  const raw = String(tipoPagamento || "—").trim()
  if (raw.length > 14) return `${raw.slice(0, 12)}…`
  return raw || "—"
}

export function tipoPagamentoInAttesa(tipoPagamento) {
  const t = String(tipoPagamento || "").toLowerCase()
  return (
    t.includes("da pagare") ||
    t.includes("link") ||
    t.includes("carta da casa") ||
    (t.includes("stripe") && t.includes("attesa")) ||
    (t.includes("online") && t.includes("attesa"))
  )
}
