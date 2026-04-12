import { useCallback, useMemo, useState } from "react"

const VIEWPORT_PRESETS = [
  { id: "iphone-14", label: "iPhone 14", w: 390, h: 844 },
  { id: "iphone-se", label: "iPhone SE", w: 375, h: 667 },
  { id: "pixel-7", label: "Pixel 7", w: 412, h: 915 },
  { id: "ipad-port", label: "iPad verticale", w: 768, h: 1024 },
  { id: "ipad-land", label: "iPad orizzontale", w: 1024, h: 768 },
  { id: "tablet-narrow", label: "Tablet stretto", w: 600, h: 960 },
  { id: "desktop-hd", label: "Desktop HD", w: 1280, h: 720 },
]

const QUICK_PATHS = [
  { path: "/preview", label: "Anteprima vetrina" },
  { path: "/negozio", label: "Negozio pubblico" },
  { path: "/login", label: "Login" },
  { path: "/contatti", label: "Contatti" },
  { path: "/admin/home", label: "Admin · Home" },
  { path: "/admin/menu/categorie", label: "Admin · Menu" },
  { path: "/operative/cassa", label: "Operativo · Cassa" },
  { path: "/operative/dashboard", label: "Operativo · Riepilogo" },
  { path: "/superadmin/ingresso", label: "Super Admin · Ingresso" },
]

const ZOOM_OPTIONS = [
  { value: 0.5, label: "50%" },
  { value: 0.65, label: "65%" },
  { value: 0.75, label: "75%" },
  { value: 0.85, label: "85%" },
  { value: 1, label: "100%" },
]

/** Solo path interni same-origin (nessun URL assoluto / protocolli). */
export function sanitizeSuperadminPreviewPath(raw) {
  const s = String(raw || "").trim()
  if (!s.startsWith("/")) return "/preview"
  if (s.startsWith("//")) return "/preview"
  const one = s.replace(/^\/{2,}/, "/")
  if (/^\/https?:/i.test(one)) return "/preview"
  const [pathPart] = one.split("#")
  const path = (pathPart || "/preview").split("?")[0] || "/preview"
  return path.startsWith("/") ? path : "/preview"
}

export default function SuperadminViewportTesterPage() {
  const [pathInput, setPathInput] = useState("/preview")
  const [presetId, setPresetId] = useState("iphone-14")
  const [customW, setCustomW] = useState(390)
  const [customH, setCustomH] = useState(844)
  const [useCustomSize, setUseCustomSize] = useState(false)
  const [rotated, setRotated] = useState(false)
  const [zoom, setZoom] = useState(0.75)
  const [iframeKey, setIframeKey] = useState(0)

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
          Incapsula una pagina dell&apos;app in un riquadro con larghezza e altezza tipiche di cellulare o tablet.
          Utile per verificare subito menu, cassa e vetrina senza ridimensionare manualmente il browser.
        </p>
        <p style={{ marginTop: 10, fontSize: 13, color: "#64748b", maxWidth: 820, lineHeight: 1.5 }}>
          <strong>Nota:</strong> Admin e Operativo usano la sessione corrente del browser. Se sei loggato solo come
          Super Admin, quelle URL possono reindirizzare al login nel riquadro; per testarle entra con un account
          appropriato oppure usa <strong>Anteprima vetrina</strong> e le pagine pubbliche.
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
          <label style={labelStyle}>Dispositivo (preset)</label>
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
                onClick={() => applyPreset(p.id)}
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
          </div>
        </div>

        <div>
          <label style={labelStyle}>Zoom riquadro</label>
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
            Ricarica iframe
          </button>
          <a href={iframeSrc} target="_blank" rel="noopener noreferrer" className="sa-table-action">
            Apri in scheda
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
