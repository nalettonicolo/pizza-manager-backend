/**
 * Ordina un array per il campo `ordine` in modo crescente.
 * Gli elementi senza `ordine` sono trattati come 0.
 * @param {Array} list
 * @returns {Array} nuova array ordinata (non muta l'originale)
 */
export function sortByOrdine(list) {
  if (!Array.isArray(list)) return [];
  return [...list].sort((a, b) => {
    const na = Number(a?.ordine)
    const nb = Number(b?.ordine)
    return (Number.isFinite(na) ? na : 0) - (Number.isFinite(nb) ? nb : 0)
  })
}
