import { useEffect, useRef, useState } from "react"
import { loadGoogleMapsScript } from "@/lib/googleMapsLoader"
import { googlePathToGeoJsonPolygon } from "@/utils/deliveryArea"

const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY

/**
 * Disegno poligono area di consegna (GeoJSON Polygon in WGS84).
 * @param {{ lat?: number | null, lng?: number | null }} props.center — sede pizzeria
 * @param {object | null} props.value — GeoJSON Polygon
 * @param {(gj: object | null) => void} props.onChange
 */
export default function DeliveryAreaMapEditor({ center, value, onChange, height = 400 }) {
  const mapElRef = useRef(null)
  const polygonRef = useRef(null)
  const dmRef = useRef(null)
  const [loadError, setLoadError] = useState(null)

  const lat = Number(center?.lat)
  const lng = Number(center?.lng)
  const centerOk = Number.isFinite(lat) && Number.isFinite(lng)

  useEffect(() => {
    if (!GOOGLE_API_KEY || !mapElRef.current) return
    let cancelled = false

    loadGoogleMapsScript(GOOGLE_API_KEY, "drawing")
      .then(() => {
        if (cancelled || !mapElRef.current) return

        const mapCenter = centerOk ? { lat, lng } : { lat: 41.9028, lng: 12.4964 }
        const map = new window.google.maps.Map(mapElRef.current, {
          center: mapCenter,
          zoom: centerOk ? 14 : 6,
          mapTypeControl: false,
          streetViewControl: false,
        })

        const syncFromPolygon = (poly) => {
          const path = poly.getPath()
          const gj = googlePathToGeoJsonPolygon(path)
          onChange?.(gj)
        }

        const attachPathListeners = (poly) => {
          const path = poly.getPath()
          for (const ev of ["set_at", "insert_at", "remove_at"]) {
            window.google.maps.event.addListener(path, ev, () => syncFromPolygon(poly))
          }
        }

        if (value?.type === "Polygon" && Array.isArray(value.coordinates?.[0])) {
          const path = value.coordinates[0].map(([lo, la]) => ({ lat: Number(la), lng: Number(lo) }))
          if (path.length >= 3) {
            const poly = new window.google.maps.Polygon({
              paths: path,
              editable: true,
              draggable: true,
              fillColor: "#e65100",
              fillOpacity: 0.22,
              strokeColor: "#bf360c",
              strokeWeight: 2,
              map,
            })
            polygonRef.current = poly
            attachPathListeners(poly)
            window.google.maps.event.addListener(poly, "dragend", () => syncFromPolygon(poly))
          }
        }

        const dm = new window.google.maps.drawing.DrawingManager({
          drawingMode: window.google.maps.drawing.OverlayType.POLYGON,
          drawingControl: true,
          drawingControlOptions: {
            position: window.google.maps.ControlPosition.TOP_CENTER,
            drawingModes: [window.google.maps.drawing.OverlayType.POLYGON],
          },
          polygonOptions: {
            fillColor: "#e65100",
            fillOpacity: 0.22,
            strokeColor: "#bf360c",
            strokeWeight: 2,
            editable: true,
            draggable: true,
          },
        })
        dm.setMap(map)
        dmRef.current = dm

        window.google.maps.event.addListener(dm, "overlaycomplete", (e) => {
          if (e.type !== window.google.maps.drawing.OverlayType.POLYGON) return
          if (polygonRef.current) polygonRef.current.setMap(null)
          polygonRef.current = e.overlay
          e.overlay.setEditable(true)
          e.overlay.setDraggable(true)
          attachPathListeners(e.overlay)
          window.google.maps.event.addListener(e.overlay, "dragend", () => syncFromPolygon(e.overlay))
          dm.setDrawingMode(null)
          syncFromPolygon(e.overlay)
        })
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err?.message || "Errore caricamento mappa")
      })

    return () => {
      cancelled = true
      if (polygonRef.current) {
        polygonRef.current.setMap(null)
        polygonRef.current = null
      }
      if (dmRef.current) {
        dmRef.current.setMap(null)
        dmRef.current = null
      }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps -- remount con key dal parent se serve reset

  if (!GOOGLE_API_KEY) {
    return (
      <p style={{ fontSize: 13, color: "#888" }}>
        Per disegnare l&apos;area su mappa configura <code>VITE_GOOGLE_MAPS_API_KEY</code> nel file ambiente (stessa chiave usata per i dati pizzeria).
      </p>
    )
  }

  if (loadError) {
    return <p style={{ fontSize: 13, color: "#c62828" }}>{loadError}</p>
  }

  return (
    <div>
      <div
        ref={mapElRef}
        style={{
          width: "100%",
          height,
          borderRadius: 8,
          border: "1px solid #e0e0e0",
          marginTop: 8,
        }}
      />
      <p style={{ fontSize: 12, color: "#888", marginTop: 8 }}>
        Usa il marcatore poligono in alto sulla mappa, chiudi il perimetro cliccando sul primo punto. Puoi trascinare i vertici per rifinire.
      </p>
    </div>
  )
}
