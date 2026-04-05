/**
 * Carica Google Maps JS (callback async). Ripetibile: no-op se già pronto per le librerie richieste.
 * @param {string} apiKey
 * @param {string | null} [extraLibraries] es. "drawing" o "places,drawing"
 */
export function loadGoogleMapsScript(apiKey, extraLibraries = null) {
  if (!apiKey) {
    return Promise.reject(new Error("Manca la chiave Google Maps"))
  }
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Maps solo in browser"))
  }

  const needDrawing = Boolean(extraLibraries && String(extraLibraries).includes("drawing"))
  if (window.google?.maps?.Map && (!needDrawing || window.google?.maps?.drawing?.DrawingManager)) {
    return Promise.resolve()
  }

  return new Promise((resolve, reject) => {
    const cbName = `__pmMaps_${Math.random().toString(36).slice(2, 11)}`
    window[cbName] = () => {
      try {
        delete window[cbName]
      } catch {
        window[cbName] = undefined
      }
      resolve()
    }
    const libQs = extraLibraries ? `&libraries=${encodeURIComponent(extraLibraries)}` : ""
    const script = document.createElement("script")
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&v=weekly&loading=async${libQs}&callback=${encodeURIComponent(cbName)}`
    script.async = true
    script.defer = true
    script.onerror = () => {
      try {
        delete window[cbName]
      } catch {
        /* ignore */
      }
      reject(new Error("Caricamento Google Maps fallito"))
    }
    document.head.appendChild(script)
  })
}
