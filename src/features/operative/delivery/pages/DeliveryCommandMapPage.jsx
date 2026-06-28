import { useCallback, useEffect, useRef, useState } from "react"
import { Link } from "react-router-dom"
import { useTenant } from "@/app/contexts/TenantContext"
import { getOrders } from "@/features/admin/services/adminService"
import { loadGoogleMapsScript } from "@/lib/googleMapsLoader"

const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY
const POLL_MS = 12000
const STATI = ["PRONTO", "IN_PREPARAZIONE"]

function isDelivery(o) {
  const t = String(o?.tipo_ordine ?? o?.tipoOrdine ?? "").trim().toLowerCase()
  if (t === "delivery" || t === "consegna") return true
  return Boolean(String(o?.indirizzo_consegna ?? o?.indirizzoConsegna ?? "").trim())
}

function coords(o) {
  const lat = Number(o?.consegna_lat ?? o?.consegnaLat)
  const lng = Number(o?.consegna_lng ?? o?.consegnaLng)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  return { lat, lng }
}

/**
 * Mappa live consegne in corso (sala comando / delivery desk).
 */
export default function DeliveryCommandMapPage() {
  const { tenantId } = useTenant()
  const mapElRef = useRef(null)
  const mapRef = useRef(null)
  const markersRef = useRef([])
  const [orders, setOrders] = useState([])
  const [error, setError] = useState(null)
  const [mapReady, setMapReady] = useState(false)

  const load = useCallback(async () => {
    if (!tenantId) return
    try {
      setError(null)
      const rows = []
      for (const stato of STATI) {
        const chunk = await getOrders(tenantId, { stato, todayOnly: true, limit: 120 })
        if (chunk?.length) rows.push(...chunk)
      }
      const filtered = (rows || [])
        .filter(isDelivery)
        .filter((o) => String(o.stato ?? "").toUpperCase() !== "ANNULLATO")
        .filter((o) => coords(o))
      setOrders(filtered)
    } catch (e) {
      setError(e?.message || "Errore caricamento ordini")
    }
  }, [tenantId])

  useEffect(() => {
    load()
    const t = setInterval(load, POLL_MS)
    return () => clearInterval(t)
  }, [load])

  useEffect(() => {
    if (!GOOGLE_API_KEY || !mapElRef.current) return
    let cancelled = false
    loadGoogleMapsScript(GOOGLE_API_KEY)
      .then(() => {
        if (cancelled || !mapElRef.current || !window.google?.maps?.Map) return
        mapRef.current = new window.google.maps.Map(mapElRef.current, {
          center: { lat: 41.9028, lng: 12.4964 },
          zoom: 13,
          mapTypeControl: false,
          streetViewControl: false,
        })
        setMapReady(true)
      })
      .catch((e) => setError(e?.message || "Mappa non disponibile"))
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!mapReady || !map || !window.google?.maps) return

    for (const m of markersRef.current) m.setMap(null)
    markersRef.current = []

    const bounds = new window.google.maps.LatLngBounds()
    let hasPoint = false

    for (const o of orders) {
      const c = coords(o)
      if (!c) continue
      hasPoint = true
      const pos = { lat: c.lat, lng: c.lng }
      bounds.extend(pos)
      const sc = String(o.stato_consegna ?? o.statoConsegna ?? "").trim()
      const color = sc === "IN_VIAGGIO" ? "#f59e0b" : sc === "ASSEGNATO" ? "#7c3aed" : "#16a34a"
      const marker = new window.google.maps.Marker({
        map,
        position: pos,
        title: `#${o.numero ?? ""} ${o.nome_cliente ?? o.nomeCliente ?? ""}`,
        label: { text: String(o.numero ?? ""), color: "#fff", fontSize: "11px", fontWeight: "700" },
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 14,
          fillColor: color,
          fillOpacity: 1,
          strokeColor: "#fff",
          strokeWeight: 2,
        },
      })
      markersRef.current.push(marker)
    }

    if (hasPoint) {
      map.fitBounds(bounds, 48)
    }
  }, [orders, mapReady])

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100dvh", background: "#0f172a" }}>
      <header
        style={{
          padding: "12px 16px",
          color: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div>
          <strong style={{ fontSize: 17 }}>Mappa consegne live</strong>
          <p style={{ margin: "4px 0 0", fontSize: 12, opacity: 0.85 }}>
            {orders.length} ordini con coordinate · aggiornamento ogni {POLL_MS / 1000}s
          </p>
        </div>
        <Link to="/operative/delivery" style={{ color: "#93c5fd", fontSize: 13, fontWeight: 600 }}>
          ← Lista delivery
        </Link>
      </header>
      {error ? (
        <p style={{ padding: 12, margin: 0, background: "#fef2f2", color: "#b91c1c", fontWeight: 600 }}>{error}</p>
      ) : null}
      {!GOOGLE_API_KEY ? (
        <p style={{ padding: 16, color: "#fde68a" }}>
          Configura <code>VITE_GOOGLE_MAPS_API_KEY</code> per la mappa live.
        </p>
      ) : (
        <div ref={mapElRef} style={{ flex: 1, minHeight: 280 }} />
      )}
      <div style={{ padding: "10px 14px", background: "#1e293b", color: "#cbd5e1", fontSize: 11, display: "flex", gap: 16 }}>
        <span>
          <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: "50%", background: "#16a34a", marginRight: 4 }} />
          Pronto
        </span>
        <span>
          <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: "50%", background: "#7c3aed", marginRight: 4 }} />
          Assegnato
        </span>
        <span>
          <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: "50%", background: "#f59e0b", marginRight: 4 }} />
          In viaggio
        </span>
      </div>
    </div>
  )
}
