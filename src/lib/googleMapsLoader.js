/**
 * Carica Google Maps JS una sola volta per pagina (evita "API included multiple times" e errori gmp-*).
 * Le librerie nell'URL sono unificate: `drawing` è sempre inclusa (serve a Area consegna); altre opzionali.
 * Places si può aggiungere con importLibrary("places") dopo il load.
 * @param {string} apiKey
 * @param {string | null} [extraLibraries] es. "places" o "places,drawing" (drawing è sempre nel bundle URL)
 */
const SCRIPT_ATTR = "data-pm-google-maps"
const CB_NAME = "__pmGoogleMapsOnLoad"

function normalizeLibraries(extraLibraries) {
  const set = new Set(["drawing"])
  if (extraLibraries) {
    for (const part of String(extraLibraries).split(",")) {
      const t = part.trim()
      if (t) set.add(t)
    }
  }
  return [...set].sort().join(",")
}

function hasLibrariesLoaded(librariesParam) {
  if (!window.google?.maps?.Map) return false
  if (librariesParam.includes("drawing") && !window.google.maps?.drawing?.DrawingManager) {
    return false
  }
  return true
}

/** Promise condivisa: una sola iniezione di script anche con mount concorrenti o route diverse. */
let loadPromise = null

export function loadGoogleMapsScript(apiKey, extraLibraries = null) {
  if (!apiKey) {
    return Promise.reject(new Error("Manca la chiave Google Maps"))
  }
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Maps solo in browser"))
  }

  const libraries = normalizeLibraries(extraLibraries)

  if (hasLibrariesLoaded(libraries)) {
    return Promise.resolve()
  }

  if (loadPromise) {
    return loadPromise
  }

  loadPromise = new Promise((resolve, reject) => {
    const finishOk = () => {
      if (hasLibrariesLoaded(libraries)) {
        resolve()
        return true
      }
      return false
    }

    const existing = document.querySelector(`script[${SCRIPT_ATTR}="1"]`)
    if (existing) {
      const t0 = Date.now()
      const iv = window.setInterval(() => {
        if (finishOk()) {
          window.clearInterval(iv)
        } else if (Date.now() - t0 > 60000) {
          window.clearInterval(iv)
          loadPromise = null
          reject(new Error("Timeout in attesa di Google Maps"))
        }
      }, 50)
      return
    }

    window[CB_NAME] = () => {
      try {
        delete window[CB_NAME]
      } catch {
        window[CB_NAME] = undefined
      }
      if (!hasLibrariesLoaded(libraries)) {
        loadPromise = null
        reject(new Error("Google Maps caricato ma librerie richieste mancanti"))
        return
      }
      resolve()
    }

    const script = document.createElement("script")
    script.setAttribute(SCRIPT_ATTR, "1")
    script.async = true
    script.defer = true
    script.onerror = () => {
      loadPromise = null
      try {
        delete window[CB_NAME]
      } catch {
        /* ignore */
      }
      reject(new Error("Caricamento Google Maps fallito"))
    }
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&v=weekly&loading=async&libraries=${encodeURIComponent(libraries)}&callback=${encodeURIComponent(CB_NAME)}`
    document.head.appendChild(script)
  }).catch((err) => {
    loadPromise = null
    throw err
  })

  return loadPromise
}
