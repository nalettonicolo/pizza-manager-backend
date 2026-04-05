/**
 * Rileva se il sito è la piattaforma PizzaManager (marketing, login, app)
 * e non il solo menu pubblico su dominio pizzeria.
 */
export function isSaaSHostname(hostname) {
  const h = String(hostname || "").toLowerCase();
  if (!h) return false;
  if (h.includes("localhost") || h.includes("127.0.0.1")) return true;
  if (h === "pizzamanager.it" || h === "www.pizzamanager.it") return true;
  if (h.startsWith("app.")) return true;
  if (h === "support.pizzamanager.it") return true;
  return false;
}

export function getIsSaaSClient() {
  if (typeof window === "undefined") return true;
  return isSaaSHostname(window.location.hostname);
}
