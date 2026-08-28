import { useEffect, useRef } from "react"
import L from "leaflet"
import "leaflet/dist/leaflet.css"

const DEFAULT_CENTER = { lat: 45.4064, lng: 11.8768 } // Padova: fallback senza indirizzo/sede

function pinIcon(color) {
  return L.divIcon({
    className: "cassa-consegna-pin",
    html:
      `<svg width="26" height="36" viewBox="0 0 30 42" xmlns="http://www.w3.org/2000/svg">` +
      `<path d="M15 0C6.7 0 0 6.7 0 15c0 10.5 15 27 15 27s15-16.5 15-27C30 6.7 23.3 0 15 0z" fill="${color}"/>` +
      `<circle cx="15" cy="15" r="6" fill="#fff"/>` +
      `</svg>`,
    iconSize: [26, 36],
    iconAnchor: [13, 36],
  })
}

const GREEN_ICON = pinIcon("#16a34a")
const RED_ICON = pinIcon("#dc2626")

/** Marcatore negozio: logo del tenant (diverso per ogni locale) in un cerchio, senza logo un emoji negozio. */
function shopIcon(logoUrl) {
  const inner = logoUrl
    ? `<img src="${logoUrl}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" />`
    : `<span style="font-size:18px;line-height:1;">🏪</span>`
  return L.divIcon({
    className: "cassa-consegna-shop-pin",
    html:
      `<div style="width:34px;height:34px;border-radius:50%;background:#fff;border:3px solid #1565c0;` +
      `box-shadow:0 1px 4px rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:center;overflow:hidden;">` +
      `${inner}</div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
  })
}

/**
 * Mappa cassa: mentre si prende un ordine telefonico a domicilio, mostra il punto verde del
 * cliente in corso e i punti rossi (con orario) degli altri ordini a domicilio di oggi — per
 * capire a colpo d'occhio se la zona è già coperta da altre consegne nella stessa fascia,
 * anche senza conoscere bene le vie. Leaflet + OpenStreetMap, coerente con la mappa indirizzo
 * cliente (nessuna chiave API/fatturazione da configurare).
 */
export default function CassaConsegnaMappaSlot({ currentCoords, altreConsegne, shopCoords, shopLogoUrl, height = 260 }) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const layerRef = useRef(null)
  const shopIconRef = useRef(null)
  if (!shopIconRef.current || shopIconRef.current.logoUrl !== shopLogoUrl) {
    shopIconRef.current = { logoUrl: shopLogoUrl, icon: shopIcon(shopLogoUrl) }
  }

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return undefined
    const center = currentCoords || shopCoords || DEFAULT_CENTER
    const map = L.map(containerRef.current, {
      center: [center.lat, center.lng],
      zoom: currentCoords ? 14 : 12,
      scrollWheelZoom: true,
    })
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map)
    layerRef.current = L.layerGroup().addTo(map)
    mapRef.current = map
    return () => {
      map.remove()
      mapRef.current = null
      layerRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- init una tantum (guardia mapRef.current sopra); coords lette solo al primo mount, poi aggiornate dal marker nel secondo effect
  }, [])

  useEffect(() => {
    const map = mapRef.current
    const layer = layerRef.current
    if (!map || !layer) return
    layer.clearLayers()

    const bounds = []
    if (shopCoords) {
      L.marker([shopCoords.lat, shopCoords.lng], { icon: shopIconRef.current.icon, zIndexOffset: 500 })
        .bindTooltip("Il tuo locale", { permanent: false })
        .addTo(layer)
      bounds.push([shopCoords.lat, shopCoords.lng])
    }
    if (currentCoords) {
      L.marker([currentCoords.lat, currentCoords.lng], { icon: GREEN_ICON })
        .bindTooltip("Questo ordine", { permanent: false })
        .addTo(layer)
      bounds.push([currentCoords.lat, currentCoords.lng])
    }
    for (const o of altreConsegne || []) {
      if (o.lat == null || o.lng == null) continue
      L.marker([o.lat, o.lng], { icon: RED_ICON })
        .bindTooltip(o.orario ? `#${o.numero ?? "—"} · ${o.orario}` : `#${o.numero ?? "—"}`, { permanent: false })
        .addTo(layer)
      bounds.push([o.lat, o.lng])
    }

    if (bounds.length > 1) {
      map.fitBounds(bounds, { padding: [24, 24], maxZoom: 15 })
    } else if (bounds.length === 1) {
      map.setView(bounds[0], 14)
    }
  }, [currentCoords, altreConsegne, shopCoords])

  return (
    <div>
      <div
        ref={containerRef}
        style={{
          width: "100%",
          height,
          borderRadius: 10,
          border: "1px solid #d0d8e6",
          overflow: "hidden",
          background: "#f1f5f9",
        }}
        aria-label="Mappa consegne di oggi"
      />
      <p style={{ fontSize: 12, color: "#64748b", margin: "6px 0 0", lineHeight: 1.4 }}>
        🏪 il tuo locale ·{" "}
        <span style={{ color: "#16a34a", fontWeight: 700 }}>●</span> questo ordine ·{" "}
        <span style={{ color: "#dc2626", fontWeight: 700 }}>●</span> altre consegne di oggi (con orario)
      </p>
    </div>
  )
}
