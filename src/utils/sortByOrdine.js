/**
 * Ordina un array per il campo `ordine` in modo crescente.
 * Gli elementi senza `ordine` sono trattati come 0.
 * @param {Array} list
 * @returns {Array} nuova array ordinata (non muta l'originale)
 */
export function sortByOrdine(list) {
  if (!Array.isArray(list)) return [];
  return [...list].sort((a, b) => (Number(a?.ordine) ?? 0) - (Number(b?.ordine) ?? 0));
}
