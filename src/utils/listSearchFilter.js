/** Normalizza testo ricerca elenchi (trim + lower case). */
export function normalizeListSearchQuery(q) {
  return String(q ?? "").trim().toLowerCase();
}

/**
 * True se almeno una stringa in haystacks contiene la query normalizzata.
 * @param {string} qNorm da `normalizeListSearchQuery`
 * @param {unknown[]} haystacks valori campi da cercare
 */
export function rowMatchesListSearch(qNorm, haystacks) {
  if (!qNorm) return true;
  return haystacks.some((raw) => String(raw ?? "").toLowerCase().includes(qNorm));
}
