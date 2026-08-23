import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Link } from "react-router-dom"
import { useTenant } from "@/app/contexts/TenantContext"
import { usePv } from "@/app/contexts/PvContext"
import { getOrders, getRiderPosizioniLive } from "@/features/admin/services/adminService"
import { loadGoogleMapsScript } from "@/lib/googleMapsLoader"
import { useOperativeOrdersLiveRefresh } from "@/features/operative/hooks/useOperativeOrdersLiveRefresh"
import {
  resolveDeliveryPolygonOuterRing,
  resolveShopCoords,
} from "@/utils/deliveryArea"

const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY
const POLL_FALLBACK_MS = 30000
const STATI = ["PRONTO", "IN_PREPARAZIONE"]
const RIDER_POLL_MS = 20000
const POLY_STYLE = {
  fillColor: "#e65100",
  fillOpacity: 0.22,
  strokeColor: "#bf360c",
  strokeOpacity: 0.85,
  strokeWeight: 2,
}

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

function shopMarkerIcon(logoUrl) {
  const g = window.google?.maps
  if (!g) return undefined
  if (logoUrl) {
    return {
      url: logoUrl,
      scaledSize: new g.Size(36, 36),
      anchor: new g.Point(18, 18),
    }
  }
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="42" height="42" viewBox="0 0 42 42">` +
    `<circle cx="21" cy="21" r="18" fill="#c0392b" stroke="#fff" stroke-width="3"/>` +
    `<text x="21" y="27" text-anchor="middle" font-size="20">🏪</text></svg>`
  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: new g.Size(42, 42),
    anchor: new g.Point(21, 21),
  }
}

function waitForMapContainer(el, attempts = 40) {
  return new Promise((resolve) => {
    let left = attempts
    const tick = () => {
      if (!el) {
        resolve(false)
        return
      }
      const { width, height } = el.getBoundingClientRect()
      if (width >= 20 && height >= 20) {
        resolve(true)
        return
      }
      left -= 1
      if (left <= 0) {
        resolve(true)
        return
      }
      window.requestAnimationFrame(tick)
    }
    tick()
  })
}

/**
 * @param {{ onClose?: () => void, embedded?: boolean }} props
 */
export default function DeliveryCommandMapPage({ onClose, embedded = false } = {}) {
  const { tenantId, tenantData } = useTenant()
  const pvCtx = usePv()
  const activePvId = pvCtx?.activePv ?? null
  const pvList = pvCtx?.pvList ?? []
  const activePv = useMemo(
    () => pvList.find((p) => String(p.id) === String(activePvId)) ?? null,
    [pvList, activePvId],
  )

  const mapElRef = useRef(null)
  const mapRef = useRef(null)
  const markersRef = useRef([])
  const riderMarkersRef = useRef([])
  const shopMarkerRef = useRef(null)
  const polygonRef = useRef(null)
  const viewportReadyRef = useRef(false)
  const [orders, setOrders] = useState([])
  const [riders, setRiders] = useState([])
  const [error, setError] = useState(null)
  const [mapReady, setMapReady] = useState(false)

  const shopCoords = useMemo(
    () => resolveShopCoords(tenantData, activePv),
    [tenantData, activePv],
  )

  const deliveryRing = useMemo(
    () => resolveDeliveryPolygonOuterRing(tenantData, activePv),
    [tenantData, activePv],
  )

  const shopLogoUrl = tenantData?.logo_url ?? tenantData?.logoUrl ?? null

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
      .then(async () => {
        if (cancelled || !mapElRef.current || !window.google?.maps?.Map) return
        await waitForMapContainer(mapElRef.current)
        if (cancelled || !mapElRef.current) return
        mapRef.current = new window.google.maps.Map(mapElRef.current, {
          center: shopCoords || { lat: 45.4064, lng: 11.8768 },
          zoom: shopCoords ? 14 : 13,
          mapTypeControl: false,
          streetViewControl: false,
          gestureHandling: "greedy",
        })
        setMapReady(true)
      })
      .catch((e) => setError(e?.message || "Mappa non disponibile"))

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const applyMapViewport = useCallback(() => {
    const map = mapRef.current
    if (!map || !window.google?.maps) return

    const bounds = new window.google.maps.LatLngBounds()
    let hasBounds = false

    if (shopCoords) {
      bounds.extend(shopCoords)
      hasBounds = true
    }
    for (const o of orders) {
      const c = coords(o)
      if (!c) continue
      bounds.extend(c)
      hasBounds = true
    }
    for (const r of riders) {
      const lat = Number(r.lat)
      const lng = Number(r.lng)
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue
      bounds.extend({ lat, lng })
      hasBounds = true
    }
    if (deliveryRing) {
      for (const [lng, lat] of deliveryRing) {
        bounds.extend({ lat: Number(lat), lng: Number(lng) })
        hasBounds = true
      }
    }

    if (!hasBounds) return

    const onlyShop =
      shopCoords &&
      orders.length === 0 &&
      riders.length === 0 &&
      (!deliveryRing || deliveryRing.length === 0)

    if (onlyShop) {
      map.setCenter(shopCoords)
      map.setZoom(14)
      return
    }

    map.fitBounds(bounds, deliveryRing && orders.length === 0 && riders.length === 0 ? 32 : 48)
  }, [shopCoords, deliveryRing, orders, riders])

  useEffect(() => {
    const map = mapRef.current
    if (!mapReady || !map || !window.google?.maps) return

    for (const m of markersRef.current) m.setMap(null)
    markersRef.current = []

    for (const o of orders) {
      const c = coords(o)
      if (!c) continue
      const sc = String(o.stato_consegna ?? o.statoConsegna ?? "").trim()
      const color = sc === "IN_VIAGGIO" ? "#f59e0b" : sc === "ASSEGNATO" ? "#7c3aed" : "#16a34a"
      const marker = new window.google.maps.Marker({
        map,
        position: c,
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
      ...POLY_STYLE,
      zIndex: 1,
    })
  }, [deliveryRing, mapReady])

  useEffect(() => {
    const map = mapRef.current
    if (!mapReady || !map || !window.google?.maps) return
    if (shopMarkerRef.current) {
      shopMarkerRef.current.setMap(null)
      shopMarkerRef.current = null
    }
    if (!shopCoords) return
    const icon = shopLogoUrl ? shopMarkerIcon(shopLogoUrl) : undefined
    shopMarkerRef.current = new window.google.maps.Marker({
      map,
      position: shopCoords,
      title: activePv?.nome || tenantData?.nome || "Il locale",
      ...(icon ? { icon } : {}),
      ...(!icon
        ? {
            label: {
              text: "🏪",
              fontSize: "22px",
              fontWeight: "700",
            },
          }
        : {}),
      zIndex: 1000,
    })
  }, [shopCoords, mapReady, tenantData?.nome, activePv?.nome, shopLogoUrl])

  useEffect(() => {
    if (!mapReady) return
    applyMapViewport()
    viewportReadyRef.current = true
  }, [mapReady, applyMapViewport])

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

  const triggerMapResize = useCallback(() => {
    const map = mapRef.current
    if (!map || !window.google?.maps?.event) return
    window.google.maps.event.trigger(map, "resize")
  }, [])

  useEffect(() => {
    if (!mapReady) return undefined
    const el = mapElRef.current
    if (!el || typeof ResizeObserver === "undefined") {
      const id = window.setTimeout(() => {
        triggerMapResize()
        applyMapViewport()
      }, 150)
      return () => window.clearTimeout(id)
    }
    const ro = new ResizeObserver(() => {
      triggerMapResize()
      if (!viewportReadyRef.current) applyMapViewport()
    })
    ro.observe(el)
    triggerMapResize()
    applyMapViewport()
    return () => ro.disconnect()
  }, [mapReady, triggerMapResize, applyMapViewport])

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        width: "100%",
        flex: embedded ? "1 1 auto" : undefined,
        minHeight: 0,
        minWidth: 0,
        background: "#0f172a",
      }}
    >
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
            {!shopCoords ? " · sede non geolocalizzata" : ""}
            {!deliveryRing ? " · area consegna non configurata" : ""}
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
        <div ref={mapElRef} style={{ flex: 1, minHeight: 0, width: "100%", alignSelf: "stretch" }} />
      )}
      <div
        style={{
          padding: "10px 14px",
          background: "#1e293b",
          color: "#cbd5e1",
          fontSize: 11,
          display: "flex",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <span>
          <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: "50%", background: "#c0392b", marginRight: 4 }} />
          🏪 Il locale
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
