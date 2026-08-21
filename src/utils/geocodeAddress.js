import { loadGoogleMapsScript } from "@/lib/googleMapsLoader"

const GOOGLE_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY

async function geocodeWithNominatim(q) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=it&q=${encodeURIComponent(q)}`
  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      // Nominatim richiede un User-Agent identificabile in uso non browser; in browser basta Accept.
    },
  })
  if (!res.ok) return null
  const data = await res.json()
  const row = Array.isArray(data) ? data[0] : null
  if (!row?.lat || !row?.lon) return null
  return { lat: parseFloat(row.lat), lng: parseFloat(row.lon) }
}

async function geocodeWithGoogleMapsJs(q) {
  if (!GOOGLE_KEY) return null
  await loadGoogleMapsScript(GOOGLE_KEY, null)
  if (typeof window.google?.maps?.importLibrary === "function") {
    await window.google.maps.importLibrary("geocoding").catch(() =>
      window.google.maps.importLibrary("maps"),
    )
  }
  const geocoder = new window.google.maps.Geocoder()
  const { results } = await geocoder.geocode({ address: q, region: "it" })
  const loc = results?.[0]?.geometry?.location
  if (!loc) return null
  return { lat: loc.lat(), lng: loc.lng() }
}

/**
 * Geocoding per verifica area consegna.
 * Preferisce Nominatim (niente script Maps → evita RefererNotAllowedMapError su localhost),
 * poi Google Maps JS se la chiave è autorizzata per l’host corrente.
 *
 * @param {string} address
 * @returns {Promise<{ lat: number, lng: number } | null>}
 */
export async function geocodeAddressForDelivery(address) {
  const q = (address || "").trim()
  if (!q) return null

  try {
    const osm = await geocodeWithNominatim(q)
    if (osm) return osm
  } catch (e) {
    console.warn("geocodeAddressForDelivery Nominatim:", e)
  }

  try {
    return await geocodeWithGoogleMapsJs(q)
  } catch (e) {
    console.warn("geocodeAddressForDelivery Google:", e)
    return null
  }
}
