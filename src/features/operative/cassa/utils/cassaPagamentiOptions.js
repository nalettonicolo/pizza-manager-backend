/**
 * Tipi pagamento cassa / ordini web (etichette salvate in `tipo_pagamento`).
 */

export const TIPO_PAGAMENTO_CONTANTI = "Contanti"
export const TIPO_PAGAMENTO_CARTA = "Carta"
export const TIPO_PAGAMENTO_MISTO = "Misto"
export const TIPO_PAGAMENTO_DA_PAGARE = "Da pagare"
export const TIPO_PAGAMENTO_PAGA_ONLINE = "Paga online"
export const TIPO_PAGAMENTO_ALTRO = "Altro"

/** Etichetta legacy ancora presente su ordini storici. */
export const TIPO_PAGAMENTO_LINK_LEGACY = "Link (carta da casa)"

const TIPI_CASSA_COMPLETI = [
  TIPO_PAGAMENTO_CONTANTI,
  TIPO_PAGAMENTO_CARTA,
  TIPO_PAGAMENTO_MISTO,
  TIPO_PAGAMENTO_DA_PAGARE,
  TIPO_PAGAMENTO_PAGA_ONLINE,
  TIPO_PAGAMENTO_ALTRO,
]

const TIPI_ORDINE_ONLINE = [TIPO_PAGAMENTO_CONTANTI, TIPO_PAGAMENTO_CARTA, TIPO_PAGAMENTO_PAGA_ONLINE]

function flagOn(po, key, defaultOn = true) {
  if (!po || typeof po !== "object") return defaultOn
  const v = po[key]
  if (v === false || v === "false" || v === 0 || v === "0") return false
  if (v === true || v === "true" || v === 1 || v === "1") return true
  return defaultOn
}

/** Contanti/Carta: default attivi. Paga online: default attivo se non spegnuto esplicitamente. */
export function isCassaPagamentoContantiAbilitato(parametri) {
  return flagOn(parametri, "cassa_pagamento_contanti", true)
}

export function isCassaPagamentoCartaAbilitato(parametri) {
  return flagOn(parametri, "cassa_pagamento_carta", true)
}

export function isCassaPagamentoPagaOnlineAbilitato(parametri) {
  return flagOn(parametri, "cassa_pagamento_paga_online", true)
}

export function isTipoPagamentoPagaOnline(tipoPagamento) {
  const t = String(tipoPagamento || "").toLowerCase()
  return (
    t.includes("paga online") ||
    t.includes("link") ||
    t.includes("carta da casa") ||
    t.includes("pay-by-link")
  )
}

/**
 * Ordine proveniente dalla vetrina / canale web (note o pagamento online in attesa).
 */
export function isOrdineOnlineCanale(ordine) {
  if (!ordine || typeof ordine !== "object") return false
  const note = String(ordine.note ?? "").toLowerCase()
  if (note.includes("ordine web")) return true
  const tipo = String(ordine.tipo_pagamento ?? ordine.tipoPagamento ?? "").toLowerCase()
  if (tipo.includes("stripe") || tipo.includes("sumup") || tipo.includes("online — in attesa") || tipo.includes("online - in attesa")) {
    return true
  }
  if (ordine.richiede_accettazione_cassa === true || ordine.richiedeAccettazioneCassa === true) return true
  return false
}

function filterByAdminFlags(tipi, parametri) {
  return (tipi || []).filter((t) => {
    if (t === TIPO_PAGAMENTO_CONTANTI) return isCassaPagamentoContantiAbilitato(parametri)
    if (t === TIPO_PAGAMENTO_CARTA) return isCassaPagamentoCartaAbilitato(parametri)
    if (t === TIPO_PAGAMENTO_PAGA_ONLINE || t === TIPO_PAGAMENTO_LINK_LEGACY) {
      return isCassaPagamentoPagaOnlineAbilitato(parametri)
    }
    return true
  })
}

/**
 * @param {Record<string, unknown>|null|undefined} parametri
 * @param {{ ordineOnline?: boolean }} [opts]
 */
export function listTipiPagamentoCassa(parametri, opts = {}) {
  const ordineOnline = opts.ordineOnline === true
  const base = ordineOnline ? TIPI_ORDINE_ONLINE : TIPI_CASSA_COMPLETI
  const filtered = filterByAdminFlags(base, parametri)
  return filtered.length ? filtered : [TIPO_PAGAMENTO_CONTANTI]
}

/** Normalizza etichetta storica → «Paga online». */
export function normalizeTipoPagamentoLabel(tipoPagamento) {
  if (isTipoPagamentoPagaOnline(tipoPagamento) && !String(tipoPagamento || "").toLowerCase().includes("stripe") && !String(tipoPagamento || "").toLowerCase().includes("sumup")) {
    const t = String(tipoPagamento || "").toLowerCase()
    if (t.includes("link") || t.includes("carta da casa") || t.includes("paga online") || t.includes("pay-by-link")) {
      return TIPO_PAGAMENTO_PAGA_ONLINE
    }
  }
  return String(tipoPagamento || "").trim() || "—"
}
