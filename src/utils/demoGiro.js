/**
 * Marker e helper per Demo live Super Admin (stesso account, dati tenant reali).
 * Avvio: hub «Aree di lavoro»; navigazione sidebar + «4 schermate» + Admin tenant.
 */
import { SUPPORT_TENANT_QUERY } from "@/utils/supportTenantOverride"

export const DEMO_GIRO_QUERY = "_demo_giro"
const DEMO_GIRO_SESSION_KEY = "pm_sa_demo_giro"

/** Sessione demo SA: sopravvive a navigate() che non propagano la query. */
export function setDemoGiroSessionActive(active) {
  try {
    if (active) sessionStorage.setItem(DEMO_GIRO_SESSION_KEY, "1")
    else sessionStorage.removeItem(DEMO_GIRO_SESSION_KEY)
  } catch {
    /* ignore */
  }
}

export function isDemoGiroSessionActive() {
  try {
    return sessionStorage.getItem(DEMO_GIRO_SESSION_KEY) === "1"
  } catch {
    return false
  }
}

export function clearDemoGiroSession() {
  setDemoGiroSessionActive(false)
}

/** Percorsi tipici usati nel giro demo (ordine navigazione / step index). */
export const DEMO_GIRO_STEPS = [
  { path: "/operative/cassa", label: "Cassa" },
  { path: "/operative/pizzaioli", label: "Pizzaioli" },
  { path: "/operative/cucina", label: "Cucina" },
  { path: "/operative/bancone", label: "Bancone" },
  { path: "/operative/delivery", label: "Delivery / Pony" },
]

/**
 * Voci extra in sidebar Demo live: strumenti + Admin del locale (tenant).
 * Elenco allineato alla barra admin: hub, moduli e Documenti/Guida.
 */
export const DEMO_GIRO_ADMIN_LINKS = [
  {
    path: "/preview",
    label: "Area cliente",
    description: "Menù e ordini come Cliente Test",
    group: "strumenti",
    demoClienteLogin: true,
  },
  {
    path: "/registrazione",
    label: "Registrazione cliente",
    description: "Form iscrizione sito (+ fidelity se attivo)",
    group: "strumenti",
  },
  {
    path: "/preview",
    label: "Vetrina online",
    description: "Menù pubblico come lo vede il cliente",
    group: "strumenti",
  },
  { path: "/admin/home", label: "Gestione locale", description: "Hub admin: menu, staff, impostazioni", group: "admin" },
  { path: "/admin/menu", label: "Menu", description: "Categorie, pizze, listini", group: "admin" },
  { path: "/admin/ordini", label: "Ordini", description: "Storico e gestione ordini", group: "admin" },
  { path: "/admin/report", label: "Report", description: "Incassi e analisi vendite", group: "admin" },
  { path: "/admin/magazzino", label: "Magazzino", description: "Fornitori, DDT e movimenti", group: "admin" },
  { path: "/admin/contabilita", label: "Contabilità", description: "Incassi, spese e food cost", group: "admin" },
  { path: "/admin/fidelity", label: "Fidelity", description: "Carte fedeltà clienti", group: "admin" },
  { path: "/admin/documenti", label: "Documenti", description: "Contratti, pagamenti e comunicazioni", group: "admin" },
  { path: "/admin/manuale", label: "Guida", description: "Manuale operativo del gestore", group: "admin" },
  { path: "/admin/settings", label: "Impostazioni", description: "Sede, orari, area consegna, parametri", group: "admin" },
  { path: "/admin/dipendenti", label: "Staff", description: "Dipendenti e accessi", group: "admin" },
  { path: "/admin/ruoli", label: "Ruoli", description: "Permessi per tipo di operatore", group: "admin" },
]

export function isDemoGiroSearch(search) {
  const raw = typeof search === "string" ? search : ""
  const q = raw.startsWith("?") ? raw.slice(1) : raw
  try {
    if (new URLSearchParams(q).get(DEMO_GIRO_QUERY) === "1") return true
  } catch {
    /* ignore */
  }
  return isDemoGiroSessionActive()
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
