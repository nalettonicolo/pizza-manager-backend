import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  loadGoogleMapsScript,
  onGoogleMapsAuthFailure,
  mapContainerHasGoogleError,
  clearGoogleMapsAuthError,
} from "@/lib/googleMapsLoader"
import { formatIndirizzoFromGoogleAddressComponents } from "@/utils/formatIndirizzoItaliano"
import { getDeliveryPolygonOuterRing } from "@/utils/deliveryArea"
import { geocodeAddressForDelivery } from "@/utils/geocodeAddress"

const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY

const MAPS_HELP =
  "Su Google Cloud: abilita Maps JavaScript API e Places API, fatturazione attiva, e nelle restrizioni della chiave aggiungi http://localhost:5173/* e https://tuodominio/* (anche sottodomini)."

function buildEmbedUrl(indirizzo, coords) {
  if (coords?.lat != null && coords?.lng != null && Number.isFinite(coords.lat) && Number.isFinite(coords.lng)) {
    return `https://www.google.com/maps?q=${encodeURIComponent(`${coords.lat},${coords.lng}`)}&output=embed&z=16`
  }
  const q = String(indirizzo || "").trim() || "Padova, Italia"
  return `https://www.google.com/maps?q=${encodeURIComponent(q)}&output=embed&z=14`
}

async function waitForMapContainer(ref, isStale, maxMs = 2500) {
  const t0 = Date.now()
  while (!ref.current && Date.now() - t0 < maxMs) {
    if (isStale()) return null
    await new Promise((r) => requestAnimationFrame(r))
  }
  return ref.current
}

/**
 * Campo indirizzo con autocomplete Google + mappa punto consegna (registrazione / profilo cliente).
 * Se la JS API fallisce (referrer/billing), resta editabile l’indirizzo e si mostra una mappa embed.
 */
export default function ClienteIndirizzoMappaField({
  tenant,
  indirizzo,
  onIndirizzoChange,
  coords,
  onCoordsChange,
  inputId = "cliente-indirizzo",
  disabled = false,
  label = "Indirizzo consegna",
}) {
  const indirizzoInputRef = useRef(null)
  const autocompleteRef = useRef(null)
  const mapRef = useRef(null)
  const polygonRef = useRef(null)
  const markerRef = useRef(null)
  const mapContainerRef = useRef(null)
  const mapClickListenerRef = useRef(null)
  const initGenRef = useRef(0)
  const [mapsError, setMapsError] = useState(null)
  const [mapsReady, setMapsReady] = useState(false)
  const [useEmbedFallback, setUseEmbedFallback] = useState(false)
  const [retryToken, setRetryToken] = useState(0)

  const deliveryRing = useMemo(
    () => getDeliveryPolygonOuterRing(tenant?.parametri_operativi),
    [tenant?.parametri_operativi],
  )
  /** Dipendenza stabile: evita re-init mappa ad ogni render del tenant. */
  const deliveryRingKey = useMemo(
    () => (Array.isArray(deliveryRing) ? JSON.stringify(deliveryRing) : ""),
    [deliveryRing],
  )

  const embedUrl = useMemo(() => buildEmbedUrl(indirizzo, coords), [indirizzo, coords])
  const hasApiKey = Boolean(String(GOOGLE_API_KEY || "").trim())

  const syncCoordsFromLatLng = useCallback(
    (lat, lng) => {
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return
      onCoordsChange?.({ lat, lng })
    },
    [onCoordsChange],
  )

  const failMaps = useCallback((message) => {
    setMapsReady(false)
    setMapsError(message)
    setUseEmbedFallback(true)
    try {
      if (mapClickListenerRef.current && window.google?.maps?.event) {
        window.google.maps.event.removeListener(mapClickListenerRef.current)
      }
    } catch {
      /* ignore */
    }
    mapClickListenerRef.current = null
    try {
      if (polygonRef.current) polygonRef.current.setMap(null)
    } catch {
      /* ignore */
    }
    polygonRef.current = null
    try {
      if (markerRef.current) markerRef.current.setMap(null)
    } catch {
      /* ignore */
    }
    markerRef.current = null
    mapRef.current = null
  }, [])

  const ensureDeliveryMarker = useCallback(
    (g) => {
      if (!mapRef.current) return
      if (!markerRef.current) {
        markerRef.current = new g.maps.Marker({
          map: mapRef.current,
          draggable: !disabled,
          title: "Trascina per indicare il punto di consegna",
        })
        markerRef.current.addListener("dragend", () => {
          const pos = markerRef.current?.getPosition()
          if (!pos) return
          syncCoordsFromLatLng(pos.lat(), pos.lng())
        })
      }
      markerRef.current.setDraggable(!disabled)
    },
    [disabled, syncCoordsFromLatLng],
  )

  function detachAutocomplete() {
    try {
      if (autocompleteRef.current && window.google?.maps?.event) {
        window.google.maps.event.clearInstanceListeners(autocompleteRef.current)
      }
    } catch {
      /* ignore */
    }
    autocompleteRef.current = null
    try {
      document.querySelectorAll(".pac-container").forEach((n) => n.remove())
      const input = indirizzoInputRef.current
      if (input) {
        input.classList.remove("pac-target-input")
        input.removeAttribute("autocomplete")
        input.setAttribute("autocomplete", "street-address")
      }
    } catch {
      /* ignore */
    }
  }

  function handleRetry() {
    clearGoogleMapsAuthError()
    setMapsError(null)
    setUseEmbedFallback(false)
    setMapsReady(false)
    setRetryToken((n) => n + 1)
  }

  useEffect(() => {
    const off = onGoogleMapsAuthFailure((msg) => {
      failMaps(msg)
    })
    return off
  }, [failMaps])

  useEffect(() => {
    if (!hasApiKey) {
      setMapsError("Mappa interattiva non configurata (manca la chiave). Puoi comunque scrivere l’indirizzo.")
      setUseEmbedFallback(true)
      return undefined
    }
    if (disabled || !tenant?.id) return undefined

    const gen = ++initGenRef.current
    const isStale = () => gen !== initGenRef.current
    let cancelled = false
    setMapsError(null)
    setUseEmbedFallback(false)

    async function init() {
      try {
        await loadGoogleMapsScript(GOOGLE_API_KEY, "places")
        if (cancelled || isStale()) return

        const g = window.google
        if (!g?.maps) throw new Error("API Maps non disponibile")

        // Places autocomplete (legacy) sull’input controllato React
        if (indirizzoInputRef.current) {
          detachAutocomplete()
          if (cancelled || isStale() || !indirizzoInputRef.current) return
          try {
            const placesLib = await g.maps.importLibrary("places")
            if (cancelled || isStale() || !indirizzoInputRef.current) return
            const Autocomplete = placesLib.Autocomplete ?? g.maps.places?.Autocomplete
            if (Autocomplete) {
              const inputEl = indirizzoInputRef.current
              const ac = new Autocomplete(inputEl, {
                componentRestrictions: { country: "it" },
                fields: ["address_components", "formatted_address", "geometry"],
                // "geocode" è più tollerante di "address" su alcune chiavi Places
                types: ["geocode"],
              })
              autocompleteRef.current = ac
              ac.addListener("place_changed", () => {
                const place = ac.getPlace()
                if (!place) return
                const components = place.address_components || place.addressComponents || []
                const fromComponents = formatIndirizzoFromGoogleAddressComponents(components)
                const formatted = fromComponents || place.formatted_address || place.formattedAddress || ""
                if (formatted) {
                  inputEl.value = formatted
                  onIndirizzoChange?.(formatted)
                }
                const loc = place.geometry?.location
                if (loc) {
                  const lat = typeof loc.lat === "function" ? loc.lat() : loc.lat
                  const lng = typeof loc.lng === "function" ? loc.lng() : loc.lng
                  if (Number.isFinite(lat) && Number.isFinite(lng)) syncCoordsFromLatLng(lat, lng)
                }
              })
            }
          } catch (placesErr) {
            console.warn("[ClienteIndirizzoMappaField] Places non disponibile:", placesErr?.message || placesErr)
          }
        }

        // Attendi che il div mappa sia nel DOM (prima era nascosto se mapsError → ref sempre null)
        const container = await waitForMapContainer(mapContainerRef, () => cancelled || isStale())
        if (cancelled || isStale()) return
        if (!container) {
          failMaps(`Contenitore mappa non disponibile. ${MAPS_HELP}`)
          return
        }

        const { Map } = await g.maps.importLibrary("maps")
        if (cancelled || isStale() || !mapContainerRef.current) return

        const center = coords?.lat && coords?.lng ? coords : { lat: 45.4064, lng: 11.8768 }
        mapContainerRef.current.innerHTML = ""
        mapRef.current = new Map(mapContainerRef.current, {
          center,
          zoom: coords ? 16 : 12,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          scrollwheel: true,
          gestureHandling: "greedy",
        })
        mapClickListenerRef.current = mapRef.current.addListener("click", (ev) => {
          if (disabled) return
          const ll = ev.latLng
          if (!ll) return
          syncCoordsFromLatLng(ll.lat(), ll.lng())
        })

        ensureDeliveryMarker(g)
        if (Array.isArray(deliveryRing) && deliveryRing.length > 2) {
          const path = deliveryRing
            .map((p) => ({ lng: Number(p?.[0]), lat: Number(p?.[1]) }))
            .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng))
          if (path.length > 2) {
            polygonRef.current = new g.maps.Polygon({
              paths: path,
              strokeColor: "#0f766e",
              strokeOpacity: 0.9,
              strokeWeight: 2,
              fillColor: "#2dd4bf",
              fillOpacity: 0.18,
              map: mapRef.current,
            })
            const bounds = new g.maps.LatLngBounds()
            path.forEach((p) => bounds.extend(p))
            mapRef.current.fitBounds(bounds)
          }
        }

        const watchErr = () => {
          if (cancelled || isStale()) return true
          if (mapContainerHasGoogleError(mapContainerRef.current)) {
            failMaps(`La mappa interattiva non si è avviata correttamente. ${MAPS_HELP}`)
            return true
          }
          return false
        }
        window.setTimeout(() => {
          if (watchErr()) return
          if (!cancelled && !isStale()) {
            setMapsReady(true)
            setMapsError(null)
            setUseEmbedFallback(false)
          }
        }, 900)
        window.setTimeout(watchErr, 2200)
      } catch (e) {
        if (!cancelled && !isStale()) {
          const msg = String(e?.message || "")
          failMaps(
            msg.includes("chiave") || msg.includes("Manca") || msg.includes("Autenticazione")
              ? `${msg} ${MAPS_HELP}`
              : `Impossibile caricare Google Maps. ${MAPS_HELP}`,
          )
        }
      }
    }

    void init()
    return () => {
      cancelled = true
      detachAutocomplete()
      if (mapClickListenerRef.current && window.google?.maps?.event) {
        window.google.maps.event.removeListener(mapClickListenerRef.current)
        mapClickListenerRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- coords solo al create; marker sync in effect dedicato
  }, [disabled, tenant?.id, deliveryRingKey, hasApiKey, retryToken, failMaps, ensureDeliveryMarker, syncCoordsFromLatLng])

  useEffect(() => {
    if (!coords || !mapRef.current || !window.google?.maps || !mapsReady || useEmbedFallback) return
    const g = window.google
    ensureDeliveryMarker(g)
    markerRef.current.setPosition(coords)
    markerRef.current.setVisible(true)
    mapRef.current.panTo(coords)
    mapRef.current.setZoom(Math.max(mapRef.current.getZoom() || 12, 16))
  }, [coords, disabled, mapsReady, useEmbedFallback, ensureDeliveryMarker])

  // Se c’è indirizzo testuale ma mancano le coordinate, geocodifica (pin + area).
  useEffect(() => {
    if (!mapsReady || useEmbedFallback || disabled) return
    if (coords?.lat != null && coords?.lng != null) return
    const q = String(indirizzo || "").trim()
    if (q.length < 8) return
    let cancelled = false
    void (async () => {
      try {
        const res = await geocodeAddressForDelivery(q)
        if (cancelled || !res) return
        const lat = Number(res.lat ?? res.latitude)
        const lng = Number(res.lng ?? res.longitude)
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          syncCoordsFromLatLng(lat, lng)
        }
      } catch {
        /* ignore — l’utente può cliccare/trascinare sulla mappa */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [indirizzo, coords, mapsReady, useEmbedFallback, disabled, syncCoordsFromLatLng])

  // Il contenitore interattivo resta montato (anche in errore) così il retry trova il ref.
  const showInteractivePane = hasApiKey && !useEmbedFallback

  return (
    <div className="cliente-indirizzo-mappa">
      <label className="login-label" htmlFor={inputId}>
        {label}
      </label>
      <input
        ref={indirizzoInputRef}
        id={inputId}
        className="login-input"
        value={indirizzo}
        onChange={(e) => onIndirizzoChange?.(e.target.value)}
        autoComplete="street-address"
        disabled={disabled}
        placeholder="Via, civico, città"
      />
      <p className="login-brand-sub" style={{ fontSize: 12, marginTop: 6, lineHeight: 1.45 }}>
        Inserisci l&apos;indirizzo completo e, se disponibile, scegli un suggerimento. Sulla mappa puoi trascinare il
        puntatore o cliccare il punto di consegna.
      </p>

      {mapsError ? (
        <div
          role="status"
          style={{
            marginTop: 10,
            padding: "12px 14px",
            borderRadius: 10,
            background: "#fff7ed",
            border: "1px solid #fdba74",
            color: "#9a3412",
            fontSize: 13,
            lineHeight: 1.45,
          }}
        >
          {mapsError}
          <div style={{ marginTop: 6, color: "#78716c", fontSize: 12 }}>
            Puoi salvare l&apos;indirizzo scritto a mano. Sotto trovi comunque una mappa di anteprima.
          </div>
          {hasApiKey ? (
            <button
              type="button"
              onClick={handleRetry}
              style={{
                marginTop: 10,
                padding: "8px 12px",
                borderRadius: 8,
                border: "1px solid #c2410c",
                background: "#fff",
                color: "#9a3412",
                fontWeight: 600,
                cursor: "pointer",
                fontSize: 13,
              }}
            >
              Riprova mappa
            </button>
          ) : null}
        </div>
      ) : null}

      {hasApiKey ? (
        <div
          ref={mapContainerRef}
          style={{
            marginTop: 12,
            width: "100%",
            height: showInteractivePane ? "min(320px, 42vw)" : 0,
            minHeight: showInteractivePane ? 220 : 0,
            borderRadius: 12,
            border: showInteractivePane ? "1px solid #d0d8e6" : "none",
            overflow: "hidden",
            background: "#f1f5f9",
            display: showInteractivePane ? "block" : "none",
          }}
          aria-label="Mappa punto di consegna"
          aria-hidden={!showInteractivePane}
        />
      ) : null}

      {showInteractivePane && coords ? (
        <p className="login-brand-sub" style={{ fontSize: 12, marginTop: 6, color: "#0f766e" }}>
          Punto consegna impostato. Trascina il puntatore o clicca sulla mappa per correggerlo.
        </p>
      ) : null}

      {(!hasApiKey || useEmbedFallback) && (
        <div style={{ marginTop: 12 }}>
          <iframe
            title="Anteprima mappa indirizzo"
            src={embedUrl}
            style={{
              width: "100%",
              height: "min(280px, 40vw)",
              minHeight: 200,
              border: "1px solid #d0d8e6",
              borderRadius: 12,
              background: "#f1f5f9",
            }}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            allowFullScreen
          />
          <p className="login-brand-sub" style={{ fontSize: 12, marginTop: 6, lineHeight: 1.45 }}>
            Anteprima mappa. Per suggerimenti indirizzo e pin trascinabile serve la mappa interattiva Google.
          </p>
        </div>
      )}
    </div>
  )
}
