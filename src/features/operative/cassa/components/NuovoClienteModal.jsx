import { useState, useEffect, useRef, useMemo } from "react"
import Modal from "@/components/dashboard/Modal"
import { createAnagraficaCliente, updateAnagraficaCliente } from "@/features/admin/services/adminService"
import { getDeliveryPolygonOuterRing } from "@/utils/deliveryArea"
import { formatIndirizzoFromNominatim } from "@/utils/formatIndirizzoItaliano"

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
const inputStyle = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 6,
  border: "1px solid #ddd",
  fontSize: 14,
}

function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebouncedValue(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debouncedValue
}

async function searchAddress(query) {
  const q = (query || "").trim()
  if (q.length < 3) return []
  const params = new URLSearchParams({
    q,
    format: "json",
    limit: "5",
    addressdetails: "1",
  })
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
  const suggestionsRef = useRef(null)
  const inputAddressRef = useRef(null)

  const debouncedIndirizzo = useDebounce(indirizzo, 400)

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
      searchAddress(ind).then((list) => {
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
  }, [open, initialData])

  useEffect(() => {
    let cancelled = false
    if (!debouncedIndirizzo || debouncedIndirizzo.length < 3) {
      setAddressSuggestions([])
      setShowSuggestions(false)
      setMapCenter(null)
      return
    }
    searchAddress(debouncedIndirizzo).then((list) => {
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
  }, [debouncedIndirizzo])

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
    setIndirizzo(formatIndirizzoFromNominatim(item))
    setMapCenter({ lat: parseFloat(item.lat), lon: parseFloat(item.lon) })
    setShowSuggestions(false)
    setAddressSuggestions([])
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
      const payload = {
        nome: nomeTrim,
        indirizzo: indirizzo?.trim() || null,
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

  const mapSrc = useMemo(() => {
    if (mapCenter) {
      const { lat, lon } = mapCenter
      const delta = 0.008
      const bbox = `${lon - delta},${lat - delta},${lon + delta},${lat + delta}`
      return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat}%2C${lon}`
    }
    if (deliveryBbox) {
      const { minLng, minLat, maxLng, maxLat } = deliveryBbox
      return `https://www.openstreetmap.org/export/embed.html?bbox=${minLng},${minLat},${maxLng},${maxLat}&layer=mapnik`
    }
    return null
  }, [mapCenter, deliveryBbox])

  const mapCaption = useMemo(() => {
    if (mapCenter) return "Posizione dall’indirizzo (cerca o scegli un suggerimento)."
    if (deliveryBbox) return "Area di consegna del locale (da Impostazioni). Inserisci l’indirizzo per il punto cliente."
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

        <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 280px", minWidth: 0 }}>
            <label style={{ display: "block", marginBottom: 4, fontSize: 13, fontWeight: 600 }}>Nome *</label>
            <input
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              required
              placeholder="Nome e cognome"
              style={inputStyle}
            />

            <div style={{ position: "relative", marginTop: 12 }}>
              <label style={{ display: "block", marginBottom: 4, fontSize: 13, fontWeight: 600 }}>Indirizzo</label>
              <input
                ref={inputAddressRef}
                type="text"
                value={indirizzo}
                onChange={(e) => {
                  setIndirizzo(e.target.value)
                  setMapCenter(null)
                }}
                placeholder="Inizia a digitare per cercare l'indirizzo..."
                style={inputStyle}
              />
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
                  {addressSuggestions.map((item, i) => (
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
                      {formatIndirizzoFromNominatim(item)}
                    </li>
                  ))}
                </ul>
              )}
            </div>

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
          </div>

          <div style={{ flex: "1 1 280px", minWidth: 0 }}>
            <label style={{ display: "block", marginBottom: 4, fontSize: 13, fontWeight: 600 }}>Mappa</label>
            {mapCaption ? (
              <p style={{ margin: "0 0 6px", fontSize: 11, color: "#64748b", lineHeight: 1.35 }}>{mapCaption}</p>
            ) : null}
            <div
              style={{
                width: "100%",
                height: 220,
                borderRadius: 8,
                overflow: "hidden",
                border: "1px solid #ddd",
                background: "#f0f0f0",
              }}
            >
              {mapSrc ? (
                <iframe
                  title="Mappa indirizzo e area di consegna"
                  src={mapSrc}
                  style={{ width: "100%", height: "100%", border: 0 }}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              ) : (
                <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#666", fontSize: 13, padding: 12, textAlign: "center" }}>
                  Configura il poligono area di consegna in Impostazioni oppure cerca un indirizzo per la mappa.
                </div>
              )}
            </div>
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
