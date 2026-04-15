import { useEffect, useRef, useState, useCallback } from "react"
import { loadGoogleMapsScript } from "@/lib/googleMapsLoader"
import { googlePathToGeoJsonPolygon, densifyPolygonRingLngLat } from "@/utils/deliveryArea"

const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY

/**
 * @param {{ lat?: number | null, lng?: number | null }} props.center — sede / punto vendita
 * @param {object | null} props.value — GeoJSON Polygon
 * @param {(gj: object | null) => void} props.onChange
 * @param {(lat: number, lng: number) => void} [props.onCenterMarkerDrag] — se impostato, marcatore sede trascinabile
 * @param {number} [props.densifyExtraPerEdge=2] — punti aggiunti su ogni lato dopo il disegno (sagomatura)
 */
export default function DeliveryAreaMapEditor({
  center,
  value,
  onChange,
  height = 400,
  onCenterMarkerDrag,
  densifyExtraPerEdge = 2,
}) {
  const mapElRef = useRef(null)
  const mapRef = useRef(null)
  const markerRef = useRef(null)
  const polygonRef = useRef(null)
  const dmRef = useRef(null)
  const listenersRef = useRef([])
  const [loadError, setLoadError] = useState(null)
  const [mapReady, setMapReady] = useState(false)

  const lat = Number(center?.lat)
  const lng = Number(center?.lng)
  const centerOk = Number.isFinite(lat) && Number.isFinite(lng)

  const clearPolygonListeners = useCallback(() => {
    for (const l of listenersRef.current) {
      try {
        window.google.maps.event.removeListener(l)
      } catch {
        /* ignore */
      }
    }
    listenersRef.current = []
  }, [])

  const syncFromPolygon = useCallback(
    (poly) => {
      const path = poly.getPath()
      const gj = googlePathToGeoJsonPolygon(path)
      onChange?.(gj)
    },
    [onChange],
  )

  const attachPathListeners = useCallback(
    (poly) => {
      clearPolygonListeners()
      const path = poly.getPath()
      for (const ev of ["set_at", "insert_at", "remove_at"]) {
        const l = window.google.maps.event.addListener(path, ev, () => syncFromPolygon(poly))
        listenersRef.current.push(l)
      }
      const l2 = window.google.maps.event.addListener(poly, "dragend", () => syncFromPolygon(poly))
      listenersRef.current.push(l2)
    },
    [clearPolygonListeners, syncFromPolygon],
  )

  const densifyGooglePolygonPath = useCallback(
    (poly) => {
      const path = poly.getPath()
      const gj = googlePathToGeoJsonPolygon(path)
      if (!gj?.coordinates?.[0]?.length) return
      const dense = densifyPolygonRingLngLat(gj.coordinates[0], densifyExtraPerEdge)
      path.clear()
      for (const [lo, la] of dense) {
        path.push(new window.google.maps.LatLng(la, lo))
      }
    },
    [densifyExtraPerEdge],
  )

  const buildPolygonFromValue = useCallback(
    (map, gj) => {
      if (gj?.type !== "Polygon" || !Array.isArray(gj.coordinates?.[0])) return null
      const path = gj.coordinates[0].map(([lo, la]) => ({ lat: Number(la), lng: Number(lo) }))
      if (path.length < 3) return null
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
      attachPathListeners(poly)
      return poly
    },
    [attachPathListeners],
  )

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
          /** Rotella = zoom quando il cursore è sulla mappa (default API: cooperative = serve Ctrl+rotella). */
          gestureHandling: "greedy",
        })
        mapRef.current = map

        const marker = new window.google.maps.Marker({
          position: mapCenter,
          map,
          draggable: Boolean(onCenterMarkerDrag),
          title: onCenterMarkerDrag ? "Trascina per impostare la sede sulla mappa" : "Sede (centro area)",
          zIndex: 1000,
          icon: {
            path: window.google.maps.SymbolPath.CIRCLE,
            scale: 9,
            fillColor: "#0f766e",
            fillOpacity: 1,
            strokeColor: "#fff",
            strokeWeight: 2,
          },
        })
        markerRef.current = marker
        if (onCenterMarkerDrag) {
          marker.addListener("dragend", () => {
            const p = marker.getPosition()
            if (p) onCenterMarkerDrag(p.lat(), p.lng())
          })
        }

        const dm = new window.google.maps.drawing.DrawingManager({
          drawingMode: null,
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
          if (polygonRef.current) {
            polygonRef.current.setMap(null)
            clearPolygonListeners()
          }
          const overlay = e.overlay
          polygonRef.current = overlay
          overlay.setEditable(true)
          overlay.setDraggable(true)
          densifyGooglePolygonPath(overlay)
          attachPathListeners(overlay)
          dm.setDrawingMode(null)
          syncFromPolygon(overlay)
        })

        setMapReady(true)
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err?.message || "Errore caricamento mappa")
      })

    return () => {
      cancelled = true
      clearPolygonListeners()
      if (polygonRef.current) {
        polygonRef.current.setMap(null)
        polygonRef.current = null
      }
      if (markerRef.current) {
        markerRef.current.setMap(null)
        markerRef.current = null
      }
      if (dmRef.current) {
        dmRef.current.setMap(null)
        dmRef.current = null
      }
      mapRef.current = null
      setMapReady(false)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!mapReady || !mapRef.current || !markerRef.current) return
    const pos = centerOk ? { lat, lng } : { lat: 41.9028, lng: 12.4964 }
    mapRef.current.setCenter(pos)
    markerRef.current.setPosition(pos)
    markerRef.current.setDraggable(Boolean(onCenterMarkerDrag))
  }, [mapReady, lat, lng, centerOk, onCenterMarkerDrag])

  /**
   * Sincronizza `value` esterno → mappa solo se non c’è già un poligono attivo (es. caricamento iniziale o “rimuovi”).
   * Durante modifica utente polygonRef è valorizzato → non sovrascriviamo.
   */
  useEffect(() => {
    if (!mapReady || !mapRef.current) return
    const has =
      value?.type === "Polygon" &&
      Array.isArray(value.coordinates?.[0]) &&
      value.coordinates[0].length >= 4

    if (!has) {
      if (polygonRef.current) {
        polygonRef.current.setMap(null)
        polygonRef.current = null
        clearPolygonListeners()
      }
      return
    }

    if (polygonRef.current) return

    const poly = buildPolygonFromValue(mapRef.current, value)
    polygonRef.current = poly
    if (poly) {
      const b = new window.google.maps.LatLngBounds()
      poly.getPath().forEach((p) => b.extend(p))
      mapRef.current.fitBounds(b, 48)
    }
  }, [mapReady, value, buildPolygonFromValue, clearPolygonListeners])

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
      {!centerOk ? (
        <div
          style={{
            marginTop: 8,
            padding: "10px 12px",
            borderRadius: 8,
            border: "1px solid #fde68a",
            background: "#fffbeb",
            color: "#92400e",
            fontSize: 12,
            lineHeight: 1.5,
          }}
        >
          Centro sede non impostato: la mappa apre una vista generale dell'Italia. Imposta prima lat/lng della sede o trascina
          il marcatore verde e poi salva.
        </div>
      ) : null}
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
      <p style={{ fontSize: 12, color: "#64748b", marginTop: 8, lineHeight: 1.55 }}>
        <strong>Marcatore verde</strong>: punto di riferimento della sede.{" "}
        {onCenterMarkerDrag ? "Trascinalo per posizionare correttamente il punto vendita sulla mappa. " : null}
        Disegna il poligono con lo strumento in alto; al termine il perimetro viene arricchito con punti intermedi così puoi
        sagomare meglio. Puoi cliccare su un lato del poligono per aggiungere vertici. Chiudi il perimetro cliccando sul primo
        punto.
      </p>
    </div>
  )
}
