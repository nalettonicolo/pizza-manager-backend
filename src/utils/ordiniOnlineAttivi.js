/**
 * Ordini dalla vetrina: `parametri_operativi.ordini_online_attivi`.
 * Default true; solo `false` esplicito disattiva.
 * @param {unknown} po
 */
export function readOrdiniOnlineAttivi(po) {
  if (!po || typeof po !== "object") return true
  return po.ordini_online_attivi !== false
}

/**
 * Archivio listini multipli (snapshot JSON + PDF): attivabile dal tenant in Parametri.
 * Un solo listino operativo (prodotti DB); gli archivi sono copie di sicurezza.
 * @param {unknown} po
 */
export function readGestioneListiniMultipli(po) {
  if (!po || typeof po !== "object") return false
  return po.abilita_gestione_listini_multipli === true
}

/** @deprecated Usa readGestioneListiniMultipli */
export function readListiniMultipli(po) {
  return readGestioneListiniMultipli(po)
}
