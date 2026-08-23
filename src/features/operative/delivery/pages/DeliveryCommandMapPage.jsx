import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Link } from "react-router-dom"
import { useTenant } from "@/app/contexts/TenantContext"
import { getOrders, getRiderPosizioniLive } from "@/features/admin/services/adminService"
import { loadGoogleMapsScript } from "@/lib/googleMapsLoader"
import { useOperativeOrdersLiveRefresh } from "@/features/operative/hooks/useOperativeOrdersLiveRefresh"
import { getDeliveryPolygonOuterRing } from "@/utils/deliveryArea"

const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY
const POLL_FALLBACK_MS = 30000
const STATI = ["PRONTO", "IN_PREPARAZIONE"]
// I pony sincronizzano la loro posizione al massimo ogni 60s (vedi useRiderPositionSync):
// interrogarla più spesso di così non porterebbe dati più freschi.
const RIDER_POLL_MS = 20000

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
/**
 * @param {{ onClose?: () => void }} props — `onClose` presente quando la mappa è aperta come
 * pannello dentro un'altra pagina (es. tasto "Live" in Cassa): mostra "✕ Chiudi" al posto del
 * link "← Lista delivery" e non tocca la cronologia di navigazione.
 */
export default function DeliveryCommandMapPage({ onClose } = {}) {
  const { tenantId, tenantData } = useTenant()
  const mapElRef = useRef(null)
  const mapRef = useRef(null)
  const markersRef = useRef([])
  const riderMarkersRef = useRef([])
  const shopMarkerRef = useRef(null)
  const polygonRef = useRef(null)
  const [orders, setOrders] = useState([])
  const [riders, setRiders] = useState([])
  const [error, setError] = useState(null)
  const [mapReady, setMapReady] = useState(false)

  /** La sede del locale: punto di riferimento fisso della mappa ("focus su di noi"), non un
   * centro generico — prima la mappa apriva sempre su Roma finché non arrivava il primo ordine. */
  const shopCoords = useMemo(() => {
    const lat = Number(tenantData?.lat)
    const lng = Number(tenantData?.lng)
    return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null
  }, [tenantData?.lat, tenantData?.lng])

  /** Confine dell'area di consegna configurata in Impostazioni (stesso dato usato dal checkout
   * pubblico e da Cassa per capire se un indirizzo è coperto), come riferimento visivo qui. */
  const deliveryRing = useMemo(
    () => getDeliveryPolygonOuterRing(tenantData?.parametri_operativi),
    [tenantData?.parametri_operativi],
  )

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

  const loadRiders = useCallback(async () => {
    if (!tenantId) return
    try {
      const rows = await getRiderPosizioniLive(tenantId)
      setRiders(Array.isArray(rows) ? rows : [])
    } catch (e) {
      // Non blocca la mappa ordini se la posizione pony non è disponibile (es. nessun rider
      // ha ancora sincronizzato oggi): solo log, la sezione ordini resta comunque utile.
      console.warn("[DeliveryCommandMapPage] loadRiders:", e?.message ?? e)
    }
  }, [tenantId])

  useOperativeOrdersLiveRefresh({
    tenantId,
    onRefresh: () => load(),
    pollMs: POLL_FALLBACK_MS,
  })

  useEffect(() => {
    if (!tenantId) return undefined
    void loadRiders()
    const id = window.setInterval(() => void loadRiders(), RIDER_POLL_MS)
    return () => window.clearInterval(id)
  }, [tenantId, loadRiders])

  useEffect(() => {
    if (!GOOGLE_API_KEY || !mapElRef.current) return
    let cancelled = false
    loadGoogleMapsScript(GOOGLE_API_KEY)
      .then(() => {
        if (cancelled || !mapElRef.current || !window.google?.maps?.Map) return
        // Apre già centrata sul locale quando conosciamo la sua posizione: prima apriva sempre
        // su un punto fisso a Roma finché non arrivava il primo ordine con coordinate.
        mapRef.current = new window.google.maps.Map(mapElRef.current, {
          center: shopCoords || { lat: 45.4064, lng: 11.8768 }, // fallback Padova, non Roma
          zoom: shopCoords ? 14 : 13,
          mapTypeControl: false,
          streetViewControl: false,
          // Zoom con la sola rotellina e trascinamento a un dito, senza dover tenere premuto
          // Ctrl: qui la mappa occupa tutto lo schermo apposta, non c'è pagina sotto da scrollare.
          gestureHandling: "greedy",
        })
        setMapReady(true)
      })
      .catch((e) => setError(e?.message || "Mappa non disponibile"))
    return () => {
      cancelled = true
    }
    // shopCoords deliberatamente fuori dalle dipendenze: solo per il centro iniziale, la mappa
    // non va ricreata da zero se cambia dopo — al ricentraggio pensa l'effetto più sotto.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!mapReady || !map || !window.google?.maps) return

    for (const m of markersRef.current) m.setMap(null)
    markersRef.current = []

    for (const o of orders) {
      const c = coords(o)
      if (!c) continue
      const pos = { lat: c.lat, lng: c.lng }
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
  }, [orders, mapReady])

  /** Perimetro area di consegna: sfondo statico, sotto a tutti i marker (clickable:false perché
   * qui è solo di riferimento, non modificabile come nell'editor Admin). */
  useEffect(() => {
    const map = mapRef.current
    if (!mapReady || !map || !window.google?.maps) return
    if (polygonRef.current) {
      polygonRef.current.setMap(null)
      polygonRef.current = null
    }
    if (!deliveryRing) return
    const paths = deliveryRing.map(([lng, lat]) => ({ lat: Number(lat), lng: Number(lng) }))
    polygonRef.current = new window.google.maps.Polygon({
      paths,
      map,
      clickable: false,
      fillColor: "#e65100",
      fillOpacity: 0.1,
      strokeColor: "#bf360c",
      strokeOpacity: 0.7,
      strokeWeight: 2,
      zIndex: 1,
    })
  }, [deliveryRing, mapReady])

  /** Marker della sede: punto fisso, sempre presente quando conosciamo la posizione del locale. */
  useEffect(() => {
    const map = mapRef.current
    if (!mapReady || !map || !window.google?.maps) return
    if (shopMarkerRef.current) {
      shopMarkerRef.current.setMap(null)
      shopMarkerRef.current = null
    }
    if (!shopCoords) return
    shopMarkerRef.current = new window.google.maps.Marker({
      map,
      position: shopCoords,
      title: tenantData?.nome || "Il locale",
      label: { text: "🍕", fontSize: "16px" },
      icon: {
        path: window.google.maps.SymbolPath.CIRCLE,
        scale: 16,
        fillColor: "#c0392b",
        fillOpacity: 1,
        strokeColor: "#fff",
        strokeWeight: 3,
      },
      zIndex: 1000,
    })
  }, [shopCoords, mapReady, tenantData?.nome])

  /** Inquadratura: la sede è sempre inclusa ("focus su di noi"), non solo dove capitano ordini
   * e pony in quel momento — se c'è un solo punto sullo schermo (es. nessun ordine ancora) si
   * centra lì senza uno zoom estremo. */
  useEffect(() => {
    const map = mapRef.current
    if (!mapReady || !map || !window.google?.maps) return

    const points = []
    if (shopCoords) points.push(shopCoords)
    for (const o of orders) {
      const c = coords(o)
      if (c) points.push(c)
    }
    for (const r of riders) {
      const lat = Number(r.lat)
      const lng = Number(r.lng)
      if (Number.isFinite(lat) && Number.isFinite(lng)) points.push({ lat, lng })
    }
    if (points.length === 0) return
    if (points.length === 1) {
      // Solo la sede, nessun ordine/pony in questo momento: se conosciamo l'area di consegna
      // mostriamo tutta quella (più utile di uno zoom via a filo sul solo puntino del locale).
      if (deliveryRing) {
        const areaBounds = new window.google.maps.LatLngBounds()
        for (const [lng, lat] of deliveryRing) areaBounds.extend({ lat: Number(lat), lng: Number(lng) })
        map.fitBounds(areaBounds, 32)
        return
      }
      map.setCenter(points[0])
      map.setZoom(14)
      return
    }
    const bounds = new window.google.maps.LatLngBounds()
    for (const p of points) bounds.extend(p)
    map.fitBounds(bounds, 48)
  }, [orders, riders, shopCoords, deliveryRing, mapReady])

  /** Marker separati per i pony (icona a moto, sopra i pallini ordine): niente fitBounds qui,
   * altrimenti la mappa "salterebbe" ogni 20s riallineandosi anche sui soli pony. */
  useEffect(() => {
    const map = mapRef.current
    if (!mapReady || !map || !window.google?.maps) return

    for (const m of riderMarkersRef.current) m.setMap(null)
    riderMarkersRef.current = []

    for (const r of riders) {
      const lat = Number(r.lat)
      const lng = Number(r.lng)
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue
      const marker = new window.google.maps.Marker({
        map,
        position: { lat, lng },
        title: `${r.nome_display || "Pony"} · aggiornato ${new Date(r.aggiornato_at).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}`,
        label: { text: "🛵", fontSize: "16px" },
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 15,
          fillColor: "#0f172a",
          fillOpacity: 0.9,
          strokeColor: "#38bdf8",
          strokeWeight: 2,
        },
        zIndex: 999,
      })
      riderMarkersRef.current.push(marker)
    }
  }, [riders, mapReady])

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0, background: "#0f172a" }}>
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
            {orders.length} ordini con coordinate · {riders.length} pony in linea · Realtime + fallback{" "}
            {POLL_FALLBACK_MS / 1000}s
          </p>
        </div>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "rgba(255,255,255,0.12)",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              padding: "8px 14px",
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            ✕ Chiudi mappa
          </button>
        ) : (
          <Link to="/operative/delivery" style={{ color: "#93c5fd", fontSize: 13, fontWeight: 600 }}>
            ← Lista delivery
          </Link>
        )}
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
      <div style={{ padding: "10px 14px", background: "#1e293b", color: "#cbd5e1", fontSize: 11, display: "flex", gap: 16, flexWrap: "wrap" }}>
        <span>
          <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: "50%", background: "#c0392b", marginRight: 4 }} />
          🍕 Il locale
        </span>
        {deliveryRing ? (
          <span>
            <span
              style={{
                display: "inline-block",
                width: 14,
                height: 10,
                background: "rgba(230,81,0,0.25)",
                border: "1px solid #bf360c",
                marginRight: 4,
                verticalAlign: "middle",
              }}
            />
            Area di consegna
          </span>
        ) : null}
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
        <span>
          <span
            style={{
              display: "inline-block",
              width: 14,
              height: 14,
              borderRadius: "50%",
              background: "#0f172a",
              border: "2px solid #38bdf8",
              marginRight: 4,
              verticalAlign: "middle",
            }}
          />
          🛵 Pony (posizione live)
        </span>
      </div>
    </div>
  )
}
