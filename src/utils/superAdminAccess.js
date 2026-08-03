/** Ruolo normalizzato (lowercase trim). */
export function normalizeAppRuolo(ruolo) {
  return ruolo && typeof ruolo === "string" ? ruolo.toLowerCase().trim() : ""
}

/** Super Admin piattaforma: accesso a tutte le aree (operative, admin tenant, area cliente). */
export function isSuperAdminRole(ruolo) {
  const r = normalizeAppRuolo(ruolo)
  return r === "superadmin" || r === "super_admin"
}
