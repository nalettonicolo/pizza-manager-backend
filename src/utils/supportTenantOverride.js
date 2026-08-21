const STORAGE_KEY = "pm_sa_support_tenant"

/** Query usata dagli iframe Sala QA / supporto live. */
export const SUPPORT_TENANT_QUERY = "support_tenant"

/**
 * @param {string} [search] location.search
 * @returns {string} uuid o ""
 */
export function readSupportTenantFromSearch(search) {
  const raw = typeof search === "string" ? search : ""
  const q = raw.startsWith("?") ? raw.slice(1) : raw
  try {
    const p = new URLSearchParams(q)
    return String(p.get(SUPPORT_TENANT_QUERY) || p.get("tenant") || "").trim()
  } catch {
    return ""
  }
}

export function readSupportTenantFromStorage() {
  try {
    return String(localStorage.getItem(STORAGE_KEY) || "").trim()
  } catch {
    return ""
  }
}

/** Imposta override tenant per Super Admin (localStorage + opzionale sync URL). */
export function setSupportTenantOverride(tenantId) {
  const id = String(tenantId || "").trim()
  try {
    if (id) localStorage.setItem(STORAGE_KEY, id)
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* ignore */
  }
  return id
}

export function clearSupportTenantOverride() {
  setSupportTenantOverride("")
}

/**
 * Legge override effettivo: URL iframe ha priorità, poi storage.
 * @param {string} [search]
 */
export function resolveSupportTenantOverride(search) {
  const fromUrl = readSupportTenantFromSearch(search)
  if (fromUrl) return fromUrl
  return readSupportTenantFromStorage()
}

/** True se stiamo in modalità anteprima/supporto layout (iframe QA). */
export function isSupportOrViewportPreviewSearch(search) {
  const raw = typeof search === "string" ? search : ""
  const q = raw.startsWith("?") ? raw.slice(1) : raw
  const p = new URLSearchParams(q)
  return (
    p.has("_viewport_tester") ||
    p.has("_studio") ||
    p.has("_qa_console") ||
    p.has(SUPPORT_TENANT_QUERY) ||
    p.has("_demo_giro")
  )
}

/**
 * Aggiunge support_tenant + marker QA a un path interno.
 * `return_to` resta nell’URL anche dopo redirect a /login (state React non basta negli iframe).
 * @param {string} path
 * @param {string} tenantId
 */
export function withSupportTenantQuery(path, tenantId) {
  const base = String(path || "/").trim() || "/"
  const id = String(tenantId || "").trim()
  let url
  try {
    url = new URL(base, "https://pizzamanager.local")
  } catch {
    return base
  }
  if (id) url.searchParams.set(SUPPORT_TENANT_QUERY, id)
  // Solo marker QA: NON aggiungere _viewport_tester (blocca il redirect su /login).
  url.searchParams.set("_qa_console", "1")
  const returnPath = `${url.pathname}`
  if (returnPath && returnPath !== "/login") {
    url.searchParams.set("return_to", returnPath)
  }
  return `${url.pathname}${url.search}`
}

/** Destinazione sicura da query return_to (solo path relativo). */
export function readSafeReturnTo(search) {
  const raw = typeof search === "string" ? search : ""
  const q = raw.startsWith("?") ? raw.slice(1) : raw
  let value = ""
  try {
    value = String(new URLSearchParams(q).get("return_to") || "").trim()
  } catch {
    return ""
  }
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("://")) return ""
  if (value.startsWith("/login")) return ""
  return value.split("?")[0] || ""
}

/**
 * Conserva marker Sala QA / demo giro (`support_tenant`, `_qa_console`, `_demo_giro`, …) nei NavLink.
 * Se la demo è attiva in sessione, re-inietta i marker anche dopo navigate() senza query.
 * @param {string} to
 * @param {string} [search] location.search
 */
export function withPreservedSupportSearch(to, search) {
  const base = String(to || "/").trim() || "/"
  if (base.includes("?")) return base

  const raw = typeof search === "string" ? search : ""
  const q = raw.startsWith("?") ? raw.slice(1) : raw
  let src
  try {
    src = new URLSearchParams(q)
  } catch {
    src = new URLSearchParams()
  }

  const demoFromUrl = src.get("_demo_giro") === "1"
  let demoActive = demoFromUrl
  try {
    demoActive = demoActive || sessionStorage.getItem("pm_sa_demo_giro") === "1"
  } catch {
    /* ignore */
  }

  const supportFromUrl = isSupportOrViewportPreviewSearch(search)
  const tenantId = resolveSupportTenantOverride(search)
  if (!demoActive && !supportFromUrl && !tenantId) return base

  const dst = new URLSearchParams()
  for (const key of ["support_tenant", "tenant", "_qa_console", "_demo_giro", "_demo_cliente", "_demo_step", "return_to"]) {
    if (src.has(key)) dst.set(key, src.get(key))
  }
  if (!dst.has("support_tenant") && tenantId) dst.set(SUPPORT_TENANT_QUERY, tenantId)
  if (!dst.has("_qa_console") && (demoActive || tenantId)) dst.set("_qa_console", "1")
  if (!dst.has("_demo_giro") && demoActive) dst.set("_demo_giro", "1")
  try {
    if (!dst.has("_demo_cliente") && sessionStorage.getItem("pm_demo_cliente_active") === "1") {
      dst.set("_demo_cliente", "1")
    }
  } catch {
    /* ignore */
  }

  const s = dst.toString()
  return s ? `${base}?${s}` : base
}
