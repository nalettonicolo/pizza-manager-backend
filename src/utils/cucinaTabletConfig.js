/** Chiave in `parametri_operativi`: tablet dedicato Cucina (reparto separato). */
export const CUCINA_TABLET_PARAM_KEY = "cucina_tablet_abilitato"

/**
 * True = area `/operative/cucina` attiva (tablet cucina).
 * False = prep cucina integrate nel Bancone (locale senza tablet cucina).
 * Default: true (comportamento storico).
 * @param {Record<string, unknown> | null | undefined} parametriOperativi
 */
export function isCucinaTabletAbilitato(parametriOperativi) {
  const p = parametriOperativi && typeof parametriOperativi === "object" ? parametriOperativi : {}
  const v = p[CUCINA_TABLET_PARAM_KEY]
  if (v === false || v === "false" || v === 0 || v === "0") return false
  return true
}
