/**
 * Colori sfondo dei pulsanti «preparazione» in vista Cucina (per tipo ingrediente / categoria testuale).
 * Valori di default; override per tenant in `parametri_operativi.cucina_prep_colori_categoria`.
 */

export const CUCINA_PREP_CATEGORY_COLOR_KEYS = ["congelato", "affettato", "bibite", "fritto", "comune"]

export const DEFAULT_CUCINA_PREP_CATEGORY_COLORS = {
  congelato: "#dbeafe",
  affettato: "#dcfce7",
  bibite: "#ffffff",
  fritto: "#fef9c3",
  comune: "#fce7f3",
}

function isHexColor(s) {
  const t = String(s ?? "").trim()
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(t)
}

/**
 * Unisce i default con i valori salvati sul tenant (solo esadecimali validi).
 * @param {Record<string, unknown>|null|undefined} parametriOperativi
 * @returns {typeof DEFAULT_CUCINA_PREP_CATEGORY_COLORS}
 */
export function mergeCucinaPrepColorsFromParametri(parametriOperativi) {
  const raw = parametriOperativi?.cucina_prep_colori_categoria
  const out = { ...DEFAULT_CUCINA_PREP_CATEGORY_COLORS }
  if (!raw || typeof raw !== "object") return out
  for (const key of CUCINA_PREP_CATEGORY_COLOR_KEYS) {
    const v = raw[key]
    if (v != null && isHexColor(v)) out[key] = String(v).trim()
  }
  return out
}

/**
 * Colore sfondo task preparazione: 1) colore ingrediente (#hex) se impostato in anagrafica,
 * 2) mappa per parola chiave nella «categoria» ingrediente, 3) comune.
 * @param {object} task — task da buildCucinaPrepTasks
 * @param {typeof DEFAULT_CUCINA_PREP_CATEGORY_COLORS} categoryColors
 */
export function resolvePrepTaskBackgroundColor(task, categoryColors) {
  const map = categoryColors || DEFAULT_CUCINA_PREP_CATEGORY_COLORS
  const custom = String(task?.ingredienteColore || "").trim()
  if (custom) return custom
  const cat = String(task?.ingredienteCategoria || "").trim().toLowerCase()
  if (cat.includes("congel")) return map.congelato
  if (cat.includes("affett")) return map.affettato
  if (cat.includes("bibit")) return map.bibite
  if (cat.includes("fritt")) return map.fritto
  return map.comune
}
