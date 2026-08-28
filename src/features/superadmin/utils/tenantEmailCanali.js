/** Chiavi SMTP / mittenti nel JSON `parametri_operativi` (mai esposte in vetrina pubblica). */

export const TENANT_EMAIL_PARAM_KEYS = {
  noreply: "email_noreply",
  info: "email_info",
  support: "email_support",
  smtpHost: "smtp_host",
  smtpPort: "smtp_port",
  smtpUser: "smtp_user",
  smtpPass: "smtp_pass",
}

/** SMTP caselle Register.it (posta in uscita autenticata). */
export const REGISTER_IT_SMTP = {
  host: "authsmtp.securemail.pro",
  port: 465,
}

/**
 * Hostname pulito da public_domain / URL (senza schema e path).
 * @param {unknown} raw
 */
export function normalizeEmailDomainHost(raw) {
  let h = String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//i, "")
    .replace(/\/.*$/, "")
  if (h.startsWith("www.")) h = h.slice(4)
  if (!h || h.includes(" ") || h.includes("@")) return ""
  return h
}

/**
 * Dominio da usare per suggerire no-reply@ / info@ / support@.
 * Priorità: dominio personalizzato del locale, poi sottodominio piattaforma.
 */
export function emailDomainForTenantForm({ public_domain, slug } = {}) {
  const custom = normalizeEmailDomainHost(public_domain)
  if (custom) return custom
  const s = String(slug || "").trim()
  if (s) return `${s}.pizzamanager.it`
  return ""
}

/**
 * @param {string} host
 * @returns {{ email_noreply: string, email_info: string, email_support: string }}
 */
export function suggestedMailboxAddresses(host) {
  const h = normalizeEmailDomainHost(host)
  if (!h) {
    return { email_noreply: "", email_info: "", email_support: "" }
  }
  return {
    email_noreply: `no-reply@${h}`,
    email_info: `info@${h}`,
    email_support: `support@${h}`,
  }
}

function trimOrEmpty(v) {
  return String(v ?? "").trim()
}

/**
 * Unisce i campi del form Superadmin in `parametri_operativi`.
 * Se la password SMTP è vuota in modifica, conserva quella già salvata.
 * @param {Record<string, unknown>} basePo
 * @param {Record<string, unknown>} fields
 */
export function mergeTenantEmailCanaliIntoParametri(basePo, fields) {
  const next = { ...(basePo && typeof basePo === "object" ? basePo : {}) }
  const noreply = trimOrEmpty(fields.email_noreply)
  const info = trimOrEmpty(fields.email_info)
  const support = trimOrEmpty(fields.email_support)
  const host = trimOrEmpty(fields.smtp_host)
  const user = trimOrEmpty(fields.smtp_user)
  const pass = fields.smtp_pass == null ? "" : String(fields.smtp_pass)
  const portRaw = trimOrEmpty(fields.smtp_port)
  const portNum = portRaw === "" ? NaN : Number(portRaw)

  if (noreply) next.email_noreply = noreply
  else delete next.email_noreply
  if (info) next.email_info = info
  else delete next.email_info
  if (support) next.email_support = support
  else delete next.email_support

  if (host) next.smtp_host = host
  else delete next.smtp_host

  if (Number.isFinite(portNum) && portNum > 0) next.smtp_port = Math.round(portNum)
  else delete next.smtp_port

  if (user) next.smtp_user = user
  else delete next.smtp_user

  if (pass.trim()) next.smtp_pass = pass
  else if (!host && !user) delete next.smtp_pass
  // password vuota + host ancora presente: lascia smtp_pass precedente

  return next
}

/**
 * Campi form da una riga tenant / parametri_operativi.
 * @param {Record<string, unknown>} po
 */
export function tenantEmailCanaliFromParametri(po) {
  const p = po && typeof po === "object" ? po : {}
  return {
    email_noreply: trimOrEmpty(p.email_noreply),
    email_info: trimOrEmpty(p.email_info),
    email_support: trimOrEmpty(p.email_support),
    smtp_host: trimOrEmpty(p.smtp_host),
    smtp_port: p.smtp_port != null && String(p.smtp_port).trim() !== "" ? String(p.smtp_port) : "",
    smtp_user: trimOrEmpty(p.smtp_user),
    smtp_pass: "",
    smtp_pass_impostata: Boolean(trimOrEmpty(p.smtp_pass)),
  }
}
