/**
 * Suggerimento automatico allergeni dal nome ingrediente (es. "Mozzarella" → Latte). Stessi nomi
 * di ALLERGENE_COLUMN_NAMES in IngredientiPage.jsx (Formato B CSV) — 13 dei 14 allergeni UE
 * (Reg. 1169/2011); manca "Arachidi", non ancora una colonna del formato CSV esistente.
 *
 * Uso: chi crea un ingrediente non deve ricordarsi a mano quali allergeni spuntare per i casi
 * più comuni — resta comunque sempre modificabile (il suggerimento non sovrascrive mai una
 * selezione già fatta a mano, vedi IngredientiPage.jsx).
 */

export const ALLERGENI_STANDARD = Object.freeze([
  "Glutine",
  "Crostacei",
  "Uova",
  "Pesce",
  "Soia",
  "Latte",
  "Frutta a guscio",
  "Sedano",
  "Senape",
  "Sesamo",
  "Solfiti",
  "Lupini",
  "Molluschi",
])

/** Allergene → parole chiave (minuscolo, match "contiene") che lo suggeriscono dal nome ingrediente. */
const KEYWORDS_PER_ALLERGENE = Object.freeze({
  Glutine: ["farina", "pane", "grano", "frumento", "pasta", "impasto", "panatura", "pangrattato", "semola", "orzo", "segale", "farro", "crostata", "biscott"],
  Crostacei: ["gamber", "scampi", "aragosta", "granchio", "astice", "mazzancoll"],
  Uova: ["uovo", "uova", "maionese"],
  Pesce: ["tonno", "salmone", "acciug", "alici", "pesce", "baccalà", "merluzzo", "spada", "sgombro"],
  Soia: ["soia", "tofu", "edamame"],
  Latte: ["latte", "mozzarella", "formaggio", "parmigiano", "grana", "burro", "panna", "yogurt", "ricotta", "gorgonzola", "stracchino", "provola", "scamorza", "mascarpone", "besciamella", "fontina", "caciocavallo", "philadelphia", "burrata", "fior di latte"],
  "Frutta a guscio": ["noci", "nocciol", "mandorl", "pistacchi", "anacardi", "pinoli"],
  Sedano: ["sedano"],
  Senape: ["senape"],
  Sesamo: ["sesamo", "tahin"],
  Solfiti: ["solfiti"],
  Lupini: ["lupini"],
  Molluschi: ["cozze", "vongole", "polpo", "calamar", "seppi", "molluschi", "ostrich"],
})

/**
 * @param {string} nomeIngrediente
 * @returns {string[]} nomi allergene (sottoinsieme di ALLERGENI_STANDARD) suggeriti dal nome.
 */
export function suggerisciAllergeniDaNome(nomeIngrediente) {
  const t = String(nomeIngrediente ?? "").trim().toLowerCase()
  if (!t) return []
  const out = []
  for (const allergene of ALLERGENI_STANDARD) {
    const keywords = KEYWORDS_PER_ALLERGENE[allergene] || []
    if (keywords.some((k) => t.includes(k))) out.push(allergene)
  }
  return out
}
