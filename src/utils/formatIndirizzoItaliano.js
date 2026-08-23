/**
 * Indirizzo su una riga in stile italiano: strada e civico, virgola, città e CAP attaccato.
 * Esempio: "Via Fondà 19a/1, Padova 35124"
 */

/** Regioni IT (token tra comune e CAP in molti display_name Nominatim/OSM). */
const IT_REGIONI = new Set(
  [
    "abruzzo",
    "basilicata",
    "calabria",
    "campania",
    "emilia-romagna",
    "emilia romagna",
    "friuli-venezia giulia",
    "friuli venezia giulia",
    "lazio",
    "liguria",
    "lombardia",
    "marche",
    "molise",
    "piemonte",
    "puglia",
    "sardegna",
    "sicilia",
    "sicily",
    "toscana",
    "trentino-alto adige",
    "trentino alto adige",
    "trentino-south tyrol",
    "umbria",
    "valle d'aosta",
    "valle daosta",
    "aosta valley",
    "veneto",
  ].map((s) => s.toLowerCase()),
)

function isRegioneItalianaToken(token) {
  const x = String(token || "")
    .trim()
    .toLowerCase()
  return IT_REGIONI.has(x)
}

const VIA_LIKE =
  /^(via|viale|piazza|largo|corso|vicolo|str\.?|strada|p\.?\s*z\.?|contrada|località|loc\.|c\.?\s*so\.?|borgo)/i

/**
 * Normalizza per la UI stringhe tipo display_name Nominatim/Google:
 * "12, Via Guasti, …, Padova, Veneto, 35124, Italia" → "Via Guasti 12, Padova 35124".
 * Se non riconosce un CAP italiano a 5 cifre o la struttura non è quella attesa, restituisce la stringa originale.
 *
 * @param {string} raw
 * @returns {string}
 */
export function formatIndirizzoDisplayItaliano(raw) {
  const s0 = String(raw || "").trim()
  if (!s0) return ""
  if (!s0.includes(",")) return s0

  let parts = s0
    .split(",")
    .map((p) => p.trim())
    .filter((p) => p.length > 0)
  if (parts.length < 2) return s0

  while (parts.length && /^(italia|italy)$/i.test(parts[parts.length - 1])) {
    parts.pop()
  }
  if (parts.length < 2) return s0

  const capIndex = parts.findIndex((p) => /^\d{5}$/.test(p))
  if (capIndex < 0) return s0

  const postcode = parts[capIndex]
  let idx = capIndex - 1
  if (idx < 0) return s0
  let city = parts[idx]
  if (isRegioneItalianaToken(city) && idx > 0) {
    idx -= 1
    city = parts[idx]
  }
  if (/^[A-Z]{2}$/i.test(city) && idx > 0) {
    idx -= 1
    city = parts[idx]
  }

  const streetParts = parts.slice(0, idx)
  if (streetParts.length === 0) {
    return formatIndirizzoLineaItaliana({ city, postcode })
  }

  let house = ""
  let roadTokens = []
  if (streetParts.length && /^\d+[a-zA-Z]*(?:\/\d+[a-zA-Z]*)?$/i.test(streetParts[0])) {
    house = streetParts[0]
    roadTokens = streetParts.slice(1)
  } else {
    roadTokens = streetParts
  }

  const roadIdx = roadTokens.findIndex((t) => VIA_LIKE.test(t))
  const road = roadIdx >= 0 ? roadTokens[roadIdx] : roadTokens.length ? roadTokens[0] : ""

  const line = formatIndirizzoLineaItaliana({
    road,
    houseNumber: house,
    city,
    postcode,
  })
  return line || s0
}

/**
 * @param {{ road?: string, houseNumber?: string, city?: string, postcode?: string }} p
 * @returns {string}
 */
export function formatIndirizzoLineaItaliana(p) {
  const road = String(p?.road || "").trim()
  const house = String(p?.houseNumber || "").trim()
  const city = String(p?.city || "").trim()
  const postcode = String(p?.postcode || "").trim()
  const street = [road, house].filter(Boolean).join(" ").trim()
  if (street && city && postcode) {
    return `${street}, ${city} ${postcode}`.trim()
  }
  if (street && city) {
    return `${street}, ${city}`.trim()
  }
  if (street && postcode) {
    return `${street} ${postcode}`.trim()
  }
  if (city && postcode) {
    return `${city} ${postcode}`.trim()
  }
  return street || [city, postcode].filter(Boolean).join(" ").trim()
}

/**
 * @param {Array<{ types?: string[], longText?: string, long_name?: string, shortText?: string }>} components
 * @returns {string}
 */
export function formatIndirizzoFromGoogleAddressComponents(components) {
  if (!Array.isArray(components) || components.length === 0) return ""
  const long = (c) => String(c?.longText ?? c?.long_name ?? "").trim()
  const pick = (...types) => {
    for (const t of types) {
      const c = components.find((x) => Array.isArray(x.types) && x.types.includes(t))
      const v = c ? long(c) : ""
      if (v) return v
    }
    return ""
  }
  const route = pick("route")
  const streetNumber = pick("street_number")
  const locality =
    pick("locality", "postal_town", "administrative_area_level_3", "sublocality_level_1") ||
    pick("administrative_area_level_2")
  const postalCode = pick("postal_code")
  return formatIndirizzoLineaItaliana({
    road: route,
    houseNumber: streetNumber,
    city: locality,
    postcode: postalCode,
  })
}

/**
 * Civico digitato dopo il nome via (es. "Via Rossi 12" → "12", "Via Rossi 12, Padova" → "12" —
 * cerca solo nel primo pezzo prima della virgola, non in fondo a tutta la stringa: altrimenti con
 * città/CAP già digitati dopo il civico (caso comune mentre si continua a scrivere) il numero non
 * è più l'ultimo token e sparisce). Esclude il CAP, sempre 5 cifre. Riconosce anche il civico con
 * sub-unità separata da barra (es. "19a/1", frequente in alcune città) — senza questo, digitando
 * quella forma veniva riconosciuta solo la parte dopo la barra ("1"), perdendo "19a/".
 */
function extractTypedCivico(query) {
  const primoPezzo = String(query || "").trim().split(",")[0] || ""
  const m = primoPezzo.match(/(\d{1,4}[a-zA-Z]?(?:\/\d{1,4}[a-zA-Z]?)?)\s*$/)
  return m ? m[1] : ""
}

/**
 * Risultato ricerca Nominatim con `format=json` e `addressdetails=1`.
 * @param {object} item
 * @param {string} [typedQuery] — testo digitato dall'utente: se Nominatim non ha il civico esatto
 *   indicizzato (house_number assente), il civico digitato viene usato comunque nel suggerimento
 *   invece di sparire silenziosamente (la posizione geografica resta quella della via).
 * @returns {string}
 */
export function formatIndirizzoFromNominatim(item, typedQuery = "") {
  if (!item || typeof item !== "object") return ""
  const addr = item.address && typeof item.address === "object" ? item.address : null
  if (!addr) {
    return String(item.display_name || "").trim()
  }
  const road = String(addr.road || addr.pedestrian || addr.path || "").trim()
  const houseParts = [addr.house_number, addr.house_name].map((x) => (x != null ? String(x).trim() : "")).filter(Boolean)
  const house = houseParts.join(" ").trim() || extractTypedCivico(typedQuery)
  const city = String(
    addr.city ||
      addr.town ||
      addr.village ||
      addr.municipality ||
      addr.city_district ||
      addr.hamlet ||
      addr.county ||
      "",
  ).trim()
  const postcode = String(addr.postcode || "").trim()
  const line = formatIndirizzoLineaItaliana({
    road,
    houseNumber: house,
    city,
    postcode,
  })
  if (line) return line
  const dn = String(item.display_name || "").trim()
  if (dn && (/\b\d{5}\b/.test(dn) || /,\s*(Italia|Italy)\s*$/i.test(dn))) {
    const normalized = formatIndirizzoDisplayItaliano(dn)
    if (normalized && normalized !== dn) return normalized
  }
  return dn
}
