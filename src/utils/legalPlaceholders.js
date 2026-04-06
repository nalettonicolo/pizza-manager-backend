/**
 * Sostituisce segnaposto {{chiave}} in testi/HTML policy con dati tenant.
 * Chiavi: nome_attivita, ragione_sociale, indirizzo, email, telefono, piva, pec, host
 */
export function applyLegalPlaceholders(template, tenant, hostLabel) {
  if (template == null || typeof template !== "string") return ""
  const t = tenant && typeof tenant === "object" ? tenant : {}
  const host =
    hostLabel ||
    (typeof window !== "undefined" ? window.location.hostname : "") ||
    ""
  const map = {
    "{{nome_attivita}}": String(t.nome || "").trim(),
    "{{ragione_sociale}}": String(t.legal_ragione_sociale || t.nome || "").trim(),
    "{{indirizzo}}": String(t.indirizzo || "").trim(),
    "{{email}}": String(t.email || "").trim(),
    "{{telefono}}": String(t.telefono || "").trim(),
    "{{piva}}": String(t.legal_piva || "").trim(),
    "{{pec}}": String(t.legal_pec || "").trim(),
    "{{host}}": host,
    "{{anno}}": String(new Date().getFullYear()),
  }
  let out = template
  for (const [k, v] of Object.entries(map)) {
    out = out.split(k).join(v)
  }
  return out
}
