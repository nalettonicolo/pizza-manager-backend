/**
 * Query aggiunta dagli iframe del tool superadmin «Test layout» (pagina + studio).
 * Usata solo lato client: consente anteprima layout senza reindirizzamenti da ruolo errato.
 */
export function isViewportLayoutPreviewSearch(search) {
  const raw = typeof search === "string" ? search : ""
  const q = raw.startsWith("?") ? raw.slice(1) : raw
  const p = new URLSearchParams(q)
  return p.has("_viewport_tester") || p.has("_studio")
}
