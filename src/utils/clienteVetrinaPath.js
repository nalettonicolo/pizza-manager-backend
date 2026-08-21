import { getIsSaaSClient } from "@/utils/saasHost"
import { withPreservedSupportSearch } from "@/utils/supportTenantOverride"

/**
 * Destinazione menù/vetrina dopo login cliente.
 * SaaS (localhost / app): `/preview`; dominio locale: `/`.
 * @param {string} [search]
 * @returns {string}
 */
export function resolveClienteVetrinaPath(search = "") {
  const base = getIsSaaSClient() ? "/preview" : "/"
  return withPreservedSupportSearch(base, search)
}

/**
 * Path profilo con query preservate (+ edit opzionale).
 * @param {string} [search]
 * @param {{ edit?: boolean }} [opts]
 */
export function resolveClienteProfiloPath(search = "", opts = {}) {
  const path = withPreservedSupportSearch("/cliente/profilo", search)
  if (!opts.edit) return path
  try {
    const url = new URL(path, "https://pizzamanager.local")
    url.searchParams.set("edit", "1")
    return `${url.pathname}${url.search}`
  } catch {
    return path.includes("?") ? `${path}&edit=1` : `${path}?edit=1`
  }
}

/**
 * Path storico ordini con query preservate.
 * @param {string} [search]
 */
export function resolveClienteOrdiniPath(search = "") {
  return withPreservedSupportSearch("/cliente/ordini", search)
}
