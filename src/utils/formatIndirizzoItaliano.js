/**
 * Indirizzo su una riga in stile italiano: strada e civico, virgola, città e CAP attaccato.
 * Esempio: "Via Fondà 19a/1, Padova 35124"
 */

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
 * Risultato ricerca Nominatim con `format=json` e `addressdetails=1`.
 * @param {object} item
 * @returns {string}
 */
export function formatIndirizzoFromNominatim(item) {
  if (!item || typeof item !== "object") return ""
  const addr = item.address && typeof item.address === "object" ? item.address : null
  if (!addr) {
    return String(item.display_name || "").trim()
  }
  const road = String(addr.road || addr.pedestrian || addr.path || "").trim()
  const houseParts = [addr.house_number, addr.house_name].map((x) => (x != null ? String(x).trim() : "")).filter(Boolean)
  const house = houseParts.join(" ").trim()
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
  return String(item.display_name || "").trim()
}
