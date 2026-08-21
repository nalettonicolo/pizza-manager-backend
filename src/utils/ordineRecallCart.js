/**
 * Mappa righe ordine (RPC/DB) → payload carrello vetrina / cassa.
 * Le modifiche strutturate non sono in DB: si conserva `ingredienti_cottura_summary`.
 */

export function normalizePhoneDigits(value) {
  return String(value || "").replace(/\D/g, "")
}

export function phonesMatchLoose(a, b) {
  const x = normalizePhoneDigits(a)
  const y = normalizePhoneDigits(b)
  if (!x || !y) return false
  if (x === y) return true
  if (x.length >= 8 && y.length >= 8) return x.endsWith(y) || y.endsWith(x)
  return false
}

export function emailsMatchLoose(a, b) {
  const x = String(a || "").trim().toLowerCase()
  const y = String(b || "").trim().toLowerCase()
  return Boolean(x && y && x === y)
}

/**
 * Riga ordine → item carrello pubblico.
 * @param {object} riga
 * @param {{ productNames?: Record<string,string> }} [opts]
 */
export function orderLineToPublicCartItem(riga, opts = {}) {
  if (!riga) return null
  const id = riga.prodotto_id ?? riga.prodottoId
  if (!id) return null
  const formatoNome = riga.formato_nome ?? riga.formatoNome ?? undefined
  const summary = String(
    riga.ingredienti_cottura_summary ?? riga.ingredientiCotturaSummary ?? "",
  ).trim()
  const nomeFromMap = opts.productNames?.[id]
  const nome = String(
    riga.prodotto_nome ?? riga.prodottoNome ?? nomeFromMap ?? "Prodotto",
  ).trim()
  const qty = Math.max(1, Math.floor(Number(riga.quantita ?? riga.qty) || 1))
  const prezzo = Number(riga.prezzo) || 0
  return {
    id,
    nome,
    prezzo,
    qty,
    formatoNome: formatoNome || undefined,
    ingredientiCotturaSummary: summary || undefined,
  }
}

/**
 * Riga ordine → payload per `addToCartWithIngredienti` (cassa).
 * @param {object} riga
 * @param {{ productNames?: Record<string,string>, product?: object }} [opts]
 */
export function orderLineToCassaCartPayload(riga, opts = {}) {
  const pub = orderLineToPublicCartItem(riga, opts)
  if (!pub) return null
  const product = opts.product && typeof opts.product === "object" ? opts.product : null
  const base = product
    ? { ...product }
    : {
        id: pub.id,
        nome: pub.nome,
        prezzo: pub.prezzo,
      }
  const summary = pub.ingredientiCotturaSummary || ""
  return {
    product: {
      ...base,
      id: pub.id,
      nome: pub.nome || base.nome,
      prezzo: pub.prezzo,
      formatoNome: pub.formatoNome,
    },
    modsPayload: {
      prezzoCalcolato: pub.prezzo,
      ingredientiCotturaSummary: summary,
      ingredientiModifiche: undefined,
      extraIngredienti: [],
      formatoNome: pub.formatoNome || null,
    },
    qty: pub.qty,
  }
}

/**
 * @param {object[]} righe
 * @param {{ productNames?: Record<string,string> }} [opts]
 */
export function orderLinesToPublicCartItems(righe, opts = {}) {
  const out = []
  for (const r of Array.isArray(righe) ? righe : []) {
    const item = orderLineToPublicCartItem(r, opts)
    if (item) out.push(item)
  }
  return out
}

export function ordineStatoIncompleto(ordine) {
  const s = String(ordine?.stato ?? "").trim().toUpperCase()
  if (s === "IN_ATTESA") return true
  const pag = String(ordine?.tipo_pagamento ?? ordine?.tipoPagamento ?? "").toLowerCase()
  if (pag.includes("in attesa")) return true
  return false
}
