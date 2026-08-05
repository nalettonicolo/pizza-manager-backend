import { PERMESSI_TUTTE_AREE } from "@/constants/testReparti"
import { isDemoGiroSearch } from "@/utils/demoGiro"
import { isQaSupportSearch } from "@/utils/viewportLayoutPreview"
import { isSuperAdminRole } from "@/utils/superAdminAccess"
import { SUPPORT_TENANT_QUERY } from "@/utils/supportTenantOverride"

/**
 * Super Admin in Demo live / Sala QA / support_tenant: accesso pieno alle aree operative
 * e alle potenzialità del sistema (senza i limiti del ruolo staff del tenant).
 */
export function isSaDemoOrSupportContext(ruolo, search) {
  if (!isSuperAdminRole(ruolo)) return false
  const raw = typeof search === "string" ? search : ""
  if (isDemoGiroSearch(raw) || isQaSupportSearch(raw)) return true
  try {
    const q = raw.startsWith("?") ? raw.slice(1) : raw
    return Boolean(new URLSearchParams(q).get(SUPPORT_TENANT_QUERY))
  } catch {
    return false
  }
}

/** Qualsiasi Super Admin (anche fuori demo) vede tutte le aree in layout operativo. */
export function resolveOperativePermessiAree(ruolo, permessiAree, search) {
  if (isSuperAdminRole(ruolo) || isSaDemoOrSupportContext(ruolo, search)) {
    return PERMESSI_TUTTE_AREE
  }
  return permessiAree && typeof permessiAree === "object" ? permessiAree : null
}

/**
 * Modifica parametri / stampanti / toggle cassa: SA in demo o support può sempre salvare.
 * @param {unknown} ruolo
 * @param {boolean} staffPuoModificare
 * @param {string} [search]
 */
export function canEditTenantParametriInOperative(ruolo, staffPuoModificare, search) {
  if (isSuperAdminRole(ruolo)) return true
  if (isSaDemoOrSupportContext(ruolo, search)) return true
  return Boolean(staffPuoModificare)
}

export function canAccessOperativeAreaKey(permessiEffective, areaKey) {
  if (!permessiEffective || !areaKey) return Boolean(permessiEffective)
  if (areaKey === "delivery") {
    return permessiEffective.delivery === true || permessiEffective.pony === true
  }
  return permessiEffective[areaKey] === true
}
