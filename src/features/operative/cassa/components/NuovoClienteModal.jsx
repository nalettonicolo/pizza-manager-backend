import { useState, useEffect, useRef, useMemo } from "react"
import L from "leaflet"
import "leaflet/dist/leaflet.css"
import Modal from "@/components/dashboard/Modal"
import { createAnagraficaCliente, updateAnagraficaCliente } from "@/features/admin/services/adminService"
import { getDeliveryPolygonOuterRing } from "@/utils/deliveryArea"
import { formatIndirizzoFromNominatim, formatIndirizzoDisplayItaliano } from "@/utils/formatIndirizzoItaliano"
import { getBrowserLocationAddress } from "@/utils/geolocateBrowser"
import { useDebounce } from "@/hooks/useDebounce"

const PIN_ICON = L.divIcon({
  className: "cassa-nuovo-cliente-pin",
  html:
    '<svg width="26" height="36" viewBox="0 0 30 42" xmlns="http://www.w3.org/2000/svg">' +
    '<path d="M15 0C6.7 0 0 6.7 0 15c0 10.5 15 27 15 27s15-16.5 15-27C30 6.7 23.3 0 15 0z" fill="#c0392b"/>' +
    '<circle cx="15" cy="15" r="6" fill="#fff"/>' +
    "</svg>",
  iconSize: [26, 36],
  iconAnchor: [13, 36],
})

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
const inputStyle = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 6,
  border: "1px solid #ddd",
  fontSize: 14,
}

/**
 * @param {string} query
 * @param {{ minLng: number, minLat: number, maxLng: number, maxLat: number } | null} [bbox]
 *   Area di consegna del locale: se presente, i suggerimenti sono limitati a quella zona
 *   (bounded=1 — niente risultati fuori area, anche omonimi in un'altra città/paese).
 */
async function searchAddress(query, bbox) {
  const q = (query || "").trim()
  if (q.length < 3) return []
  const params = new URLSearchParams({
    q,
    format: "json",
    limit: "5",
    addressdetails: "1",
    countrycodes: "it",
  })
  if (bbox) {
    params.set("viewbox", `${bbox.minLng},${bbox.maxLat},${bbox.maxLng},${bbox.minLat}`)
    params.set("bounded", "1")
  }
  const res = await fetch(`${NOMINATIM_URL}?${params}`, {
    headers: { Accept: "application/json" },
  })
  if (!res.ok) return []
  const data = await res.json()
  return Array.isArray(data) ? data : []
}

/** Bbox WGS84 per iframe OSM (minLon, minLat, maxLon, maxLat). */
function bboxFromPolygonRing(ring, padDeg = 0.002) {
  if (!Array.isArray(ring) || ring.length < 3) return null
  let minLng = Infinity
  let minLat = Infinity
  let maxLng = -Infinity
  let maxLat = -Infinity
  for (const pt of ring) {
    const ln = Number(pt?.[0])
    const la = Number(pt?.[1])
    if (!Number.isFinite(ln) || !Number.isFinite(la)) continue
    minLng = Math.min(minLng, ln)
    minLat = Math.min(minLat, la)
    maxLng = Math.max(maxLng, ln)
    maxLat = Math.max(maxLat, la)
  }
  if (!Number.isFinite(minLng)) return null
  return {
    minLng: minLng - padDeg,
    minLat: minLat - padDeg,
    maxLng: maxLng + padDeg,
    maxLat: maxLat + padDeg,
  }
}

function deliveryAreaBbox(parametriOperativi) {
  const ring = getDeliveryPolygonOuterRing(parametriOperativi)
  return bboxFromPolygonRing(ring)
}

/** Toglie il CAP finale (5 cifre): stessa via vicina spesso torna con CAP diversi da Nominatim
 * (zone limitrofe), inutile e confuso da mostrare/salvare per un indirizzo di consegna. */
function senzaCap(label) {
  return String(label || "").replace(/\s+\d{5}\s*$/, "").trim()
}

export default function NuovoClienteModal({
  open,
  onClose,
  tenantId,
  onSuccess,
  initialData = null,
  /** Da `tenantData.parametri_operativi`: mostra subito l’area di consegna sulla mappa (nuovo cliente). */
  parametriOperativi = null,
}) {
  const isEdit = Boolean(initialData?.id)
  const [nome, setNome] = useState(initialData?.nome ?? "")
  const [indirizzo, setIndirizzo] = useState(initialData?.indirizzo ?? "")
  const [telefono, setTelefono] = useState(initialData?.telefono ?? "")
  const [email, setEmail] = useState(initialData?.email ?? "")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [addressSuggestions, setAddressSuggestions] = useState([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [mapCenter, setMapCenter] = useState(null) // { lat, lon } or null
  const [geoLoading, setGeoLoading] = useState(false)
  const [geoError, setGeoError] = useState(null)
  const suggestionsRef = useRef(null)
  const inputAddressRef = useRef(null)
  const mapContainerRef = useRef(null)
  const mapRef = useRef(null)
  const markerRef = useRef(null)
  const polygonRef = useRef(null)
  const [mapReady, setMapReady] = useState(false)

  const debouncedIndirizzo = useDebounce(indirizzo, 400)

  // Mappa reale (Leaflet), non più un iframe statico: serve per mostrare davvero il poligono
  // dell'area di consegna, non solo un riquadro ritagliato senza contorno visibile.
  useEffect(() => {
    if (!open || !mapContainerRef.current || mapRef.current) return undefined
    const map = L.map(mapContainerRef.current, { center: [45.4064, 11.8768], zoom: 12, scrollWheelZoom: true })
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map)
    map.on("click", (ev) => {
      setMapCenter({ lat: ev.latlng.lat, lon: ev.latlng.lng })
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
  }, [open])

  const deliveryRing = useMemo(
    () => getDeliveryPolygonOuterRing(parametriOperativi),
    [parametriOperativi],
  )
  const deliveryRingKey = useMemo(
    () => (Array.isArray(deliveryRing) ? JSON.stringify(deliveryRing) : ""),
    [deliveryRing],
  )

  // Poligono area di consegna: prima qui non si vedeva affatto (l'iframe OSM non può disegnarlo),
  // quindi l'operatore non aveva modo di capire a colpo d'occhio se un indirizzo ricade in area.
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
    if (!mapCenter) mapRef.current.fitBounds(polygon.getBounds(), { padding: [16, 16] })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deliveryRingKey è la dipendenza stabile
  }, [mapReady, deliveryRingKey])

  // Marker: crea/sposta in base a mapCenter (indirizzo cercato, suggerimento scelto, clic sulla
  // mappa o posizione del dispositivo).
  useEffect(() => {
    if (!mapReady || !mapRef.current) return
    if (!mapCenter) {
      if (markerRef.current) {
        markerRef.current.remove()
        markerRef.current = null
      }
      return
    }
    const pos = [mapCenter.lat, mapCenter.lon]
    if (!markerRef.current) {
      const marker = L.marker(pos, { draggable: true, icon: PIN_ICON }).addTo(mapRef.current)
      marker.on("dragend", () => {
        const p = marker.getLatLng()
        setMapCenter({ lat: p.lat, lon: p.lng })
      })
      markerRef.current = marker
    } else {
      markerRef.current.setLatLng(pos)
    }
    mapRef.current.panTo(pos)
    if (mapRef.current.getZoom() < 16) mapRef.current.setZoom(16)
  }, [mapReady, mapCenter])

  useEffect(() => {
    if (!open) return
    setNome(initialData?.nome ?? "")
    setIndirizzo(initialData?.indirizzo ?? "")
    setTelefono(initialData?.telefono ?? "")
    setEmail(initialData?.email ?? "")
    setMapCenter(null)
    setError(null)
    setAddressSuggestions([])
    setShowSuggestions(false)

    const ind = (initialData?.indirizzo && String(initialData.indirizzo).trim()) || ""
    if (initialData?.id && ind.length >= 3) {
      let cancelled = false
      searchAddress(ind, deliveryAreaBbox(parametriOperativi)).then((list) => {
        if (cancelled || !list?.length) return
        const top = list[0]
        const lat = parseFloat(top.lat)
        const lon = parseFloat(top.lon)
        if (Number.isFinite(lat) && Number.isFinite(lon)) {
          setMapCenter({ lat, lon })
        }
      }).catch(() => {})
      return () => {
        cancelled = true
      }
    }
    return undefined
  }, [open, initialData, parametriOperativi])

  useEffect(() => {
    let cancelled = false
    if (!debouncedIndirizzo || debouncedIndirizzo.length < 3) {
      setAddressSuggestions([])
      setShowSuggestions(false)
      setMapCenter(null)
      return
    }
    searchAddress(debouncedIndirizzo, deliveryAreaBbox(parametriOperativi)).then((list) => {
      if (!cancelled) {
        setAddressSuggestions(list)
        setShowSuggestions(list.length > 0)
        if (list.length > 0) {
          const top = list[0]
          const lat = parseFloat(top.lat)
          const lon = parseFloat(top.lon)
          if (Number.isFinite(lat) && Number.isFinite(lon)) {
            setMapCenter({ lat, lon })
          }
        } else {
          setMapCenter(null)
        }
      }
    }).catch(() => {
      if (!cancelled) {
        setAddressSuggestions([])
        setMapCenter(null)
      }
    })
    return () => { cancelled = true }
  }, [debouncedIndirizzo, parametriOperativi])

  useEffect(() => {
    function handleClickOutside(e) {
      if (
        suggestionsRef.current && !suggestionsRef.current.contains(e.target) &&
        inputAddressRef.current && !inputAddressRef.current.contains(e.target)
      ) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const reset = () => {
    if (!isEdit) {
      setNome("")
      setIndirizzo("")
      setTelefono("")
      setEmail("")
    }
    setMapCenter(null)
    setAddressSuggestions([])
    setShowSuggestions(false)
    setError(null)
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  const handleSelectSuggestion = (item) => {
    setIndirizzo(senzaCap(formatIndirizzoFromNominatim(item, indirizzo)))
    setMapCenter({ lat: parseFloat(item.lat), lon: parseFloat(item.lon) })
    setShowSuggestions(false)
    setAddressSuggestions([])
  }

  /** Geolocalizza il dispositivo in uso (stesso pulsante 📍 del profilo cliente): utile quando il
   * cliente detta l'indirizzo mentre l'operatore è fisicamente lì con lui (es. tablet al banco),
   * non pensato per il normale ordine telefonico (geolocalizzerebbe la cassa, non il cliente). */
  const handleUseMyLocation = async () => {
    setGeoError(null)
    setGeoLoading(true)
    try {
      const { lat, lng, address } = await getBrowserLocationAddress()
      if (address) setIndirizzo(senzaCap(address))
      setMapCenter({ lat, lon: lng })
      setShowSuggestions(false)
      setAddressSuggestions([])
    } catch (err) {
      setGeoError(err?.message || "Impossibile ottenere la posizione.")
    } finally {
      setGeoLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const nomeTrim = nome?.trim()
    const telefonoTrim = telefono?.trim()
    if (!tenantId || !nomeTrim) {
      setError("Nome obbligatorio.")
      return
    }
    if (!telefonoTrim) {
      setError("Numero di telefono obbligatorio.")
      return
    }
    setError(null)
    setLoading(true)
    try {
      const indTrim = indirizzo?.trim() || ""
      const payload = {
        nome: nomeTrim,
        indirizzo: indTrim ? formatIndirizzoDisplayItaliano(indTrim) : null,
        telefono: telefonoTrim,
        email: email?.trim() || null,
      }
      if (isEdit) {
        const updated = await updateAnagraficaCliente(tenantId, initialData.id, payload)
        onSuccess?.(updated)
      } else {
        const created = await createAnagraficaCliente(tenantId, payload)
        onSuccess?.(created)
      }
      handleClose()
    } catch (err) {
      console.error(err)
      setError(err?.message ?? "Errore nel salvataggio. Verifica di aver eseguito clienti_anagrafica_e_merge.sql.")
    } finally {
      setLoading(false)
    }
  }

  const deliveryBbox = useMemo(() => deliveryAreaBbox(parametriOperativi), [parametriOperativi])

  /** Stessa via vicina torna spesso più volte da Nominatim con solo il CAP diverso: qui lo
   * togliamo dall'etichetta e uniamo le righe che risultano identiche, altrimenti si vedono
   * 4-5 suggerimenti apparentemente uguali in fila. */
  const dedupedSuggestions = useMemo(() => {
    const seen = new Set()
    const out = []
    for (const item of addressSuggestions) {
      const label = senzaCap(formatIndirizzoFromNominatim(item, indirizzo))
      if (!label || seen.has(label)) continue
      seen.add(label)
      out.push({ item, label })
    }
    return out
  }, [addressSuggestions, indirizzo])

  const mapCaption = useMemo(() => {
    if (mapCenter) return "Posizione dall’indirizzo (cerca, scegli un suggerimento o trascina il puntatore)."
    if (deliveryBbox) return "Area di consegna del locale in verde. Inserisci l’indirizzo per il punto cliente, o clicca sulla mappa."
    return null
  }, [mapCenter, deliveryBbox])

  return (
    <Modal open={open} onClose={handleClose} title={isEdit ? "Profilo cliente" : "Nuovo cliente"}>
      <form onSubmit={handleSubmit} style={{ padding: 16 }}>
        <p style={{ color: "#555", marginBottom: 16, fontSize: 13 }}>
          {isEdit
            ? "Modifica i dati del cliente. Le note ordine sono visibili solo al negozio."
            : "Inserisci i dati per la consegna. Se il cliente si registra poi da solo con lo stesso nome, indirizzo e telefono, l'account verrà unificato."}
        </p>

        <div>
          <label style={{ display: "block", marginBottom: 4, fontSize: 13, fontWeight: 600 }}>Nome *</label>
          <input
            type="text"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            required
            placeholder="Nome e cognome"
            style={inputStyle}
          />

          <label style={{ display: "block", marginBottom: 4, marginTop: 12, fontSize: 13, fontWeight: 600 }}>Telefono *</label>
          <input
            type="tel"
            value={telefono}
            onChange={(e) => setTelefono(e.target.value)}
            required
            placeholder="Numero di telefono"
            style={inputStyle}
          />

          <label style={{ display: "block", marginBottom: 4, marginTop: 12, fontSize: 13, fontWeight: 600 }}>Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email (per invito a registrarsi)"
            style={inputStyle}
          />

          <div style={{ position: "relative", marginTop: 12 }}>
            <label style={{ display: "block", marginBottom: 4, fontSize: 13, fontWeight: 600 }}>Indirizzo</label>
            <div style={{ display: "flex", gap: 8, alignItems: "stretch" }}>
              <input
                ref={inputAddressRef}
                type="text"
                value={indirizzo}
                onChange={(e) => {
                  setIndirizzo(e.target.value)
                  setMapCenter(null)
                }}
                placeholder="Inizia a digitare per cercare l'indirizzo..."
                style={{ ...inputStyle, flex: 1, minWidth: 0 }}
              />
              <button
                type="button"
                onClick={handleUseMyLocation}
                disabled={geoLoading}
                title="Usa la posizione di questo dispositivo (geolocalizzazione)"
                aria-label="Usa la mia posizione"
                style={{
                  flexShrink: 0,
                  width: 44,
                  border: "1px solid #ddd",
                  borderRadius: 6,
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
            </div>
            {geoError && (
              <p style={{ margin: "4px 0 0", fontSize: 11, color: "#b91c1c" }}>{geoError}</p>
            )}
            {showSuggestions && addressSuggestions.length > 0 && (
              <ul
                ref={suggestionsRef}
                style={{
                  listStyle: "none",
                  margin: "4px 0 0",
                  padding: 0,
                  background: "#fff",
                  border: "1px solid #ddd",
                  borderRadius: 6,
                  boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                  maxHeight: 200,
                  overflowY: "auto",
                  position: "absolute",
                  left: 0,
                  right: 0,
                  zIndex: 10,
                }}
              >
                {dedupedSuggestions.map(({ item, label }, i) => (
                  <li
                    key={i}
                    role="button"
                    tabIndex={0}
                    onMouseDown={(e) => {
                      e.preventDefault()
                      handleSelectSuggestion(item)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault()
                        handleSelectSuggestion(item)
                      }
                    }}
                    style={{
                      padding: "10px 12px",
                      cursor: "pointer",
                      borderBottom: "1px solid #eee",
                      fontSize: 13,
                    }}
                  >
                    {label}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div style={{ marginTop: 12 }}>
            <label style={{ display: "block", marginBottom: 4, fontSize: 13, fontWeight: 600 }}>Mappa</label>
            {mapCaption ? (
              <p style={{ margin: "0 0 6px", fontSize: 11, color: "#64748b", lineHeight: 1.35 }}>{mapCaption}</p>
            ) : null}
            <div
              ref={mapContainerRef}
              style={{
                width: "100%",
                height: 260,
                borderRadius: 8,
                overflow: "hidden",
                border: "1px solid #ddd",
                background: "#f0f0f0",
              }}
              aria-label="Mappa indirizzo e area di consegna"
            />
            {!deliveryBbox ? (
              <p style={{ margin: "6px 0 0", fontSize: 11, color: "#b45309" }}>
                Nessun poligono area di consegna configurato in Impostazioni — la mappa mostra solo l’indirizzo cercato.
              </p>
            ) : null}
          </div>
        </div>

        {error && (
          <div style={{ marginTop: 12, padding: 10, background: "#ffebee", color: "#c62828", borderRadius: 6, fontSize: 13 }}>
            {error}
          </div>
        )}

        <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
          <button type="submit" className="btn-primary-dashboard" disabled={loading || !nome?.trim() || !telefono?.trim()}>
            {loading ? "Salvataggio..." : isEdit ? "Salva modifiche" : "Salva cliente"}
          </button>
          <button type="button" style={{ padding: "8px 16px", background: "#999", color: "#fff", border: "none", borderRadius: 6 }} onClick={handleClose}>
            Annulla
          </button>
        </div>
      </form>
    </Modal>
  )
}
