/**
 * Diagnostica config Supabase lato browser (valori da Vite `import.meta.env` al build).
 */

/** @param {unknown} err */
export function isAuthFetchNetworkFailure(err) {
  const msg = String(err?.message ?? err ?? "").toLowerCase()
  return (
    err instanceof TypeError ||
    msg.includes("failed to fetch") ||
    msg.includes("networkerror") ||
    msg.includes("network request failed") ||
    msg.includes("load failed")
  )
}

/** Rimuove spazi e slash finali dall’API URL progetto Supabase (evita doppio path lato SDK). */
function stripTrailingSlashApiUrl(raw) {
  return String(raw ?? "")
    .trim()
    .replace(/\/+$/g, "")
}

/**
 * Su hosting HTTPS, `http://*.supabase.co` viene bloccato dal browser (mixed content) → "Failed to fetch".
 * Usa il parser URL così funziona con qualsiasi sottodominio `*.supabase.co`.
 */
export function resolveSupabaseUrlForRuntime(rawUrl) {
  let u = stripTrailingSlashApiUrl(rawUrl)
  if (!u) return u
  try {
    const parsed = new URL(u)
    if (
      import.meta.env.PROD &&
      typeof window !== "undefined" &&
      window.location?.protocol === "https:" &&
      parsed.hostname.endsWith(".supabase.co") &&
      parsed.protocol === "http:"
    ) {
      parsed.protocol = "https:"
      return stripTrailingSlashApiUrl(parsed.toString())
    }
  } catch {
    /* restituiamo stringa trimmed come fallback */
  }
  return u
}

/** Host usato nel bundle per messaggi sicuri (niente chiavi nel log). */
export function getSupabaseConfiguredHostname() {
  const raw = String(import.meta.env.VITE_SUPABASE_URL ?? "").trim()
  const u = resolveSupabaseUrlForRuntime(raw)
  if (!u) return ""
  try {
    return new URL(u).hostname
  } catch {
    return ""
  }
}

function isLocalDevSupabaseUrl(raw) {
  const u = stripTrailingSlashApiUrl(raw)
  if (!u) return false
  try {
    const h = new URL(u).hostname
    return (
      h === "localhost" ||
      h === "127.0.0.1" ||
      h === "[::1]" ||
      h.endsWith(".local")
    )
  } catch {
    return false
  }
}

export function isSupabaseBuildConfigured() {
  const rawUrl = String(import.meta.env.VITE_SUPABASE_URL ?? "").trim()
  const key = String(import.meta.env.VITE_SUPABASE_ANON_KEY ?? "").trim()
  const url = resolveSupabaseUrlForRuntime(rawUrl)
  if (!url || !key) return false
  try {
    const u = new URL(url)
    return u.protocol === "https:" || u.protocol === "http:"
  } catch {
    return false
  }
}

/** Messaggio per UI login quando la richiesta Auth non arriva al server. */
export function supabaseLoginNetworkHelpMessage() {
  const httpsPage =
    typeof window !== "undefined" && window.location?.protocol === "https:"
  const raw = String(import.meta.env.VITE_SUPABASE_URL ?? "").trim()
  const resolved = resolveSupabaseUrlForRuntime(raw)
  let looksHttpSupabase = false
  try {
    const p = new URL(resolved || raw)
    looksHttpSupabase =
      httpsPage && p.hostname.endsWith(".supabase.co") && p.protocol === "http:"
  } catch {
    looksHttpSupabase = /^http:\/\/[^/]*\.supabase\.co/i.test(raw)
  }
  const hostname = getSupabaseConfiguredHostname()

  const parts = [
    "Impossibile contattare Supabase Auth (rete bloccata o URL non valido nel bundle di produzione).",
    "Verifica il file .env.production (usato da vite build), non solo .env locale: VITE_SUPABASE_URL = https://<project-ref>.supabase.co senza slash finale; VITE_SUPABASE_ANON_KEY = chiave anon del progetto nella Dashboard Supabase.",
    "Dopo ogni modifica alle variabili VITE_*: npm run build e rideploy hosting.",
  ]
  if (import.meta.env.PROD && isLocalDevSupabaseUrl(raw)) {
    parts.push(
      "L’URL Supabase nel build di produzione punta a localhost/127.0.0.1: da un sito HTTPS non può funzionare. Imposta in .env.production l’URL del progetto ospitato su supabase.co.",
    )
  }
  if (looksHttpSupabase) {
    parts.push(
      "Mixed content: http:// verso *.supabase.co da pagina HTTPS viene bloccato; usa sempre https:// in .env.production.",
    )
  }
  if (hostname) {
    parts.push(
      `In DevTools → Rete filtra «token»: la POST deve andare verso «https://${hostname}/auth/v1/…». Se è «blocked» o «CORS», estensioni/antivirus/VPN sono spesso la causa.`,
    )
  }
  parts.push(
    "Controlla in dashboard Supabase che il progetto non sia in pausa e che eventuali blocchi tracker non taglino *.supabase.co.",
  )
  return parts.join(" ")
}
