import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useSearchParams } from "react-router-dom"
import {
  VIEWPORT_PRESETS,
  QUICK_PATHS,
  ZOOM_OPTIONS,
  sanitizeSuperadminPreviewPath,
  buildViewportStudioUrl,
} from "@/features/superadmin/utils/viewportTesterShared"

export default function SuperadminViewportTesterPage() {
  const [searchParams] = useSearchParams()
  const hydratedFromUrl = useRef(false)

  const [pathInput, setPathInput] = useState("/preview")
  const [presetId, setPresetId] = useState("iphone-14")
  const [customW, setCustomW] = useState(390)
  const [customH, setCustomH] = useState(844)
  const [useCustomSize, setUseCustomSize] = useState(false)
  const [rotated, setRotated] = useState(false)
  const [zoom, setZoom] = useState(0.75)
  const [iframeKey, setIframeKey] = useState(0)

  useEffect(() => {
    if (hydratedFromUrl.current) return
    hydratedFromUrl.current = true
    const p = searchParams.get("path")
    if (p) setPathInput(p)
    const z = Number(searchParams.get("zoom"))
    if (Number.isFinite(z) && z > 0) setZoom(Math.min(1, Math.max(0.35, z)))
    if (searchParams.get("rotate") === "1") setRotated(true)

    const pr = searchParams.get("preset")
    if (pr && VIEWPORT_PRESETS.some((x) => x.id === pr)) {
      setPresetId(pr)
      setUseCustomSize(false)
      const presetRow = VIEWPORT_PRESETS.find((x) => x.id === pr)
      if (presetRow) {
        setCustomW(presetRow.w)
        setCustomH(presetRow.h)
      }
    }

    const w = Number(searchParams.get("w"))
    const h = Number(searchParams.get("h"))
    if (Number.isFinite(w) && w > 0 && Number.isFinite(h) && h > 0) {
      setCustomW(w)
      setCustomH(h)
      const match = VIEWPORT_PRESETS.find((row) => row.w === w && row.h === h)
      if (match) {
        setPresetId(match.id)
        setUseCustomSize(false)
      } else if (!pr) {
        setUseCustomSize(true)
      }
    }

    if (searchParams.get("custom") === "1") setUseCustomSize(true)
  }, [searchParams])

  const preset = VIEWPORT_PRESETS.find((p) => p.id === presetId) || VIEWPORT_PRESETS[0]
  const baseW = useCustomSize ? customW : preset.w
  const baseH = useCustomSize ? customH : preset.h
  const frameW = rotated ? baseH : baseW
  const frameH = rotated ? baseW : baseH

  const safePath = useMemo(() => sanitizeSuperadminPreviewPath(pathInput), [pathInput])

  const iframeSrc = useMemo(() => {
    const origin = typeof window !== "undefined" ? window.location.origin : ""
    const sep = safePath.includes("?") ? "&" : "?"
    return `${origin}${safePath}${sep}_viewport_tester=${iframeKey}`
  }, [safePath, iframeKey])

  const applyPreset = useCallback((id) => {
    setPresetId(id)
    setUseCustomSize(false)
    const p = VIEWPORT_PRESETS.find((x) => x.id === id)
    if (p) {
      setCustomW(p.w)
      setCustomH(p.h)
    }
  }, [])

  const openStudioTab = useCallback(
    (opts) => {
      const url = buildViewportStudioUrl(opts)
      window.open(url, "_blank", "noopener,noreferrer")
    },
    [],
  )

  const openStudioWithCurrentFrame = useCallback(() => {
    openStudioTab({
      path: safePath,
      w: baseW,
      h: baseH,
      zoom,
      rotate: rotated,
    })
  }, [openStudioTab, safePath, baseW, baseH, zoom, rotated])

  const labelStyle = { display: "block", fontSize: 12, fontWeight: 600, marginBottom: 6, color: "#475569" }
  const inputStyle = {
    width: "100%",
    maxWidth: 420,
    padding: "8px 12px",
    border: "1px solid #cbd5e1",
    borderRadius: 8,
    fontSize: 14,
    boxSizing: "border-box",
  }

  return (
    <>
      <header className="sa-page-header">
        <p className="sa-page-kicker">Super Admin · QA responsive</p>
        <h1 className="dashboard-page-title sa-page-title">Test layout (viewport)</h1>
        <p className="sa-page-lede" style={{ maxWidth: 820 }}>
          Scegli un dispositivo: si apre una <strong>nuova scheda</strong> in modalità{" "}
          <strong>studio</strong> (schermo intero, come anteprima Wix/Google Sites) con l&apos;area operativa
          nell&apos;iframe. Qui sotto resta anche l&apos;anteprima inline per confronti rapidi.
        </p>
        <p style={{ marginTop: 10, fontSize: 13, color: "#64748b", maxWidth: 820, lineHeight: 1.5 }}>
          <strong>Nota:</strong> L&apos;iframe è same-origin: riusa la sessione Supabase (cookie/storage) del browser. Da{" "}
          <strong>superadmin</strong>, con il parametro <code>_viewport_tester</code> / <code>_studio</code> puoi aprire
          anche Admin e Operativo senza ruolo <code>admin</code> (solo anteprima layout). Su <strong>/login</strong> in
          anteprima non parte il redirect automatico se sei già autenticato, così vedi il form responsive. In{" "}
          <code>npm run dev</code>, dopo un <strong>full reload</strong> di Vite la scheda studio ricarica l&apos;area da
          sola; altrimenti usa &quot;Ricarica area&quot;.
        </p>
      </header>

      <div
        className="dashboard-box"
        style={{
          padding: 20,
          marginBottom: 16,
          display: "grid",
          gap: 16,
          gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
          alignItems: "start",
        }}
      >
        <div>
          <label style={labelStyle}>Percorso (solo same-origin, inizia con /)</label>
          <input
            type="text"
            value={pathInput}
            onChange={(e) => setPathInput(e.target.value)}
            placeholder="/preview"
            style={inputStyle}
            spellCheck={false}
            autoComplete="off"
          />
          <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 8 }}>
            {QUICK_PATHS.map((q) => (
              <button
                key={q.path}
                type="button"
                className="sa-table-action"
                onClick={() => setPathInput(q.path)}
                title={q.path}
              >
                {q.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label style={labelStyle}>Dispositivo → apre scheda studio</label>
          <p style={{ margin: "0 0 8px", fontSize: 12, color: "#64748b" }}>
            Clic sul preset: nuova scheda a tutto schermo. Stesso percorso e zoom selezionati qui.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {VIEWPORT_PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                className="sa-table-action"
                style={{
                  fontWeight: !useCustomSize && presetId === p.id ? 700 : 500,
                  border: !useCustomSize && presetId === p.id ? "2px solid #334155" : undefined,
                }}
                onClick={() => {
                  applyPreset(p.id)
                  openStudioTab({
                    path: sanitizeSuperadminPreviewPath(pathInput),
                    w: p.w,
                    h: p.h,
                    zoom,
                    rotate: rotated,
                  })
                }}
              >
                {p.label} ({p.w}×{p.h})
              </button>
            ))}
          </div>
        </div>

        <div>
          <label style={labelStyle}>Dimensioni personalizzate</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
            <input
              type="number"
              min={200}
              max={2000}
              value={customW}
              onChange={(e) => setCustomW(Number(e.target.value) || 390)}
              style={{ ...inputStyle, width: 100, maxWidth: 120 }}
              aria-label="Larghezza px"
            />
            <span style={{ color: "#64748b" }}>×</span>
            <input
              type="number"
              min={200}
              max={2000}
              value={customH}
              onChange={(e) => setCustomH(Number(e.target.value) || 844)}
              style={{ ...inputStyle, width: 100, maxWidth: 120 }}
              aria-label="Altezza px"
            />
            <button type="button" className="sa-table-action" onClick={() => setUseCustomSize(true)}>
              Applica misure
            </button>
            <button
              type="button"
              className="btn-primary-dashboard"
              style={{ fontSize: 13, padding: "8px 14px" }}
              onClick={() => {
                setUseCustomSize(true)
                openStudioTab({
                  path: sanitizeSuperadminPreviewPath(pathInput),
                  w: customW,
                  h: customH,
                  zoom,
                  rotate: rotated,
                })
              }}
            >
              Studio con misure custom
            </button>
          </div>
        </div>

        <div>
          <label style={labelStyle}>Zoom (scheda + anteprima sotto)</label>
          <select
            value={String(zoom)}
            onChange={(e) => setZoom(Number(e.target.value))}
            style={{ ...inputStyle, maxWidth: 160 }}
          >
            {ZOOM_OPTIONS.map((z) => (
              <option key={z.value} value={String(z.value)}>
                {z.label}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "flex-end" }}>
          <button type="button" className="sa-table-action" onClick={() => setRotated((r) => !r)}>
            {rotated ? "Orientamento: orizzontale" : "Orientamento: verticale"} (ruota)
          </button>
          <button type="button" className="btn-primary-dashboard" onClick={() => setIframeKey((k) => k + 1)}>
            Ricarica iframe (qui)
          </button>
          <button type="button" className="btn-primary-dashboard" onClick={openStudioWithCurrentFrame}>
            Apri studio (scheda attuale)
          </button>
          <a href={iframeSrc} target="_blank" rel="noopener noreferrer" className="sa-table-action">
            Solo URL in scheda
          </a>
        </div>
      </div>

      <div style={{ marginBottom: 10, fontSize: 13, color: "#475569" }}>
        <strong>Riquadro:</strong> {Math.round(frameW)} × {Math.round(frameH)} px · <strong>URL:</strong>{" "}
        <code style={{ fontSize: 12 }}>{safePath}</code>
      </div>

      <div
        style={{
          overflow: "auto",
          maxHeight: "calc(100vh - 56px - 320px)",
          minHeight: 320,
          padding: 16,
          background: "#e2e8f0",
          borderRadius: 12,
          border: "1px solid #cbd5e1",
          display: "flex",
          justifyContent: "center",
          alignItems: "flex-start",
        }}
      >
        <div
          style={{
            width: frameW * zoom,
            height: frameH * zoom,
            position: "relative",
            flexShrink: 0,
          }}
        >
          <div
            style={{
              width: frameW,
              height: frameH,
              transform: `scale(${zoom})`,
              transformOrigin: "top left",
              borderRadius: 12,
              overflow: "hidden",
              boxShadow: "0 12px 40px rgba(15, 23, 42, 0.25)",
              border: "3px solid #334155",
              background: "#fff",
              boxSizing: "border-box",
            }}
          >
            <iframe
              key={iframeSrc}
              title={`Anteprima ${safePath}`}
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
    </>
  )
}
