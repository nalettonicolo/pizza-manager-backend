/**
 * Regole programma fidelity da `parametri_operativi` (timbri, premi, ecc.).
 */

/** @typedef {'euro' | 'pizza' | 'entrambi' | 'nessuno'} FidelityModalitaAccredito */

/**
 * Come si guadagnano punti/timbri verso i premi (accredito automatico futuro).
 * `entrambi` è legacy: in UI ora si usa solo euro o pizza (esclusivi) o nessuno.
 * @param {Record<string, unknown>} po
 * @returns {FidelityModalitaAccredito}
 */
export function readFidelityModalitaAccredito(po) {
  const raw = po && typeof po === "object" ? po : {}
  const v = String(raw.fidelity_modalita_accredito || "euro").toLowerCase()
  if (v === "pizza") return "pizza"
  if (v === "nessuno") return "nessuno"
  if (v === "entrambi") return "entrambi"
  return "euro"
}

/** @typedef {{ soglia: number, descrizione: string }} FidelityPremio */

/**
 * @param {unknown} raw
 * @returns {FidelityPremio[]}
 */
export function parseFidelityPremi(raw) {
  if (!Array.isArray(raw)) return []
  return raw
    .map((x) => ({
      soglia: Math.max(1, Math.min(999, Math.floor(Number(x?.soglia) || 0))),
      descrizione: String(x?.descrizione ?? x?.titolo ?? "").trim(),
    }))
    .filter((x) => x.soglia > 0 && x.descrizione)
    .sort((a, b) => a.soglia - b.soglia)
}

/**
 * Timbri “sulla scheda corrente” (carta piena quando multiplo di `totale`).
 * @param {number} punti
 * @param {number} timbriSchedaTotale
 */
export function timbriSuSchedaCorrente(punti, timbriSchedaTotale) {
  const tot = Math.floor(Number(timbriSchedaTotale) || 0)
  if (tot < 1) return 0
  const p = Math.max(0, Math.floor(Number(punti) || 0))
  if (p === 0) return 0
  const r = p % tot
  return r === 0 ? tot : r
}

/**
 * Prossimo premio rispetto ai timbri sulla scheda corrente.
 * @param {FidelityPremio[]} premi
 * @param {number} timbriSuScheda
 */
export function prossimoPremioSuScheda(premi, timbriSuScheda) {
  const list = Array.isArray(premi) ? premi : []
  const t = Math.max(0, Math.floor(Number(timbriSuScheda) || 0))
  return list.find((pr) => pr.soglia > t) || null
}

/**
 * @param {Record<string, unknown>} po
 */
/**
 * Offerta consegna a domicilio (ordini online / cliente). Default true se non impostato.
 * @param {Record<string, unknown>} po
 */
export function readConsegnaDomicilioAttiva(po) {
  const raw = po && typeof po === "object" ? po : {}
  const v = raw.consegna_domicilio_attiva
  if (v === false || v === "false") return false
  if (v === true || v === "true") return true
  return true
}

/**
 * Fidelity valida anche per clienti che ordinano a domicilio (area cliente / accrediti consegna). Default true se non impostato.
 * @param {Record<string, unknown>} po
 */
export function readFidelityAbilitaClientiDomicilio(po) {
  const raw = po && typeof po === "object" ? po : {}
  const v = raw.fidelity_abilita_clienti_domicilio
  if (v === false || v === "false") return false
  if (v === true || v === "true") return true
  return true
}

export function readFidelityProgramSlice(po) {
  const raw = po && typeof po === "object" ? po : {}
  const modalitaAccredito = readFidelityModalitaAccredito(raw)
  const rawP = raw.fidelity_timbri_per_pizza
  const hasP = rawP !== undefined && rawP !== null && String(rawP).trim() !== ""
  const timbriPerPizza = hasP ? Math.max(0, Math.min(100, Number(rawP) || 0)) : 0
  const rawT = raw.fidelity_timbri_scheda_totale
  const hasT = rawT !== undefined && rawT !== null && String(rawT).trim() !== ""
  const timbriSchedaTotale = hasT ? Math.max(0, Math.min(48, Number(rawT) || 0)) : 0
  return {
    modalitaAccredito,
    timbriPerPizza,
    timbriSchedaTotale,
    premi: parseFidelityPremi(raw.fidelity_premi),
  }
}
