/**
 * Icone e etichette brevi per tipo_pagamento in lista ordini cassa.
 * Ordine dei match: tipi più specifici prima di quelli generici (es. Stripe prima di "Carta").
 */

import {
  isTipoPagamentoPagaOnline,
  normalizeTipoPagamentoLabel,
  TIPO_PAGAMENTO_PAGA_ONLINE,
  listTipiPagamentoCassa,
  isCassaPagamentoPagaOnlineAbilitato,
  TIPO_PAGAMENTO_CONTANTI,
  TIPO_PAGAMENTO_CARTA,
  TIPO_PAGAMENTO_MISTO,
  TIPO_PAGAMENTO_DA_PAGARE,
  TIPO_PAGAMENTO_ALTRO,
} from "@/features/operative/cassa/utils/cassaPagamentiOptions"
import { getTenantOnlinePaymentProviders } from "@/constants/onlinePaymentProviders"

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

const LEGENDA_PAGAMENTO_BY_TIPO = {
  [TIPO_PAGAMENTO_CONTANTI]: { mark: "💵", text: "Contanti" },
  [TIPO_PAGAMENTO_CARTA]: { mark: "💳", text: "Carta / POS" },
  [TIPO_PAGAMENTO_MISTO]: { mark: "🔀", text: "Pagamento misto" },
  [TIPO_PAGAMENTO_DA_PAGARE]: { mark: "⏳", text: "Da pagare" },
  [TIPO_PAGAMENTO_PAGA_ONLINE]: { mark: "🔗", text: "Paga online (link)" },
  [TIPO_PAGAMENTO_ALTRO]: { mark: "🧾", text: "Altro" },
}

const LEGENDA_PAGAMENTO_BY_PROVIDER = {
  stripe: { mark: "🛒", text: "Pagamento online (Stripe)" },
  sumup: { mark: "📲", text: "SumUp" },
  satispay: { mark: "📱", text: "Satispay" },
}

/** Voci legenda pagamento in lista ordini Cassa — solo metodi attivi per il tenant. */
export function buildLegendaPagamentoOrdini(parametri, tenant) {
  const tipi = listTipiPagamentoCassa(parametri, { ordineOnline: false })
  const items = []
  const seen = new Set()

  for (const tipo of tipi) {
    const entry = LEGENDA_PAGAMENTO_BY_TIPO[tipo]
    if (entry && !seen.has(entry.text)) {
      items.push(entry)
      seen.add(entry.text)
    }
  }

  if (isCassaPagamentoPagaOnlineAbilitato(parametri)) {
    for (const row of getTenantOnlinePaymentProviders(tenant)) {
      const entry = LEGENDA_PAGAMENTO_BY_PROVIDER[row.provider_key]
      if (entry && !seen.has(entry.text)) {
        items.push(entry)
        seen.add(entry.text)
      }
    }
  }

  return items
}
