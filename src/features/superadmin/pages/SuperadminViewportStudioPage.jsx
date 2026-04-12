import { useCallback, useEffect, useMemo, useState } from "react"
import { Link, useSearchParams } from "react-router-dom"
import { sanitizeSuperadminPreviewPath } from "@/features/superadmin/utils/viewportTesterShared"

const TOP_BAR = 52

/**
 * Anteprima a schermo intero (senza SuperAdminLayout): cornice dispositivo + iframe area operativa.
 * Query: path, w, h, zoom (0–1), rotate (0|1). In dev, full reload Vite rigenera l’iframe.
 */
export default function SuperadminViewportStudioPage() {
  const [searchParams] = useSearchParams()
  const [iframeKey, setIframeKey] = useState(0)
  const [viewport, setViewport] = useState({ w: typeof window !== "undefined" ? window.innerWidth : 1200, h: 800 })

  const safePath = useMemo(() => sanitizeSuperadminPreviewPath(searchParams.get("path")), [searchParams])
  const baseW = Math.max(200, Math.min(2400, Number(searchParams.get("w")) || 390))
  const baseH = Math.max(200, Math.min(2400, Number(searchParams.get("h")) || 844))
  const rotated = searchParams.get("rotate") === "1"
  const frameW = rotated ? baseH : baseW
  const frameH = rotated ? baseW : baseH
  const zoomParam = Number(searchParams.get("zoom"))
  const userZoom = Number.isFinite(zoomParam) ? Math.min(1, Math.max(0.35, zoomParam)) : 0.75

  const iframeSrc = useMemo(() => {
    const origin = typeof window !== "undefined" ? window.location.origin : ""
    const sep = safePath.includes("?") ? "&" : "?"
    return `${origin}${safePath}${sep}_studio=${iframeKey}`
  }, [safePath, iframeKey])

  useEffect(() => {
    const onResize = () => setViewport({ w: window.innerWidth, h: window.innerHeight })
    window.addEventListener("resize", onResize)
    onResize()
    return () => window.removeEventListener("resize", onResize)
  }, [])

  const fitScale = useMemo(() => {
    const padX = 32
    const padY = 24 + TOP_BAR
    const availW = Math.max(200, viewport.w - padX)
    const availH = Math.max(200, viewport.h - padY)
    const fit = Math.min(availW / frameW, availH / frameH, 1)
    return Math.min(fit, userZoom > 0 ? userZoom : 1)
  }, [viewport.w, viewport.h, frameW, frameH, userZoom])

  const bumpIframe = useCallback(() => setIframeKey((k) => k + 1), [])

  useEffect(() => {
    if (import.meta.env.PROD) return undefined
    const h = import.meta.hot
    if (!h) return undefined
    const onFullReload = () => bumpIframe()
    h.on("vite:beforeFullReload", onFullReload)
    return () => {
      h.off("vite:beforeFullReload", onFullReload)
    }
  }, [bumpIframe])

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 20000,
        display: "flex",
        flexDirection: "column",
        background: "#0b1220",
        color: "#e2e8f0",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <header
        style={{
          flexShrink: 0,
          height: TOP_BAR,
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "0 14px",
          borderBottom: "1px solid rgba(148, 163, 184, 0.25)",
          background: "rgba(15, 23, 42, 0.95)",
        }}
      >
        <strong style={{ fontSize: 13, letterSpacing: "0.02em" }}>Viewport studio</strong>
        <span style={{ fontSize: 12, color: "#94a3b8" }}>
          {Math.round(frameW)}×{Math.round(frameH)} · fit {Math.round(fitScale * 100)}%
        </span>
        <code
          style={{
            fontSize: 11,
            color: "#cbd5e1",
            maxWidth: "min(40vw, 360px)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
          title={safePath}
        >
          {safePath}
        </code>
        <span style={{ flex: 1 }} />
        <button
          type="button"
          onClick={bumpIframe}
          style={{
            padding: "6px 12px",
            borderRadius: 8,
            border: "1px solid #475569",
            background: "#1e293b",
            color: "#fff",
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Ricarica area
        </button>
        <Link
          to={`/superadmin/test-layout?path=${encodeURIComponent(safePath)}&w=${baseW}&h=${baseH}&zoom=${userZoom}&rotate=${rotated ? "1" : "0"}`}
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: "#38bdf8",
            textDecoration: "none",
          }}
        >
          Configurazione
        </Link>
        <button
          type="button"
          onClick={() => window.close()}
          style={{
            padding: "6px 12px",
            borderRadius: 8,
            border: "none",
            background: "#334155",
            color: "#fff",
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Chiudi scheda
        </button>
      </header>

      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 16,
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            width: frameW * fitScale,
            height: frameH * fitScale,
            position: "relative",
            flexShrink: 0,
          }}
        >
          <div
            style={{
              width: frameW,
              height: frameH,
              transform: `scale(${fitScale})`,
              transformOrigin: "top left",
              borderRadius: 14,
              overflow: "hidden",
              boxShadow: "0 0 0 2px rgba(148, 163, 184, 0.35), 0 24px 64px rgba(0,0,0,0.45)",
              background: "#fff",
              boxSizing: "border-box",
            }}
          >
            <iframe
              key={iframeSrc}
              title={`Studio ${safePath}`}
              src={iframeSrc}
              style={{
                width: frameW,
                height: frameH,
                border: "none",
                display: "block",
                background: "#fff",
              }}
              sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
        </div>
      </div>

      {import.meta.env.DEV ? (
        <p
          style={{
            margin: 0,
            padding: "6px 14px 10px",
            fontSize: 11,
            color: "#64748b",
            textAlign: "center",
          }}
        >
          Dev: dopo un full reload di Vite l&apos;area si ricarica da sola. Per modifiche senza reload completo usa
          &quot;Ricarica area&quot;.
        </p>
      ) : null}
    </div>
  )
}
