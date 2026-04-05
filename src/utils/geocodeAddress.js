import { loadGoogleMapsScript } from "@/lib/googleMapsLoader"

const GOOGLE_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY

/**
 * @param {string} address
 * @returns {Promise<{ lat: number, lng: number } | null>}
 */
export async function geocodeAddressForDelivery(address) {
  const q = (address || "").trim()
  if (!q) return null

  if (GOOGLE_KEY) {
    try {
      await loadGoogleMapsScript(GOOGLE_KEY, null)
      const geocoder = new window.google.maps.Geocoder()
      const { results } = await geocoder.geocode({ address: q, region: "it" })
      const loc = results?.[0]?.geometry?.location
      if (loc) {
        return { lat: loc.lat(), lng: loc.lng() }
      }
    } catch (e) {
      console.warn("geocodeAddressForDelivery Google:", e)
    }
  }

  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=it&q=${encodeURIComponent(q)}`
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
    })
    if (!res.ok) return null
    const data = await res.json()
    const row = Array.isArray(data) ? data[0] : null
    if (!row?.lat || !row?.lon) return null
    return { lat: parseFloat(row.lat), lng: parseFloat(row.lon) }
  } catch (e) {
    console.warn("geocodeAddressForDelivery Nominatim:", e)
    return null
  }
}
