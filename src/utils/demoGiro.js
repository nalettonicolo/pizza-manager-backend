import { SUPPORT_TENANT_QUERY } from "@/utils/supportTenantOverride"

/**
 * Marker e helper per Demo live Super Admin (stesso account, dati tenant reali).
 * Navigazione: sidebar operativa + «4 schermate» (niente overlay).
 */
export const DEMO_GIRO_QUERY = "_demo_giro"

/** Percorsi tipici usati all’avvio demo (prima schermata = Cassa). */
export const DEMO_GIRO_STEPS = [
  { path: "/operative/cassa", label: "Cassa" },
  { path: "/operative/pizzaioli", label: "Pizzaioli" },
  { path: "/operative/cucina", label: "Cucina" },
  { path: "/operative/bancone", label: "Bancone" },
  { path: "/operative/delivery", label: "Delivery / Pony" },
]

/** Voci extra in sidebar Demo live (oltre ai reparti): potenzialità admin sul tenant. */
export const DEMO_GIRO_ADMIN_LINKS = [
  { path: "/cliente/dashboard", label: "Area cliente", group: "strumenti" },
  { path: "/admin/home", label: "Admin locale", group: "admin" },
  { path: "/admin/menu", label: "Menu (admin)", group: "admin" },
  { path: "/admin/settings/parametri", label: "Parametri", group: "admin" },
]

export function isDemoGiroSearch(search) {
  const raw = typeof search === "string" ? search : ""
  const q = raw.startsWith("?") ? raw.slice(1) : raw
  try {
    return new URLSearchParams(q).get(DEMO_GIRO_QUERY) === "1"
  } catch {
    return false
  }
}

/**
 * @param {string} path
 * @param {string} tenantId
 * @param {{ stepIndex?: number }} [opts]
 */
export function withDemoGiroQuery(path, tenantId, opts = {}) {
  const base = String(path || "/").trim() || "/"
  const id = String(tenantId || "").trim()
  let url
  try {
    url = new URL(base, "https://pizzamanager.local")
  } catch {
    return base
  }
  if (id) url.searchParams.set(SUPPORT_TENANT_QUERY, id)
  url.searchParams.set("_qa_console", "1")
  url.searchParams.set(DEMO_GIRO_QUERY, "1")
  if (Number.isFinite(opts.stepIndex)) {
    url.searchParams.set("_demo_step", String(opts.stepIndex))
  }
  const returnPath = url.pathname
  if (returnPath && returnPath !== "/login") {
    url.searchParams.set("return_to", returnPath)
  }
  return `${url.pathname}${url.search}`
}

/**
 * @param {string} [search]
 * @returns {number}
 */
export function readDemoGiroStepIndex(search) {
  const raw = typeof search === "string" ? search : ""
  const q = raw.startsWith("?") ? raw.slice(1) : raw
  try {
    const n = Number(new URLSearchParams(q).get("_demo_step"))
    if (Number.isFinite(n) && n >= 0 && n < DEMO_GIRO_STEPS.length) return n
  } catch {
    /* ignore */
  }
  return 0
}

/**
 * Indice step dalla path corrente (fallback se manca _demo_step).
 * @param {string} pathname
 */
export function findDemoGiroStepIndexByPath(pathname) {
  const p = String(pathname || "")
  const exact = DEMO_GIRO_STEPS.findIndex((s) => s.path === p)
  if (exact >= 0) return exact
  const prefix = DEMO_GIRO_STEPS.findIndex(
    (s) => s.path !== "/" && (p === s.path || p.startsWith(`${s.path}/`)),
  )
  return prefix >= 0 ? prefix : 0
}
