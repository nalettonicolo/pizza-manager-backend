import { OPERATIVE_AREA_NAV } from "@/constants/operativeNav";

/** @param {string} pathname */
export function findOperativeNavItemForPath(pathname) {
  const sorted = [...OPERATIVE_AREA_NAV].sort((a, b) => b.to.length - a.to.length);
  return sorted.find((item) => pathname === item.to || pathname.startsWith(`${item.to}/`)) ?? null;
}

/**
 * @param {string} pathname
 * @param {Record<string, boolean> | null | undefined} permessiAree
 * @param {(id: string) => boolean} hasServizio
 */
export function isOperativePathAllowed(pathname, permessiAree, hasServizio) {
  if (!permessiAree) return pathname === "/operative/dashboard" || pathname === "/operative" || pathname === "/operative/";
  const item = findOperativeNavItemForPath(pathname);
  if (!item) {
    return pathname === "/operative/dashboard" || pathname === "/operative" || pathname === "/operative/";
  }
  if (item.servizioId && !hasServizio(item.servizioId)) return false;
  if (item.areaKey === "delivery") {
    return permessiAree.delivery === true || permessiAree.pony === true;
  }
  return permessiAree[item.areaKey] === true;
}

/**
 * Card / voci riepilogo: stessa logica permessi della sidebar (delivery/pony accoppiati).
 * @param {string} areaKey
 * @param {Record<string, boolean> | null | undefined} permessiAree
 */
export function isOperativeAreaPermitted(areaKey, permessiAree) {
  if (!permessiAree) return true;
  if (areaKey === "delivery" || areaKey === "pony") {
    return permessiAree.delivery === true || permessiAree.pony === true;
  }
  return permessiAree[areaKey] === true;
}

/**
 * Prima voce del menu operativo per cui permessi e servizio risultano entrambi ok.
 * @param {Record<string, boolean> | null | undefined} permessiAree
 * @param {(id: string) => boolean} hasServizio
 * @returns {string | null}
 */
export function pickAnyAllowedOperativePath(permessiAree, hasServizio) {
  if (!permessiAree) return "/operative/dashboard";
  for (const item of OPERATIVE_AREA_NAV) {
    if (item.servizioId && !hasServizio(item.servizioId)) continue;
    if (item.areaKey === "delivery") {
      if (permessiAree.delivery === true || permessiAree.pony === true) return item.to;
      continue;
    }
    if (permessiAree[item.areaKey] === true) return item.to;
  }
  return null;
}

/**
 * Primo path utilizzabile tra candidati (sidebar vuota, home ruolo disabilitata, ecc.).
 * @param {{ to: string, servizioId?: string | null, areaKey: string }[]} navItems già filtrati permessi+servizi
 * @param {string} rolePreferredPath es. da OPERATIVE_ROLE_HOME
 * @param {Record<string, boolean>} permessiAree
 * @param {(id: string) => boolean} hasServizio
 * @returns {string | null}
 */
export function resolveFirstOperativePath(navItems, rolePreferredPath, permessiAree, hasServizio) {
  if (navItems?.length) return navItems[0].to;
  const candidates = [rolePreferredPath, "/operative/dashboard"].filter(
    (p) => typeof p === "string" && p.startsWith("/operative"),
  );
  for (const p of candidates) {
    if (isOperativePathAllowed(p, permessiAree, hasServizio)) return p;
  }
  return pickAnyAllowedOperativePath(permessiAree, hasServizio);
}
