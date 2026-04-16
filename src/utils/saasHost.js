/**
 * Hostname che montano il bundle completo (Landing, login, superadmin, /preview, admin…),
 * non la sola vetrina cliente su dominio dedicato.
 *
 * Include Firebase Hosting del progetto predefinito (vedi `.firebaserc`) e opzionalmente
 * `VITE_FULL_APP_HOSTNAMES` (hostname separati da virgola) per altri deploy da build identica.
 */
export function isSaaSHostname(hostname) {
  const h = String(hostname || "").toLowerCase();
  if (!h) return false;
  if (h.includes("localhost") || h.includes("127.0.0.1")) return true;
  if (h === "pizzamanager.it" || h === "www.pizzamanager.it") return true;
  if (h.startsWith("app.")) return true;
  if (h === "support.pizzamanager.it") return true;
  if (h === "pizzeria-da-nicolo.web.app" || h === "pizzeria-da-nicolo.firebaseapp.com") return true;
  const extra = import.meta.env.VITE_FULL_APP_HOSTNAMES;
  if (typeof extra === "string" && extra.trim()) {
    const set = new Set(
      extra
        .split(/[,;\s]+/)
        .map((x) => x.trim().toLowerCase())
        .filter(Boolean),
    );
    if (set.has(h)) return true;
  }
  return false;
}

export function getIsSaaSClient() {
  if (typeof window === "undefined") return true;
  return isSaaSHostname(window.location.hostname);
}
