import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import L from "leaflet"
import "leaflet/dist/leaflet.css"
import { getDeliveryPolygonOuterRing } from "@/utils/deliveryArea"
import { geocodeAddressForDelivery } from "@/utils/geocodeAddress"
import { getBrowserLocationAddress } from "@/utils/geolocateBrowser"

const DEFAULT_CENTER = { lat: 45.4064, lng: 11.8768 } // Padova: centro di fallback senza indirizzo

const PIN_ICON = L.divIcon({
  className: "cliente-indirizzo-pin",
  html:
    '<svg width="30" height="42" viewBox="0 0 30 42" xmlns="http://www.w3.org/2000/svg">' +
    '<path d="M15 0C6.7 0 0 6.7 0 15c0 10.5 15 27 15 27s15-16.5 15-27C30 6.7 23.3 0 15 0z" fill="#c0392b"/>' +
    '<circle cx="15" cy="15" r="6" fill="#fff"/>' +
    "</svg>",
  iconSize: [30, 42],
  iconAnchor: [15, 42],
})

function debounce(fn, ms) {
  let t = null
  const debounced = (...args) => {
    if (t) clearTimeout(t)
    t = setTimeout(() => fn(...args), ms)
  }
  debounced.cancel = () => {
    if (t) clearTimeout(t)
  }
  return debounced
}

/** Civico digitato in coda alla query (es. "Via Pontedera 4" → "4"; esclude il CAP, sempre 5 cifre). */
function extractTypedCivico(q) {
  // Cerca solo nel primo pezzo prima della virgola: se dopo il civico è già digitata la città
  // (es. "Via Rossi 12, Padova"), il numero non è più l'ultimo token dell'intera stringa.
  const primoPezzo = String(q || "").trim().split(",")[0] || ""
  const m = primoPezzo.match(/(\d{1,4}[a-zA-Z]?)\s*$/)
  return m ? m[1] : null
}

/**
 * Nominatim spesso non ha il civico esatto indicizzato e restituisce solo la via: in quel caso
 * il suggerimento non mostra il numero che il cliente ha appena digitato, e sembra "sparito".
 * Se il risultato non ha un house_number reale, lo ricomponiamo inserendo il civico digitato
 * subito dopo il nome via (il civico non geocodifica comunque una via non censita a quel livello:
 * la posizione resta quella della via, corretta per l'uso — selezione della via giusta).
 */
function labelWithCivico(row, typedCivico) {
  const hasHouseNumber = Boolean(row?.address?.house_number)
  if (hasHouseNumber || !typedCivico) return row.display_name
  const parts = String(row.display_name || "").split(", ")
  if (!parts.length) return row.display_name
  parts[0] = `${parts[0]} ${typedCivico}`
  return parts.join(", ")
}

async function searchNominatim(q) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&countrycodes=it&limit=5&q=${encodeURIComponent(q)}`
  const res = await fetch(url, { headers: { Accept: "application/json" } })
  if (!res.ok) return []
  const data = await res.json()
  const typedCivico = extractTypedCivico(q)
  return Array.isArray(data)
    ? data.map((row) => ({
        label: labelWithCivico(row, typedCivico),
        lat: parseFloat(row.lat),
        lng: parseFloat(row.lon),
      }))
    : []
}

/**
 * Campo indirizzo con autocomplete + mappa punto consegna (registrazione / profilo cliente).
 * Leaflet + OpenStreetMap (nessuna chiave API, nessuna fatturazione da configurare): sostituisce
 * la precedente integrazione Google Maps JS, che richiedeva abilitare Maps JavaScript API + Places
 * API con fatturazione attiva su Google Cloud — un blocco per i tenant che non hanno ancora quella
 * configurazione pronta. Geocoding via Nominatim (stesso servizio già usato come primario in
 * geocodeAddress.js altrove nell'app).
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
  const mapContainerRef = useRef(null)
  const mapRef = useRef(null)
  const markerRef = useRef(null)
  const polygonRef = useRef(null)
  const [mapReady, setMapReady] = useState(false)
  const [suggestions, setSuggestions] = useState([])
  const [suggestOpen, setSuggestOpen] = useState(false)
  const [searching, setSearching] = useState(false)
  const [geoLoading, setGeoLoading] = useState(false)
  const [geoError, setGeoError] = useState(null)
  const [geoWarning, setGeoWarning] = useState(null)

  const deliveryRing = useMemo(
    () => getDeliveryPolygonOuterRing(tenant?.parametri_operativi),
    [tenant?.parametri_operativi],
  )
  const deliveryRingKey = useMemo(
    () => (Array.isArray(deliveryRing) ? JSON.stringify(deliveryRing) : ""),
    [deliveryRing],
  )

  const syncCoordsFromLatLng = useCallback(
    (lat, lng) => {
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return
      onCoordsChange?.({ lat, lng })
    },
    [onCoordsChange],
  )

  // Init mappa una sola volta per mount del campo.
  useEffect(() => {
    if (disabled || !mapContainerRef.current || mapRef.current) return undefined
    const center = coords?.lat != null && coords?.lng != null ? coords : DEFAULT_CENTER
    const map = L.map(mapContainerRef.current, {
      center: [center.lat, center.lng],
      zoom: coords ? 16 : 12,
      scrollWheelZoom: true,
    })
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map)

    map.on("click", (ev) => {
      if (disabled) return
      syncCoordsFromLatLng(ev.latlng.lat, ev.latlng.lng)
    })

    mapRef.current = map
    setMapReady(true)

    return () => {
      map.remove()
      mapRef.current = null
      markerRef.current = null
      polygonRef.current = null
      setMapReady(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- init una tantum, coords solo al create
  }, [disabled])

  // Poligono area di consegna: ridisegna se cambia la config tenant.
  useEffect(() => {
    if (!mapReady || !mapRef.current) return
    if (polygonRef.current) {
      polygonRef.current.remove()
      polygonRef.current = null
    }
    if (!Array.isArray(deliveryRing) || deliveryRing.length <= 2) return
    // deliveryRing è [lng, lat] (ordine GeoJSON): Leaflet vuole [lat, lng].
    const latlngs = deliveryRing
      .map((p) => [Number(p?.[1]), Number(p?.[0])])
      .filter(([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng))
    if (latlngs.length <= 2) return
    const polygon = L.polygon(latlngs, {
      color: "#0f766e",
      weight: 2,
      fillColor: "#2dd4bf",
      fillOpacity: 0.18,
    }).addTo(mapRef.current)
    polygonRef.current = polygon
    if (!coords) mapRef.current.fitBounds(polygon.getBounds(), { padding: [16, 16] })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deliveryRingKey è la dipendenza stabile
  }, [mapReady, deliveryRingKey])

  // Marker: crea/sposta in base a coords.
  useEffect(() => {
    if (!mapReady || !mapRef.current) return
    if (!coords || coords.lat == null || coords.lng == null) {
      if (markerRef.current) {
        markerRef.current.remove()
        markerRef.current = null
      }
      return
    }
    const pos = [coords.lat, coords.lng]
    if (!markerRef.current) {
      const marker = L.marker(pos, { draggable: !disabled, icon: PIN_ICON }).addTo(mapRef.current)
      marker.on("dragend", () => {
        const p = marker.getLatLng()
        syncCoordsFromLatLng(p.lat, p.lng)
      })
      markerRef.current = marker
    } else {
      markerRef.current.setLatLng(pos)
      markerRef.current.dragging?.enable()
      if (disabled) markerRef.current.dragging?.disable()
    }
    mapRef.current.panTo(pos)
    if (mapRef.current.getZoom() < 16) mapRef.current.setZoom(16)
  }, [mapReady, coords, disabled, syncCoordsFromLatLng])

  // Se c'è indirizzo testuale ma mancano le coordinate, geocodifica (pin + area) — stessa utility
  // già usata altrove nell'app (Nominatim primario, Google JS solo come fallback se configurato).
  useEffect(() => {
    if (!mapReady || disabled) return
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
        if (Number.isFinite(lat) && Number.isFinite(lng)) syncCoordsFromLatLng(lat, lng)
      } catch {
        /* ignore — l'utente può cliccare/trascinare sulla mappa */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [indirizzo, coords, mapReady, disabled, syncCoordsFromLatLng])

  const runSearch = useMemo(
    () =>
      debounce(async (q) => {
        if (q.trim().length < 5) {
          setSuggestions([])
          setSearching(false)
          return
        }
        try {
          const rows = await searchNominatim(q.trim())
          setSuggestions(rows)
        } catch {
          setSuggestions([])
        } finally {
          setSearching(false)
        }
      }, 450),
    [],
  )

  useEffect(() => () => runSearch.cancel(), [runSearch])

  function handleInputChange(e) {
    const v = e.target.value
    onIndirizzoChange?.(v)
    setSuggestOpen(true)
    setSearching(true)
    runSearch(v)
  }

  function pickSuggestion(s) {
    onIndirizzoChange?.(s.label)
    syncCoordsFromLatLng(s.lat, s.lng)
    setSuggestions([])
    setSuggestOpen(false)
  }

  async function handleUseMyLocation() {
    setGeoError(null)
    setGeoWarning(null)
    setGeoLoading(true)
    try {
      const { lat, lng, address, accuracy } = await getBrowserLocationAddress()
      if (address) onIndirizzoChange?.(address)
      syncCoordsFromLatLng(lat, lng)
      setSuggestions([])
      setSuggestOpen(false)
      // Su desktop il GPS del browser è spesso solo triangolazione WiFi/IP: con un errore ampio
      // il pin può cadere lontano da dove ci si trova davvero. Avvisiamo invece di lasciare che
      // sembri un salto "a caso" senza spiegazione — l'utente sa così di dover correggere il
      // punto trascinandolo sulla mappa.
      if (Number.isFinite(accuracy) && accuracy > 300) {
        const metri = Math.round(accuracy)
        setGeoWarning(
          `Posizione rilevata con precisione bassa (~${metri} m). Controlla il punto sulla mappa e trascinalo sull'indirizzo esatto se necessario.`,
        )
      }
    } catch (err) {
      setGeoError(err?.message || "Impossibile ottenere la posizione.")
    } finally {
      setGeoLoading(false)
    }
  }

  return (
    <div className="cliente-indirizzo-mappa">
      <label className="login-label" htmlFor={inputId}>
        {label}
      </label>
      <div style={{ position: "relative" }}>
        <div style={{ display: "flex", gap: 8, alignItems: "stretch" }}>
          <input
            ref={indirizzoInputRef}
            id={inputId}
            className="login-input"
            value={indirizzo}
            onChange={handleInputChange}
            onFocus={() => suggestions.length > 0 && setSuggestOpen(true)}
            onBlur={() => window.setTimeout(() => setSuggestOpen(false), 150)}
            autoComplete="street-address"
            disabled={disabled}
            placeholder="Via, civico, città"
            style={{ flex: 1, minWidth: 0 }}
          />
          {!disabled ? (
            <button
              type="button"
              onClick={handleUseMyLocation}
              disabled={geoLoading}
              title="Usa la mia posizione (geolocalizzazione)"
              aria-label="Usa la mia posizione"
              style={{
                flexShrink: 0,
                width: 44,
                border: "1px solid #d0d8e6",
                borderRadius: 8,
                background: "#f8fafc",
                cursor: geoLoading ? "default" : "pointer",
                fontSize: 17,
                lineHeight: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                opacity: geoLoading ? 0.5 : 1,
              }}
            >
              {geoLoading ? "…" : "📍"}
            </button>
          ) : null}
        </div>
        {suggestOpen && (searching || suggestions.length > 0) ? (
          <ul
            style={{
              position: "absolute",
              zIndex: 20,
              top: "100%",
              left: 0,
              right: 0,
              marginTop: 2,
              padding: 0,
              listStyle: "none",
              background: "#fff",
              border: "1px solid #d0d8e6",
              borderRadius: 10,
              boxShadow: "0 8px 20px rgba(15,23,42,0.12)",
              maxHeight: 220,
              overflowY: "auto",
            }}
          >
            {searching ? (
              <li style={{ padding: "8px 12px", fontSize: 13, color: "#94a3b8" }}>Ricerca…</li>
            ) : (
              suggestions.map((s, i) => (
                <li key={i}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => pickSuggestion(s)}
                    style={{
                      display: "block",
                      width: "100%",
                      textAlign: "left",
                      padding: "8px 12px",
                      fontSize: 13,
                      color: "#334155",
                      background: "none",
                      border: "none",
                      borderBottom: i < suggestions.length - 1 ? "1px solid #f1f5f9" : "none",
                      cursor: "pointer",
                    }}
                  >
                    {s.label}
                  </button>
                </li>
              ))
            )}
          </ul>
        ) : null}
      </div>
      <p className="login-brand-sub" style={{ fontSize: 12, marginTop: 6, lineHeight: 1.45 }}>
        Inserisci l&apos;indirizzo completo e scegli un suggerimento, oppure usa 📍 per rilevare la tua posizione.
        Sulla mappa puoi trascinare il puntatore o cliccare il punto di consegna.
      </p>
      {geoError ? (
        <p className="login-brand-sub" style={{ fontSize: 12, marginTop: 2, color: "#b91c1c" }}>
          {geoError}
        </p>
      ) : null}
      {!geoError && geoWarning ? (
        <p className="login-brand-sub" style={{ fontSize: 12, marginTop: 2, color: "#b45309" }}>
          {geoWarning}
        </p>
      ) : null}

      {!disabled ? (
        <div
          ref={mapContainerRef}
          style={{
            marginTop: 12,
            width: "100%",
            height: "min(320px, 42vw)",
            minHeight: 220,
            borderRadius: 12,
            border: "1px solid #d0d8e6",
            overflow: "hidden",
            background: "#f1f5f9",
          }}
          aria-label="Mappa punto di consegna"
        />
      ) : null}

      {!disabled && coords ? (
        <p className="login-brand-sub" style={{ fontSize: 12, marginTop: 6, color: "#0f766e" }}>
          Punto consegna impostato. Trascina il puntatore o clicca sulla mappa per correggerlo.
        </p>
      ) : null}
    </div>
  )
}
