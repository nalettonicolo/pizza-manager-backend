/**
 * Solo Test layout / studio: anteprima della pagina /login senza redirect automatico.
 * NON usare per Sala QA (support_tenant / _qa_console).
 */
export function isViewportLayoutPreviewSearch(search) {
  const raw = typeof search === "string" ? search : ""
  const q = raw.startsWith("?") ? raw.slice(1) : raw
  const p = new URLSearchParams(q)
  return p.has("_viewport_tester") || p.has("_studio")
}

/** Sala QA / supporto live Super Admin. */
export function isQaSupportSearch(search) {
  const raw = typeof search === "string" ? search : ""
  const q = raw.startsWith("?") ? raw.slice(1) : raw
  const p = new URLSearchParams(q)
  return p.has("_qa_console") || p.has("support_tenant")
}
