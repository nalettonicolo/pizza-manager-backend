/** URL login piattaforma (staff) — usato se uno staff accede dal dominio pizzeria. */
export function getSaaSLoginUrl() {
  const raw = import.meta.env.VITE_SAAS_APP_ORIGIN
  const base = (typeof raw === "string" && raw.trim() ? raw.trim() : "https://pizzamanager.it").replace(/\/$/, "")
  return `${base}/login`
}
