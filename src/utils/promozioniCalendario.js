/**
 * Promozioni per giorno della settimana + fascia oraria (parametri_operativi.promozioni_calendario).
 * `giorno_settimana`: 0 = Lunedì … 6 = Domenica (come orari_settimana).
 */

/** @param {Date} date */
export function getGiornoSettimanaLunDom(date) {
  const d = date || new Date()
  const jsDay = d.getDay()
  return (jsDay + 6) % 7
}

function minutesFromClock(str) {
  if (str == null || str === "") return null
  const s = String(str).trim()
  const m = /^(\d{1,2}):(\d{2})$/.exec(s)
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  if (!Number.isFinite(h) || !Number.isFinite(min)) return null
  return h * 60 + min
}

export function nowMinutesLocal(date) {
  const d = date || new Date()
  return d.getHours() * 60 + d.getMinutes()
}

/**
 * @param {unknown} po
 * @returns {Array<Record<string, unknown>>}
 */
function normalizeRules(po) {
  const raw = po && typeof po === "object" ? po.promozioni_calendario : null
  return Array.isArray(raw) ? raw : []
}

/**
 * @param {Record<string, unknown>} rule
 * @param {Date} now
 */
export function ruleMatchesTimeWindow(rule, now) {
  const start = minutesFromClock(rule.ora_inizio ?? "00:00")
  const end = minutesFromClock(rule.ora_fine ?? "23:59")
  if (start == null || end == null) return true
  const cur = nowMinutesLocal(now)
  if (end >= start) {
    return cur >= start && cur <= end
  }
  /* Fascia che attraversa mezzanotte (es. 22:00–02:00) */
  return cur >= start || cur <= end
}

/**
 * Giorno + fascia + categorie (stessa logica del prezzo promo).
 * @param {unknown} product — serve almeno `categoria_id`
 * @param {Record<string, unknown>} rule
 */
export function promoRuleAppliesToProduct(product, rule, now = new Date()) {
  if (!rule || rule.attivo === false) return false
  const g = Number(rule.giorno_settimana)
  if (!Number.isFinite(g) || g !== getGiornoSettimanaLunDom(now)) return false
  if (!ruleMatchesTimeWindow(rule, now)) return false
  const catId = product?.categoria_id != null ? String(product.categoria_id) : ""
  const cats = Array.isArray(rule.categoria_ids) ? rule.categoria_ids.map(String) : []
  if (cats.length > 0) {
    if (!catId || !cats.includes(catId)) return false
  }
  return true
}

/**
 * Se almeno una riga del carrello cade in una promo con `disabilita_fidelity`, non si accredita fidelity.
 */
export function fidelitySkippedByPromoCalendario(po, cart, now = new Date()) {
  const rules = normalizeRules(po).filter((r) => r && r.attivo !== false && r.disabilita_fidelity === true)
  if (!rules.length) return false
  for (const line of cart || []) {
    for (const rule of rules) {
      if (promoRuleAppliesToProduct(line, rule, now)) return true
    }
  }
  return false
}

/**
 * @param {unknown} product
 * @param {unknown} po
 * @param {Date} [now]
 * @returns {{ prezzo: number, prezzoOriginale: number, rule: object | null, applicabile: boolean }}
 */
export function resolvePromoCalendarioForProduct(product, po, now = new Date()) {
  const base = Number(product?.prezzo) || 0
  const rules = normalizeRules(po).filter((r) => r && r.attivo !== false)
  if (!rules.length) {
    return { prezzo: base, prezzoOriginale: base, rule: null, applicabile: false }
  }

  const giorno = getGiornoSettimanaLunDom(now)
  const catId = product?.categoria_id != null ? String(product.categoria_id) : ""

  for (const rule of rules) {
    const g = Number(rule.giorno_settimana)
    if (!Number.isFinite(g) || g !== giorno) continue
    if (!ruleMatchesTimeWindow(rule, now)) continue

    const cats = Array.isArray(rule.categoria_ids) ? rule.categoria_ids.map((x) => String(x)) : []
    if (cats.length > 0) {
      if (!catId || !cats.includes(catId)) continue
    }

    const solo = rule.solo_senza_modifiche_ingredienti === true
    if (solo) {
      /* In vetrina senza modifica; in cassa la modifica pizza usa altro flusso. */
    }

    const fx = Number(rule.prezzo_fisso_euro ?? rule.prezzo_fisso)
    if (!Number.isFinite(fx) || fx < 0) continue

    return { prezzo: fx, prezzoOriginale: base, rule, applicabile: true }
  }

  return { prezzo: base, prezzoOriginale: base, rule: null, applicabile: false }
}

/**
 * Applica prezzi promo a elenco prodotti (vetrina / griglia cassa senza modifica).
 * @param {unknown[]} products
 * @param {unknown} po
 * @param {Date} [now]
 */
export function applyPromoCalendarioToProducts(products, po, now = new Date()) {
  if (!Array.isArray(products)) return []
  return products.map((p) => {
    const r = resolvePromoCalendarioForProduct(p, po, now)
    if (!r.applicabile) {
      const { prezzo_listino_originale: _x, ...rest } = p
      return rest
    }
    return {
      ...p,
      prezzo: r.prezzo,
      prezzo_listino_originale: r.prezzoOriginale,
    }
  })
}
