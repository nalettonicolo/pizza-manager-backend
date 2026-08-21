import { useEffect, useRef, useState, useCallback } from "react"
import { loadGoogleMapsScript } from "@/lib/googleMapsLoader"
import { googlePathToGeoJsonPolygon, densifyPolygonRingLngLat } from "@/utils/deliveryArea"

const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY

const POLY_STYLE = {
  fillColor: "#e65100",
  fillOpacity: 0.22,
  strokeColor: "#bf360c",
  strokeWeight: 2,
}

/**
 * Disegno area consegna senza DrawingManager (rimosso da Maps JS API ≥ 3.65).
 * Click per aggiungere vertici; doppio click o «Chiudi poligono» per terminare.
 *
 * @param {{ lat?: number | null, lng?: number | null }} props.center — sede / punto vendita
 * @param {object | null} props.value — GeoJSON Polygon
 * @param {(gj: object | null) => void} props.onChange
 * @param {(lat: number, lng: number) => void} [props.onCenterMarkerDrag]
 * @param {number} [props.densifyExtraPerEdge=2]
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
  const draftPathRef = useRef(null)
  const draftLineRef = useRef(null)
  const drawListenersRef = useRef([])
  const listenersRef = useRef([])
  const drawModeRef = useRef(false)
  const [loadError, setLoadError] = useState(null)
  const [mapReady, setMapReady] = useState(false)
  const [drawMode, setDrawMode] = useState(false)
  const [draftCount, setDraftCount] = useState(0)
  const [hasArea, setHasArea] = useState(false)

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

  const clearDrawListeners = useCallback(() => {
    for (const l of drawListenersRef.current) {
      try {
        window.google.maps.event.removeListener(l)
      } catch {
        /* ignore */
      }
    }
    drawListenersRef.current = []
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

  const clearDraft = useCallback(() => {
    draftPathRef.current = null
    setDraftCount(0)
    if (draftLineRef.current) {
      draftLineRef.current.setMap(null)
      draftLineRef.current = null
    }
  }, [])

  const stopDrawMode = useCallback(() => {
    drawModeRef.current = false
    setDrawMode(false)
    clearDrawListeners()
    clearDraft()
    const map = mapRef.current
    if (map) map.setOptions({ draggableCursor: null })
  }, [clearDrawListeners, clearDraft])

  const finishPolygonFromDraft = useCallback(() => {
    const map = mapRef.current
    const pts = draftPathRef.current
    if (!map || !pts || pts.length < 3) return

    if (polygonRef.current) {
      polygonRef.current.setMap(null)
      clearPolygonListeners()
    }

    const poly = new window.google.maps.Polygon({
      paths: pts,
      editable: true,
      draggable: true,
      ...POLY_STYLE,
      map,
    })
    polygonRef.current = poly
    setHasArea(true)
    densifyGooglePolygonPath(poly)
    attachPathListeners(poly)
    syncFromPolygon(poly)
    stopDrawMode()
  }, [
    attachPathListeners,
    clearPolygonListeners,
    densifyGooglePolygonPath,
    stopDrawMode,
    syncFromPolygon,
  ])

  const startDrawMode = useCallback(() => {
    const map = mapRef.current
    if (!map || !window.google?.maps) return

    stopDrawMode()
    drawModeRef.current = true
    setDrawMode(true)
    draftPathRef.current = []
    setDraftCount(0)
    map.setOptions({ draggableCursor: "crosshair" })

    const line = new window.google.maps.Polyline({
      path: [],
      strokeColor: POLY_STYLE.strokeColor,
      strokeWeight: 2,
      map,
    })
    draftLineRef.current = line

    const onClick = window.google.maps.event.addListener(map, "click", (e) => {
      if (!drawModeRef.current || !e.latLng) return
      const pts = draftPathRef.current || []
      pts.push(e.latLng)
      draftPathRef.current = pts
      line.setPath(pts)
      setDraftCount(pts.length)
    })

    const onDbl = window.google.maps.event.addListener(map, "dblclick", (e) => {
      if (!drawModeRef.current) return
      e?.stop?.()
      if ((draftPathRef.current || []).length >= 3) {
        finishPolygonFromDraft()
      }
    })

    drawListenersRef.current = [onClick, onDbl]
  }, [finishPolygonFromDraft, stopDrawMode])

  const buildPolygonFromValue = useCallback(
    (map, gj) => {
      if (gj?.type !== "Polygon" || !Array.isArray(gj.coordinates?.[0])) return null
      const path = gj.coordinates[0].map(([lo, la]) => ({ lat: Number(la), lng: Number(lo) }))
      if (path.length < 3) return null
      const poly = new window.google.maps.Polygon({
        paths: path,
        editable: true,
        draggable: true,
        ...POLY_STYLE,
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

    loadGoogleMapsScript(GOOGLE_API_KEY, null)
      .then(() => {
        if (cancelled || !mapElRef.current) return

        const mapCenter = centerOk ? { lat, lng } : { lat: 41.9028, lng: 12.4964 }
        const map = new window.google.maps.Map(mapElRef.current, {
          center: mapCenter,
          zoom: centerOk ? 14 : 6,
          mapTypeControl: false,
          streetViewControl: false,
          gestureHandling: "greedy",
          disableDoubleClickZoom: true,
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

        setMapReady(true)
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err?.message || "Errore caricamento mappa")
      })

    return () => {
      cancelled = true
      clearPolygonListeners()
      clearDrawListeners()
      clearDraft()
      if (polygonRef.current) {
        polygonRef.current.setMap(null)
        polygonRef.current = null
      }
      if (markerRef.current) {
        markerRef.current.setMap(null)
        markerRef.current = null
      }
      mapRef.current = null
      setMapReady(false)
      setDrawMode(false)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!mapReady || !mapRef.current || !markerRef.current) return
    const pos = centerOk ? { lat, lng } : { lat: 41.9028, lng: 12.4964 }
    mapRef.current.setCenter(pos)
    markerRef.current.setPosition(pos)
    markerRef.current.setDraggable(Boolean(onCenterMarkerDrag))
  }, [mapReady, lat, lng, centerOk, onCenterMarkerDrag])

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
      setHasArea(false)
      return
    }

    if (polygonRef.current) {
      setHasArea(true)
      return
    }

    const poly = buildPolygonFromValue(mapRef.current, value)
    polygonRef.current = poly
    setHasArea(Boolean(poly))
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
          Centro sede non impostato: la mappa apre una vista generale dell&apos;Italia. Imposta prima lat/lng della sede o trascina
          il marcatore verde e poi salva.
        </div>
      ) : null}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8, alignItems: "center" }}>
        {!drawMode ? (
          <button
            type="button"
            onClick={startDrawMode}
            disabled={!mapReady}
            style={btnPrimary}
          >
            Disegna area
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={finishPolygonFromDraft}
              disabled={draftCount < 3}
              style={btnPrimary}
            >
              Chiudi poligono ({draftCount} punti)
            </button>
            <button type="button" onClick={stopDrawMode} style={btnSecondary}>
              Annulla disegno
            </button>
          </>
        )}
        {hasArea || value?.type === "Polygon" ? (
          <button
            type="button"
            onClick={() => {
              stopDrawMode()
              if (polygonRef.current) {
                polygonRef.current.setMap(null)
                polygonRef.current = null
                clearPolygonListeners()
              }
              setHasArea(false)
              onChange?.(null)
            }}
            style={btnSecondary}
          >
            Rimuovi area
          </button>
        ) : null}
      </div>

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
        Premi <strong>Disegna area</strong>, poi clicca sulla mappa per i vertici (almeno 3). Termina con{" "}
        <strong>doppio clic</strong> o «Chiudi poligono». Il perimetro viene arricchito con punti intermedi; puoi
        trascinare i vertici per sagomare.
      </p>
    </div>
  )
}

const btnPrimary = {
  padding: "8px 14px",
  borderRadius: 8,
  border: "none",
  background: "#e65100",
  color: "#fff",
  fontWeight: 600,
  fontSize: 13,
  cursor: "pointer",
}

const btnSecondary = {
  padding: "8px 14px",
  borderRadius: 8,
  border: "1px solid #cbd5e1",
  background: "#fff",
  color: "#334155",
  fontWeight: 600,
  fontSize: 13,
  cursor: "pointer",
}
