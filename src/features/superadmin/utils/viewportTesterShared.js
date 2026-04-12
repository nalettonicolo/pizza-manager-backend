/** Preset dispositivo (px logici). */
export const VIEWPORT_PRESETS = [
  { id: "iphone-14", label: "iPhone 14", w: 390, h: 844 },
  { id: "iphone-se", label: "iPhone SE", w: 375, h: 667 },
  { id: "pixel-7", label: "Pixel 7", w: 412, h: 915 },
  { id: "ipad-port", label: "iPad verticale", w: 768, h: 1024 },
  { id: "ipad-land", label: "iPad orizzontale", w: 1024, h: 768 },
  { id: "tablet-narrow", label: "Tablet stretto", w: 600, h: 960 },
  { id: "desktop-hd", label: "Desktop HD", w: 1280, h: 720 },
]

export const QUICK_PATHS = [
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

export const ZOOM_OPTIONS = [
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

/**
 * URL pagina studio (schermo intero) con query.
 * @param {object} opts
 * @param {string} opts.path
 * @param {number} opts.w
 * @param {number} opts.h
 * @param {number} opts.zoom
 * @param {boolean} [opts.rotate]
 */
export function buildViewportStudioUrl(opts) {
  const path = sanitizeSuperadminPreviewPath(opts.path)
  const w = Math.max(200, Math.min(2400, Math.round(Number(opts.w) || 390)))
  const h = Math.max(200, Math.min(2400, Math.round(Number(opts.h) || 844)))
  const zoom = Math.min(1, Math.max(0.35, Number(opts.zoom) || 0.75))
  const rotate = Boolean(opts.rotate)
  const origin = typeof window !== "undefined" ? window.location.origin : ""
  const p = new URLSearchParams()
  p.set("path", path)
  p.set("w", String(w))
  p.set("h", String(h))
  p.set("zoom", String(zoom))
  p.set("rotate", rotate ? "1" : "0")
  return `${origin}/superadmin/test-layout/studio?${p.toString()}`
}
