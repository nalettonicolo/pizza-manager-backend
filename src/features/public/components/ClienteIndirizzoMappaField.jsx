import { useEffect, useMemo, useRef } from "react"
import { loadGoogleMapsScript } from "@/lib/googleMapsLoader"
import { formatIndirizzoFromGoogleAddressComponents } from "@/utils/formatIndirizzoItaliano"
import { getDeliveryPolygonOuterRing } from "@/utils/deliveryArea"

const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY

/**
 * Campo indirizzo con autocomplete Google + mappa punto consegna (registrazione / profilo cliente).
 */
export default function ClienteIndirizzoMappaField({
  tenant,
  indirizzo,
  onIndirizzoChange,
  coords,
  onCoordsChange,
  inputId = "cliente-indirizzo",
  disabled = false,
}) {
  const indirizzoInputRef = useRef(null)
  const autocompleteRef = useRef(null)
  const mapRef = useRef(null)
  const polygonRef = useRef(null)
  const markerRef = useRef(null)
  const mapContainerRef = useRef(null)
  const mapClickListenerRef = useRef(null)

  const deliveryRing = useMemo(
    () => getDeliveryPolygonOuterRing(tenant?.parametri_operativi),
    [tenant?.parametri_operativi],
  )

  function syncCoordsFromLatLng(lat, lng) {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return
    onCoordsChange?.({ lat, lng })
  }

  function ensureDeliveryMarker(g) {
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
  }

  useEffect(() => {
    if (!GOOGLE_API_KEY || disabled || !tenant?.id || !indirizzoInputRef.current) return
    let cancelled = false
    async function initAutocomplete() {
      try {
        await loadGoogleMapsScript(GOOGLE_API_KEY, "places")
        if (cancelled || !indirizzoInputRef.current) return
        const g = window.google
        const placesLib = await g.maps.importLibrary("places")
        if (cancelled || !indirizzoInputRef.current) return
        const Autocomplete = placesLib.Autocomplete ?? g.maps.places?.Autocomplete
        if (!Autocomplete) return
        if (autocompleteRef.current) {
          g.maps.event.clearInstanceListeners(autocompleteRef.current)
          autocompleteRef.current = null
        }
        const inputEl = indirizzoInputRef.current
        const ac = new Autocomplete(inputEl, {
          componentRestrictions: { country: "it" },
          fields: ["address_components", "formatted_address", "geometry"],
          types: ["address"],
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
      } catch {
        /* ignore */
      }
    }
    void initAutocomplete()
    return () => {
      cancelled = true
      if (autocompleteRef.current && window.google?.maps?.event) {
        window.google.maps.event.clearInstanceListeners(autocompleteRef.current)
        autocompleteRef.current = null
      }
    }
  }, [disabled, tenant?.id, onIndirizzoChange])

  useEffect(() => {
    if (!GOOGLE_API_KEY || disabled || !tenant?.id || !mapContainerRef.current) return
    let cancelled = false
    async function initMap() {
      try {
        await loadGoogleMapsScript(GOOGLE_API_KEY, "places")
        if (cancelled || !mapContainerRef.current) return
        const g = window.google
        const center = coords?.lat && coords?.lng ? coords : { lat: 45.4642, lng: 9.19 }
        const mapOptions = {
          center,
          zoom: coords ? 16 : 11,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          scrollwheel: true,
          gestureHandling: "greedy",
        }
        if (!mapRef.current) {
          mapRef.current = new g.maps.Map(mapContainerRef.current, mapOptions)
          if (mapClickListenerRef.current) g.maps.event.removeListener(mapClickListenerRef.current)
          mapClickListenerRef.current = mapRef.current.addListener("click", (ev) => {
            if (disabled) return
            const ll = ev.latLng
            if (!ll) return
            syncCoordsFromLatLng(ll.lat(), ll.lng())
          })
        } else {
          mapRef.current.setOptions(mapOptions)
        }
        ensureDeliveryMarker(g)
        if (polygonRef.current) {
          polygonRef.current.setMap(null)
          polygonRef.current = null
        }
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
      } catch {
        /* ignore */
      }
    }
    void initMap()
    return () => {
      cancelled = true
      if (mapClickListenerRef.current && window.google?.maps?.event) {
        window.google.maps.event.removeListener(mapClickListenerRef.current)
        mapClickListenerRef.current = null
      }
    }
  }, [coords, deliveryRing, disabled, tenant?.id, onCoordsChange])

  useEffect(() => {
    if (!coords || !mapRef.current || !window.google?.maps) return
    const g = window.google
    ensureDeliveryMarker(g)
    markerRef.current.setPosition(coords)
    markerRef.current.setVisible(true)
    mapRef.current.panTo(coords)
  }, [coords, disabled])

  return (
    <>
      <label className="login-label" htmlFor={inputId}>
        Indirizzo consegna
      </label>
      <input
        ref={indirizzoInputRef}
        id={inputId}
        className="login-input"
        value={indirizzo}
        onChange={(e) => onIndirizzoChange?.(e.target.value)}
        autoComplete="street-address"
        disabled={disabled}
      />
      {GOOGLE_API_KEY ? (
        <div style={{ marginTop: 12 }}>
          <div
            ref={mapContainerRef}
            style={{
              width: "100%",
              height: 220,
              borderRadius: 12,
              border: "1px solid #d0d8e6",
              overflow: "hidden",
            }}
            aria-label="Mappa punto di consegna"
          />
          {coords ? (
            <p className="login-brand-sub" style={{ fontSize: 12, marginTop: 6, color: "#0f766e" }}>
              Punto consegna impostato. Trascina il puntatore o clicca sulla mappa per correggerlo.
            </p>
          ) : (
            <p className="login-brand-sub" style={{ fontSize: 12, marginTop: 6 }}>
              Cerca l&apos;indirizzo o clicca sulla mappa per indicare il punto di consegna.
            </p>
          )}
        </div>
      ) : null}
    </>
  )
}
