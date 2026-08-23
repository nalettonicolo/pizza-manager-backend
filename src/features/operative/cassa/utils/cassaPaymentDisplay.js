/**
 * Icone e etichette brevi per tipo_pagamento in lista ordini cassa.
 * Ordine dei match: tipi più specifici prima di quelli generici (es. Stripe prima di "Carta").
 */

import {
  isTipoPagamentoPagaOnline,
  normalizeTipoPagamentoLabel,
  TIPO_PAGAMENTO_PAGA_ONLINE,
} from "@/features/operative/cassa/utils/cassaPagamentiOptions"

export function iconTipoPagamentoLista(tipoPagamento) {
  const t = String(tipoPagamento || "").toLowerCase()
  if (t.includes("misto")) return "🔀"
  if (isTipoPagamentoPagaOnline(t)) return "🔗"
  if (t.includes("stripe") || (t.includes("online") && !t.includes("paga online")) || t.includes("3ds")) return "🛒"
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
  if (isTipoPagamentoPagaOnline(t) && !t.includes("stripe") && !t.includes("sumup")) return "Paga online"
  if (t.includes("stripe") || (t.includes("carta") && t.includes("online"))) return "Online"
  if (t.includes("sumup")) return "SumUp"
  if (t.includes("da pagare") || (t.includes("in attesa") && !t.includes("stripe"))) return "Da pag."
  if (t.includes("altro")) return "Altro"
  const raw = normalizeTipoPagamentoLabel(tipoPagamento)
  if (raw === TIPO_PAGAMENTO_PAGA_ONLINE) return "Paga online"
  if (raw.length > 14) return `${raw.slice(0, 12)}…`
  return raw || "—"
}

export function isTipoPagamentoLink(tipoPagamento) {
  return isTipoPagamentoPagaOnline(tipoPagamento)
}

/** Il pagamento (in attesa) è specificamente un provider online (Stripe/SumUp) o un link "Paga online"
 * generico — da segnalare a cassa in modo diverso da un semplice "da pagare" al banco/alla consegna. */
export function isTipoPagamentoOnlineProvider(tipoPagamento) {
  const t = String(tipoPagamento || "").toLowerCase()
  return isTipoPagamentoPagaOnline(t) || t.includes("stripe") || t.includes("sumup")
}

export function tipoPagamentoInAttesa(tipoPagamento) {
  const t = String(tipoPagamento || "").toLowerCase()
  return (
    t.includes("da pagare") ||
    isTipoPagamentoPagaOnline(t) ||
    (t.includes("stripe") && t.includes("attesa")) ||
    (t.includes("online") && t.includes("attesa"))
  )
}
