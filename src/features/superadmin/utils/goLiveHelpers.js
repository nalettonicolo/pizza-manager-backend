/**
 * URL Auth da aggiungere in Supabase Dashboard → Authentication → URL configuration.
 * Site URL resta tipicamente https://pizzamanager.it
 */
export function buildAuthRedirectUrlsForHostname(hostname) {
  const h = String(hostname || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/+$/, "")
  if (!h) return []
  const base = `https://${h}`
  return [
    `${base}/**`,
    `${base}/login`,
    `${base}/reimposta-password`,
    `${base}/password-dimenticata`,
    `${base}/registrazione`,
    `${base}/cliente/**`,
    `${base}/ordina`,
  ]
}

export const GO_LIVE_CHECK_ITEMS = [
  { id: "anagrafica", label: "A · Anagrafica e slug verificati" },
  { id: "firebase_host", label: "B · Hostname aggiunto in Firebase Hosting" },
  { id: "dns", label: "B · DNS CNAME configurato e propagato" },
  { id: "auth_redirects", label: "C · Redirect Auth Supabase aggiornati" },
  { id: "menu", label: "Menu / vetrina verificati sul dominio" },
  { id: "legali", label: "Privacy / Cookie / Termini ok" },
  { id: "smoke_test", label: "Smoke test login e ordine (se attivo)" },
]

export function emptyGoLiveChecks() {
  const out = {}
  for (const item of GO_LIVE_CHECK_ITEMS) out[item.id] = false
  return out
}

export function mergeGoLiveChecks(row) {
  const base = emptyGoLiveChecks()
  if (!row || typeof row !== "object") return base
  for (const item of GO_LIVE_CHECK_ITEMS) {
    base[item.id] = row[item.id] === true
  }
  return base
}
