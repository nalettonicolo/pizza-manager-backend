/**
 * Carica Google Maps JS una sola volta per pagina (evita "API included multiple times").
 * Non usa più la libreria `drawing` (rimossa da Maps JS API ≥ 3.65).
 * Places: passare "places" in extraLibraries oppure importLibrary("places") dopo il load.
 *
 * Con `loading=async` (loader moderno) `google.maps.Map` NON è disponibile al callback:
 * esiste `importLibrary`. Non trattarlo come fallimento.
 *
 * @param {string} apiKey
 * @param {string | null} [extraLibraries] es. "places"
 */
const SCRIPT_ATTR = "data-pm-google-maps"
const CB_NAME = "__pmGoogleMapsOnLoad"

function normalizeLibraries(extraLibraries) {
  const set = new Set()
  if (extraLibraries) {
    for (const part of String(extraLibraries).split(",")) {
      const t = part.trim().toLowerCase()
      if (t && t !== "drawing") set.add(t)
    }
  }
  return [...set].sort().join(",")
}

/** Bootstrap pronto: Map legacy OPPURE importLibrary (loading=async). */
function mapsBootstrapReady() {
  const maps = window.google?.maps
  if (!maps) return false
  return typeof maps.importLibrary === "function" || typeof maps.Map === "function"
}

/** Promise condivisa: una sola iniezione di script anche con mount concorrenti o route diverse. */
let loadPromise = null
/** Ultimo errore auth/billing/referrer (gm_authFailure). */
let lastAuthError = null
const authListeners = new Set()

export function getGoogleMapsAuthError() {
  return lastAuthError
}

/** Consente un nuovo tentativo dopo auth/referrer fallito (es. pulsante Riprova). */
export function clearGoogleMapsAuthError() {
  lastAuthError = null
  loadPromise = null
}

/** @param {(msg: string) => void} listener @returns {() => void} */
export function onGoogleMapsAuthFailure(listener) {
  authListeners.add(listener)
  if (lastAuthError) {
    try {
      listener(lastAuthError)
    } catch {
      /* ignore */
    }
  }
  return () => authListeners.delete(listener)
}

function notifyAuthFailure(message) {
  lastAuthError = message
  loadPromise = null
  for (const fn of authListeners) {
    try {
      fn(message)
    } catch {
      /* ignore */
    }
  }
}

export function loadGoogleMapsScript(apiKey, extraLibraries = null) {
  if (!apiKey) {
    return Promise.reject(new Error("Manca la chiave Google Maps"))
  }
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Maps solo in browser"))
  }

  if (lastAuthError) {
    return Promise.reject(new Error(lastAuthError))
  }

  const libraries = normalizeLibraries(extraLibraries)

  if (mapsBootstrapReady()) {
    return Promise.resolve()
  }

  if (loadPromise) {
    return loadPromise
  }

  loadPromise = new Promise((resolve, reject) => {
    const finishOk = () => {
      if (lastAuthError) {
        reject(new Error(lastAuthError))
        return true
      }
      if (mapsBootstrapReady()) {
        resolve()
        return true
      }
      return false
    }

    window.gm_authFailure = () => {
      const msg =
        "Autenticazione Google Maps fallita (chiave, fatturazione attiva o restrizioni HTTP referrer: aggiungi localhost:5173 e il dominio del sito)."
      notifyAuthFailure(msg)
      reject(new Error(msg))
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
      if (lastAuthError) {
        reject(new Error(lastAuthError))
        return
      }
      // Con loading=async il callback arriva prima di Map; basta importLibrary.
      if (!mapsBootstrapReady()) {
        // Piccolo ritardo: a volte il bootstrap arriva un tick dopo il callback.
        window.setTimeout(() => {
          if (lastAuthError) {
            reject(new Error(lastAuthError))
            return
          }
          if (mapsBootstrapReady()) {
            resolve()
            return
          }
          loadPromise = null
          reject(new Error("Google Maps caricato ma API non disponibile"))
        }, 100)
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
    const libQs = libraries ? `&libraries=${encodeURIComponent(libraries)}` : ""
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&v=weekly&loading=async${libQs}&callback=${encodeURIComponent(CB_NAME)}`
    document.head.appendChild(script)
  }).catch((err) => {
    loadPromise = null
    throw err
  })

  return loadPromise
}

/** True se il contenitore mappa mostra l’overlay errore nativo Google. */
export function mapContainerHasGoogleError(el) {
  if (!el) return false
  try {
    return Boolean(
      el.querySelector(
        ".gm-err-container, .gm-error-message, [class*='gm-err'], img[src*='maperror'], img[alt*='Oops']",
      ) || /Spiacenti|Sorry.*problem|non è stata caricata/i.test(el.textContent || ""),
    )
  } catch {
    return false
  }
}
