/**
 * Migrazione progresso checklist mese (localStorage).
 * v1 usava id slug (demo-cliente-session); v2 usa codici (DM-02).
 * Non cancellare mai le chiavi legacy: solo merge in v2.
 */

export const CHECKLIST_STORAGE_V2 = "pm_superadmin_checklist_modifiche_mese_v2_codici"
export const CHECKLIST_STORAGE_V1 = "pm_superadmin_checklist_modifiche_mese_2026_08"

/** id v1 → codice v2 (stesso significato prodotto). */
export const CHECKLIST_LEGACY_ID_TO_CODICE = Object.freeze({
  "demo-giro-sa": "DM-01",
  "demo-cliente-session": "DM-02",
  "demo-auth-bootstrap-veloce": "DM-03",
  "cliente-redirect-vetrina": "CL-01",
  "cliente-registrazione-fidelity": "CL-02",
  "cliente-ordine-recall": "CL-03",
  "cliente-vetrina-layout-loggato": "CL-04",
  "cliente-profilo-menu-wide": "CL-05",
  "cliente-maps-indirizzo": "CL-06",
  "web-accettazione-auto-manuale": "OW-01",
  "web-solo-consegna": "OW-02",
  "pagamenti-stripe-sumup-multi": "OW-03",
  "open-pony-capacity-auto": "OW-04",
  "cassa-planning-pony-board": "CA-01",
  "cassa-planning-conteggio-solo-pizze": "CA-02",
  "cassa-planning-simbolo-operative": "CA-03",
  "cassa-stampa-operativa": "CA-04",
  "admin-parametri-ordini-web-ui": "AD-01",
  "admin-public-tenant-rpc-39-40": "AD-02",
  "ux-login-testi-puliti": "UX-01",
  "ux-no-registrazione-demo-header": "UX-02",
  "sql-44-fidelity": "DB-01",
  "sql-45-46-accettazione": "DB-02",
  "sql-25-capacity": "DB-03",
  "sql-29-38-hardening-batch": "DB-04",
  "infra-fase6-nest": "IN-01",
  "infra-ci-keepalive": "IN-02",
  "open-audit-npm-nest": "IN-03",
  "sec-presence-tenant": "SE-01",
  "sec-revoke-anon-rpc": "SE-02",
})

function parseJson(raw) {
  if (!raw) return null
  try {
    const v = JSON.parse(raw)
    return v && typeof v === "object" && !Array.isArray(v) ? v : null
  } catch {
    return null
  }
}

function mergeEntry(a, b) {
  if (!a) return b ? { ...b } : undefined
  if (!b) return { ...a }
  const noteA = String(a.note || "").trim()
  const noteB = String(b.note || "").trim()
  let note = noteA
  if (noteB && noteB !== noteA) {
    note = noteA ? `${noteA}\n---\n${noteB}` : noteB
  }
  const tA = a.updatedAt ? Date.parse(a.updatedAt) : 0
  const tB = b.updatedAt ? Date.parse(b.updatedAt) : 0
  return {
    ...a,
    ...b,
    done: Boolean(a.done) || Boolean(b.done),
    note,
    updatedAt: new Date(Math.max(tA || 0, tB || 0, Date.now())).toISOString(),
  }
}

/**
 * Unisce v1→v2 e eventuali altre chiavi legacy. Scrive v2 se ha arricchito.
 * @returns {Record<string, { done?: boolean, note?: string, updatedAt?: string }>}
 */
export function loadAndMigrateChecklistProgress() {
  if (typeof localStorage === "undefined") return {}

  let v2 = parseJson(localStorage.getItem(CHECKLIST_STORAGE_V2)) || {}
  const v1 = parseJson(localStorage.getItem(CHECKLIST_STORAGE_V1))
  let changed = false

  if (v1) {
    for (const [key, entry] of Object.entries(v1)) {
      if (!entry || typeof entry !== "object") continue
      const codice =
        CHECKLIST_LEGACY_ID_TO_CODICE[key] ||
        (/^[A-Z]{2}-\d+$/i.test(key) ? String(key).toUpperCase() : null)
      if (!codice) continue
      const merged = mergeEntry(v2[codice], entry)
      if (JSON.stringify(merged) !== JSON.stringify(v2[codice] || null)) {
        v2[codice] = merged
        changed = true
      }
    }
  }

  // Se in v2 ci sono ancora chiavi slug, normalizzale
  for (const [key, entry] of Object.entries({ ...v2 })) {
    const mapped = CHECKLIST_LEGACY_ID_TO_CODICE[key]
    if (!mapped || mapped === key) continue
    v2[mapped] = mergeEntry(v2[mapped], entry)
    delete v2[key]
    changed = true
  }

  if (changed) {
    try {
      localStorage.setItem(CHECKLIST_STORAGE_V2, JSON.stringify(v2))
    } catch {
      /* ignore */
    }
  }

  return v2
}
