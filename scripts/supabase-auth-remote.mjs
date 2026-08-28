/**
 * Gestione remota Auth Supabase senza `config push` completo (evita di sovrascrivere site_url/SMTP).
 *
 *   node scripts/supabase-auth-remote.mjs status
 *   node scripts/supabase-auth-remote.mjs restore-production
 *   node scripts/supabase-auth-remote.mjs push-email-templates
 *   node scripts/supabase-auth-remote.mjs sync-redirects [--from-db]
 *
 * `sync-redirects --from-db` aggiunge i `public_domain` dei tenant alla allow-list Auth
 * e stampa no-reply/info/support (senza password SMTP). Non modifica l'SMTP Auth globale.
 *
 * Token: `supabase login` (Windows Credential Manager) oppure env SUPABASE_ACCESS_TOKEN.
 */
import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const projectRef = readFileSync(join(root, "supabase", ".temp", "project-ref"), "utf8").trim()
const API = `https://api.supabase.com/v1/projects/${projectRef}/config/auth`

const EMAIL_TEMPLATES = {
  confirmation: {
    subject: "Conferma il tuo account PizzaManager",
    file: "confirm_signup.html",
    subjectKey: "mailer_subjects_confirmation",
    contentKey: "mailer_templates_confirmation_content",
  },
  recovery: {
    subject: "Reimposta la password del tuo account",
    file: "reset_password.html",
    subjectKey: "mailer_subjects_recovery",
    contentKey: "mailer_templates_recovery_content",
  },
  magic_link: {
    subject: "Link di accesso rapido PizzaManager",
    file: "magic_link.html",
    subjectKey: "mailer_subjects_magic_link",
    contentKey: "mailer_templates_magic_link_content",
  },
  email_change: {
    subject: "Conferma cambio email account",
    file: "change_email.html",
    subjectKey: "mailer_subjects_email_change",
    contentKey: "mailer_templates_email_change_content",
  },
  invite: {
    subject: "Invito account PizzaManager",
    file: "invite.html",
    subjectKey: "mailer_subjects_invite",
    contentKey: "mailer_templates_invite_content",
  },
}

/** Redirect post-auth per vetrine tenant (*.pizzamanager.it) e piattaforma. */
const PRODUCTION_REDIRECT_URLS = [
  "https://pizzamanager.it",
  "https://www.pizzamanager.it",
  "https://pizzamanager.it/reimposta-password",
  "https://www.pizzamanager.it/reimposta-password",
  "https://pizzamanager.it/cliente/dashboard",
  "https://www.pizzamanager.it/cliente/dashboard",
  "https://francypizza.pizzamanager.it",
  "https://francypizza.pizzamanager.it/reimposta-password",
  "https://francypizza.pizzamanager.it/cliente/dashboard",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5173/reimposta-password",
  "http://127.0.0.1:5173/cliente/dashboard",
  "http://localhost:5173",
  "http://localhost:5173/reimposta-password",
  "http://localhost:5173/cliente/dashboard",
]

function getAccessToken() {
  if (process.env.SUPABASE_ACCESS_TOKEN?.trim()) {
    return process.env.SUPABASE_ACCESS_TOKEN.trim()
  }
  try {
    return execFileSync(
      "powershell",
      [
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        join(root, "scripts", "lib", "supabase-cli-token.ps1"),
      ],
      { encoding: "utf8" },
    ).trim()
  } catch {
    return null
  }
}

function readTemplate(file) {
  return readFileSync(join(root, "supabase", "templates", "auth", file), "utf8")
}

async function api(method, body) {
  const token = getAccessToken()
  if (!token) {
    console.error(
      "Token mancante. Esegui `npx supabase login` oppure imposta SUPABASE_ACCESS_TOKEN.",
    )
    process.exit(1)
  }
  const res = await fetch(API, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  if (!res.ok) {
    console.error(`${method} auth config failed:`, res.status, text)
    process.exit(1)
  }
  return text ? JSON.parse(text) : null
}

function hostToRedirectUrls(host) {
  const h = String(host || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
  if (!h || h.includes(" ")) return []
  const base = h.startsWith("http") ? h : `https://${h}`
  const origin = base.startsWith("https://") ? base : `https://${h}`
  return [
    origin,
    `${origin}/reimposta-password`,
    `${origin}/cliente/dashboard`,
  ]
}

function mergeRedirectUrls(...lists) {
  const seen = new Set()
  const out = []
  for (const list of lists) {
    for (const u of list) {
      const key = String(u || "").trim()
      if (!key || seen.has(key)) continue
      seen.add(key)
      out.push(key)
    }
  }
  return out
}

async function fetchTenantDomainsFromDb(token) {
  const url = `https://api.supabase.com/v1/projects/${projectRef}/database/query`
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query:
        "SELECT trim(public_domain) AS host, parametri_operativi->>'email_noreply' AS email_noreply, parametri_operativi->>'email_info' AS email_info, parametri_operativi->>'email_support' AS email_support, nullif(trim(parametri_operativi->>'smtp_host'), '') AS smtp_host FROM admin.tenants WHERE public_domain IS NOT NULL AND trim(public_domain) <> ''",
    }),
  })
  if (!res.ok) return []
  const rows = await res.json()
  if (!Array.isArray(rows)) return []
  return rows
}

function hostsFromTenantRows(rows) {
  return (rows || [])
    .map((r) => r.host || r.public_domain)
    .filter(Boolean)
}

function printTenantEmailSummary(rows) {
  if (!rows.length) return
  console.log("Profili email tenant (da DB, password SMTP non stampata):")
  for (const r of rows) {
    const host = r.host || r.public_domain || "?"
    console.log(
      `  ${host} | no-reply=${r.email_noreply || "—"} | info=${r.email_info || "—"} | support=${r.email_support || "—"} | smtp=${r.smtp_host ? "sì" : "no"}`,
    )
  }
}

function buildEmailTemplatePatch() {
  const patch = {}
  for (const t of Object.values(EMAIL_TEMPLATES)) {
    patch[t.subjectKey] = t.subject
    patch[t.contentKey] = readTemplate(t.file)
  }
  return patch
}

function printStatus(cfg) {
  console.log("Progetto:", projectRef)
  console.log("site_url:", cfg.site_url)
  console.log("uri_allow_list:", (cfg.uri_allow_list || "").split(",").filter(Boolean).length, "URL")
  console.log("mailer_autoconfirm (false = conferma email obbligatoria):", cfg.mailer_autoconfirm)
  console.log(
    "password change richiede re-login:",
    cfg.security_update_password_require_reauthentication,
  )
  console.log("mfa TOTP enroll/verify:", cfg.mfa_totp_enroll_enabled, cfg.mfa_totp_verify_enabled)
  console.log("oggetto conferma:", cfg.mailer_subjects_confirmation)
}

async function main() {
  const cmd = process.argv[2] || "status"
  if (cmd === "status") {
    printStatus(await api("GET"))
    return
  }
  if (cmd === "restore-production") {
    const patch = {
      site_url: "https://pizzamanager.it",
      uri_allow_list: PRODUCTION_REDIRECT_URLS.join(","),
      mailer_autoconfirm: false,
      security_update_password_require_reauthentication: true,
      mfa_totp_enroll_enabled: true,
      mfa_totp_verify_enabled: true,
    }
    await api("PATCH", patch)
    console.log("Impostazioni Auth produzione ripristinate.")
    printStatus(await api("GET"))
    return
  }
  if (cmd === "push-email-templates") {
    await api("PATCH", buildEmailTemplatePatch())
    console.log("Template email Auth (IT) applicati su", projectRef)
    return
  }
  if (cmd === "sync-redirects") {
    const fromDb = process.argv.includes("--from-db")
    const token = getAccessToken()
    let extra = []
    if (fromDb && token) {
      const rows = await fetchTenantDomainsFromDb(token)
      const hosts = hostsFromTenantRows(rows)
      extra = hosts.flatMap(hostToRedirectUrls)
      console.log("Domini tenant da DB:", hosts.length)
      printTenantEmailSummary(rows)
    }
    const uri_allow_list = mergeRedirectUrls(PRODUCTION_REDIRECT_URLS, extra).join(",")
    await api("PATCH", { uri_allow_list })
    console.log("Redirect URL aggiornati:", uri_allow_list.split(",").length)
    return
  }
  if (cmd === "apply-all") {
    const fromDb = process.argv.includes("--from-db")
    const token = getAccessToken()
    let extra = []
    if (fromDb && token) {
      const rows = await fetchTenantDomainsFromDb(token)
      extra = hostsFromTenantRows(rows).flatMap(hostToRedirectUrls)
      printTenantEmailSummary(rows)
    }
    await api("PATCH", {
      ...buildEmailTemplatePatch(),
      site_url: "https://pizzamanager.it",
      uri_allow_list: mergeRedirectUrls(PRODUCTION_REDIRECT_URLS, extra).join(","),
      mailer_autoconfirm: false,
      security_update_password_require_reauthentication: true,
      mfa_totp_enroll_enabled: true,
      mfa_totp_verify_enabled: true,
    })
    console.log("Produzione + template email applicati su", projectRef)
    printStatus(await api("GET"))
    return
  }
  console.error(`Comando sconosciuto: ${cmd}`)
  console.error(
    "Uso: status | restore-production | push-email-templates | sync-redirects [--from-db] | apply-all [--from-db]",
  )
  process.exit(1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
