/**
 * Verifica se un prodotto menu corrisponde alla ricerca testuale su
 * nome, descrizione e (opzionale) nomi ingredienti in ricetta.
 *
 * @param {object} product
 * @param {string} queryLower - query già normalizzata (trim + toLowerCase)
 * @param {string[]|undefined|null} ingredientNames
 * @returns {boolean}
 */
export function productMatchesMenuSearch(product, queryLower, ingredientNames) {
  if (!queryLower) return true
  const nome = String(product?.nome ?? "").toLowerCase()
  const desc = String(product?.descrizione ?? "").toLowerCase()
  if (nome.includes(queryLower) || desc.includes(queryLower)) return true
  const names = Array.isArray(ingredientNames) ? ingredientNames : []
  return names.some((n) => String(n ?? "").toLowerCase().includes(queryLower))
}
