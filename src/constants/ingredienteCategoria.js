/**
 * Tipi categoria ingrediente (Cucina / Bancone).
 * Valori canonici salvati in DB e colonna CSV `categoria`.
 */

export const INGREDIENTE_CATEGORIA_OPTIONS = Object.freeze([
  { value: "affettato", label: "Affettato" },
  { value: "fritto", label: "Fritto" },
  { value: "dolce", label: "Dolce" },
  { value: "bibita", label: "Bibita" },
  { value: "congelato", label: "Congelato" },
])

export const INGREDIENTE_CATEGORIA_VALUES = Object.freeze(
  INGREDIENTE_CATEGORIA_OPTIONS.map((o) => o.value),
)

/** Colore default suggerito in anagrafica quando si sceglie il tipo (se colore vuoto). */
export const INGREDIENTE_CATEGORIA_DEFAULT_COLOR = Object.freeze({
  affettato: "#dcfce7",
  fritto: "#fef9c3",
  dolce: "#fce7f3",
  bibita: "#ffffff",
  congelato: "#dbeafe",
})

/**
 * Normalizza testo libero / CSV / legacy → valore canonico, oppure "" se vuoto.
 * Sinonimi: bibite→bibita, fritti→fritto, surgelato→congelato, …
 * @param {unknown} raw
 * @returns {string}
 */
export function normalizeIngredienteCategoria(raw) {
  const t = String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
  if (!t) return ""
  if (INGREDIENTE_CATEGORIA_VALUES.includes(t)) return t
  if (t.includes("congel") || t.includes("surgel")) return "congelato"
  if (t.includes("affett")) return "affettato"
  if (t.includes("fritt")) return "fritto"
  if (t.includes("dolc")) return "dolce"
  if (t.includes("bibit") || t.includes("bevan")) return "bibita"
  return ""
}

/**
 * Valore da mostrare nel select: canonico se riconoscibile, altrimenti il raw (legacy).
 * @param {unknown} raw
 * @returns {string}
 */
export function resolveIngredienteCategoriaForSelect(raw) {
  const normalized = normalizeIngredienteCategoria(raw)
  if (normalized) return normalized
  const t = String(raw ?? "").trim()
  return t
}

export function labelIngredienteCategoria(value) {
  const v = normalizeIngredienteCategoria(value) || String(value ?? "").trim()
  if (!v) return ""
  const opt = INGREDIENTE_CATEGORIA_OPTIONS.find((o) => o.value === v)
  return opt ? opt.label : v
}
