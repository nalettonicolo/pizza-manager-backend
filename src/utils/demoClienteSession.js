/**
 * Sessione «Cliente Test» per Demo live Super Admin.
 * Conserva la sessione SA in sessionStorage e fa login cliente; consente il ripristino.
 */
import { supabase } from "@/lib/supabaseClient"
import { withDemoGiroQuery } from "@/utils/demoGiro"
import { resolveSupportTenantOverride } from "@/utils/supportTenantOverride"

export const DEMO_CLIENTE_STASH_KEY = "pm_sa_session_before_demo_cliente"
export const DEMO_CLIENTE_FLAG_KEY = "pm_demo_cliente_active"
/** Query dedicata Area cliente demo (non confondere con `_demo_giro` del tour SA). */
export const DEMO_CLIENTE_QUERY = "_demo_cliente"

export function getDemoClienteCredentials() {
  const email = String(import.meta.env.VITE_DEMO_CLIENTE_EMAIL || "info@pizzamanager.it").trim()
  const password = String(import.meta.env.VITE_DEMO_CLIENTE_PASSWORD || "DemoCliente!2026").trim()
  return { email, password }
}

export function isDemoClienteSessionActive() {
  try {
    if (sessionStorage.getItem(DEMO_CLIENTE_FLAG_KEY) === "1") {
      // Flag senza stash = login cliente “vero” o sessione rotta: non trattare come demo.
      return hasDemoSaStash()
    }
  } catch {
    /* ignore */
  }
  if (typeof window === "undefined") return false
  try {
    if (new URLSearchParams(window.location.search).get(DEMO_CLIENTE_QUERY) === "1") {
      return hasDemoSaStash()
    }
  } catch {
    /* ignore */
  }
  return false
}

/** True se esiste uno stash SA utilizzabile per tornare dal Cliente Test. */
export function hasDemoSaStash() {
  try {
    const raw = sessionStorage.getItem(DEMO_CLIENTE_STASH_KEY)
    if (!raw) return false
    const tokens = JSON.parse(raw)
    return Boolean(tokens?.access_token && tokens?.refresh_token)
  } catch {
    return false
  }
}

/**
 * Token sessione da localStorage Supabase (sincrono, senza getSession / navigator.locks).
 * @returns {{ access_token: string, refresh_token: string } | null}
 */
export function readCachedSupabaseSessionTokens() {
  if (typeof window === "undefined") return null
  try {
    const storage = window.localStorage
    for (let i = 0; i < storage.length; i += 1) {
      const key = storage.key(i)
      if (!key || !key.includes("auth-token")) continue
      const raw = storage.getItem(key)
      if (!raw) continue
      const parsed = JSON.parse(raw)
      const session = parsed?.currentSession ?? parsed?.session ?? parsed
      const access = session?.access_token
      const refresh = session?.refresh_token
      if (access && refresh) return { access_token: access, refresh_token: refresh }
    }
  } catch {
    /* ignore */
  }
  return null
}

/** User da localStorage Supabase (sincrono, senza getSession / lock). */
export function readCachedSupabaseUser() {
  if (typeof window === "undefined") return null
  try {
    const storage = window.localStorage
    for (let i = 0; i < storage.length; i += 1) {
      const key = storage.key(i)
      if (!key || !key.includes("auth-token")) continue
      const raw = storage.getItem(key)
      if (!raw) continue
      const parsed = JSON.parse(raw)
      const user = parsed?.user ?? parsed?.currentSession?.user ?? parsed?.session?.user
      if (user?.id) return user
    }
  } catch {
    /* ignore */
  }
  return null
}

export function resolveDemoClienteTenantIdFromEnv() {
  if (typeof window !== "undefined") {
    const fromUrl = resolveSupportTenantOverride(window.location.search)
    if (fromUrl) return fromUrl
  }
  const envId = String(import.meta.env.VITE_PUBLIC_DEMO_TENANT_ID || "").trim()
  return envId || null
}

/**
 * Stato iniziale Auth per Area cliente demo: niente attesa getSession.
 * @returns {{ user: object|null, tenantId: string|null, ready: boolean } | null}
 */
export function getDemoClienteAuthBootstrap() {
  if (typeof window === "undefined") return null
  if (!isDemoClienteSessionActive()) return null
  try {
    sessionStorage.setItem(DEMO_CLIENTE_FLAG_KEY, "1")
  } catch {
    /* ignore */
  }
  const user = readCachedSupabaseUser()
  const tenantId = resolveDemoClienteTenantIdFromEnv()
  return { user, tenantId, ready: Boolean(user?.id) }
}

/**
 * @returns {Promise<{ access_token: string, refresh_token: string } | null>}
 */
async function readCurrentSessionTokens() {
  const cached = readCachedSupabaseSessionTokens()
  if (cached) return cached
  try {
    const { data } = await Promise.race([
      supabase.auth.getSession(),
      new Promise((_, reject) => setTimeout(() => reject(new Error("getSession timeout")), 2500)),
    ])
    const s = data?.session
    if (!s?.access_token || !s?.refresh_token) return null
    return { access_token: s.access_token, refresh_token: s.refresh_token }
  } catch {
    return readCachedSupabaseSessionTokens()
  }
}

/**
 * Salva token SA. Non salta se il flag cliente è già attivo: altrimenti non si può tornare.
 * @returns {Promise<boolean>}
 */
async function stashCurrentSessionIfNeeded() {
  try {
    if (hasDemoSaStash()) return true
    const tokens = await readCurrentSessionTokens()
    if (!tokens) return false
    const user = readCachedSupabaseUser()
    const demoEmail = getDemoClienteCredentials().email.toLowerCase()
    // Non stashare la sessione del Cliente Test stesso.
    if (user?.email && String(user.email).toLowerCase() === demoEmail) return false
    sessionStorage.setItem(DEMO_CLIENTE_STASH_KEY, JSON.stringify(tokens))
    return hasDemoSaStash()
  } catch {
    return false
  }
}

/**
 * Login come Cliente Test (dopo aver salvato la sessione SA).
 * @returns {Promise<{ ok: true } | { ok: false, error: string }>}
 */
export async function enterDemoClienteSession() {
  const { email, password } = getDemoClienteCredentials()
  if (!email || !password) {
    return { ok: false, error: "Credenziali demo cliente mancanti (VITE_DEMO_CLIENTE_*)." }
  }
  const stashed = await stashCurrentSessionIfNeeded()
  if (!stashed) {
    return {
      ok: false,
      error:
        "Non riesco a salvare la sessione Super Admin prima di entrare come Cliente Test. Torna all’ingresso SA e riprova «Entra come Cliente Test» / Area cliente dalla demo.",
    }
  }
  // Flag prima del sign-in: ProtectedRoute può redirigere verso area cliente invece che /login.
  try {
    sessionStorage.setItem(DEMO_CLIENTE_FLAG_KEY, "1")
  } catch {
    /* ignore */
  }
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) {
    try {
      sessionStorage.removeItem(DEMO_CLIENTE_FLAG_KEY)
      sessionStorage.removeItem(DEMO_CLIENTE_STASH_KEY)
    } catch {
      /* ignore */
    }
    return {
      ok: false,
      error:
        error.message ||
        "Login Cliente Test non riuscito. Esegui: node scripts/ensure-demo-cliente.mjs",
    }
  }
  return { ok: true }
}

/**
 * Entra in area cliente demo: login Cliente Test + navigazione hard (evita ProtectedRoute staff → /login).
 * @param {string} tenantId
 * @param {string} [path]
 * @returns {Promise<{ ok: true } | { ok: false, error: string }>}
 */
export async function openDemoClienteArea(tenantId, path = "/preview") {
  const login = await enterDemoClienteSession()
  if (!login.ok) return login
  let target = withDemoGiroQuery(path, tenantId)
  try {
    const url = new URL(target, window.location.origin)
    url.searchParams.set(DEMO_CLIENTE_QUERY, "1")
    target = `${url.pathname}${url.search}`
  } catch {
    /* keep withDemoGiroQuery result */
  }
  // Hard navigation: esce dal tree ProtectedRoute operativo/admin prima del re-render «non staff».
  if (typeof window !== "undefined") {
    window.location.assign(target)
  }
  return { ok: true }
}

/**
 * Ripristina la sessione Super Admin stashed.
 * @returns {Promise<{ ok: true } | { ok: false, error: string }>}
 */
export async function restoreDemoSaSession() {
  let raw = null
  try {
    raw = sessionStorage.getItem(DEMO_CLIENTE_STASH_KEY)
  } catch {
    /* ignore */
  }
  if (!raw) {
    return {
      ok: false,
      error:
        "Sessione Super Admin non trovata. Esci dall’area cliente, accedi di nuovo come Super Admin e apri Area cliente dalla demo (così il ritorno resta disponibile).",
    }
  }
  let tokens
  try {
    tokens = JSON.parse(raw)
  } catch {
    return { ok: false, error: "Sessione Super Admin corrotta." }
  }
  if (!tokens?.access_token || !tokens?.refresh_token) {
    return { ok: false, error: "Token Super Admin incompleti." }
  }
  const { error } = await supabase.auth.setSession({
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
  })
  if (error) {
    return { ok: false, error: error.message || "Ripristino Super Admin non riuscito." }
  }
  return { ok: true }
}

/**
 * Dopo setSession SA: pulisce stash/flag cliente e attiva di nuovo il giro demo.
 */
export function finalizeDemoSaRestore() {
  try {
    sessionStorage.removeItem(DEMO_CLIENTE_STASH_KEY)
    sessionStorage.removeItem(DEMO_CLIENTE_FLAG_KEY)
  } catch {
    /* ignore */
  }
}

export function clearDemoClienteSessionFlags() {
  try {
    sessionStorage.removeItem(DEMO_CLIENTE_STASH_KEY)
    sessionStorage.removeItem(DEMO_CLIENTE_FLAG_KEY)
  } catch {
    /* ignore */
  }
}

/** Pulisce URL da marker demo/QA lasciati da un giro SA precedente. */
export function stripDemoMarkersFromSearch(search) {
  try {
    const qs = new URLSearchParams(String(search || "").startsWith("?") ? String(search).slice(1) : search || "")
    qs.delete(DEMO_CLIENTE_QUERY)
    qs.delete("_demo_giro")
    qs.delete("_demo_step")
    qs.delete("_qa_console")
    qs.delete("return_to")
    const s = qs.toString()
    return s ? `?${s}` : ""
  } catch {
    return ""
  }
}
