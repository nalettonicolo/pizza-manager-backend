/**
 * Ordina ingredienti extra suggeriti per affinità con la pizza (CL-09).
 * Preferisce ingredienti dello stesso “mondo” della ricetta; la ricerca testuale resta libera.
 */

const AFFINITY_GROUPS = [
  [
    "prosciutto",
    "cotto",
    "crudo",
    "funghi",
    "carciof",
    "olive",
    "capperi",
    "salamino",
    "salsicc",
    "uovo",
    "acciugh",
    "wurstel",
    "speck",
  ],
  ["gamber", "tonno", "frutti", "salmone", "cozze", "vongole", "polpo", "seppie", "alici"],
  ["rucola", "bresaola", "grana", "parmigiano", "stracciatella", "burrata"],
  ["pepperoni", "peperoni", "melanzan", "zucchin", "cipoll", "patate"],
  ["gorgonzola", "salsicc", "noci", "miele", "radicchio"],
]

function norm(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
}

function inGroup(nome, group) {
  const n = norm(nome)
  return group.some((g) => n.includes(g))
}

/**
 * @param {Array<{ id?: string, nome?: string }>} candidates
 * @param {{ productName?: string, recipeIngredientNames?: string[] }} ctx
 */
export function sortIngredientsByPizzaAffinity(candidates, ctx = {}) {
  const productName = norm(ctx.productName)
  const recipe = (ctx.recipeIngredientNames || []).map(norm).filter(Boolean)

  const recipeGroups = AFFINITY_GROUPS.map((g) => recipe.some((r) => inGroup(r, g)))

  const isCapricciosa = productName.includes("capricciosa")
  const isDiavola = productName.includes("diavola") || productName.includes("piccant")
  const isMare = /mare|pescator|tonno|gamber/.test(productName) || recipe.some((r) => inGroup(r, AFFINITY_GROUPS[1]))

  return [...(candidates || [])].sort((a, b) => {
    const sa = scoreOne(a, { productName, recipe, recipeGroups, isCapricciosa, isDiavola, isMare })
    const sb = scoreOne(b, { productName, recipe, recipeGroups, isCapricciosa, isDiavola, isMare })
    if (sb !== sa) return sb - sa
    return norm(a.nome).localeCompare(norm(b.nome), "it")
  })
}

function scoreOne(ing, ctx) {
  const nome = norm(ing?.nome)
  if (!nome) return -100
  let score = 0

  for (let i = 0; i < AFFINITY_GROUPS.length; i += 1) {
    if (ctx.recipeGroups[i] && inGroup(nome, AFFINITY_GROUPS[i])) score += 12
  }

  if (ctx.isCapricciosa) {
    if (/olive|capperi|salamino|salsicc|funghi|carciof|prosciutto|uovo|acciugh/.test(nome)) score += 25
    if (/gamber|rucola|ananas|tonno|salmone/.test(nome)) score -= 20
  }
  if (ctx.isDiavola) {
    if (/salamino|peperonc|nduja|salsicc|olive/.test(nome)) score += 20
    if (/gamber|rucola|ananas/.test(nome)) score -= 15
  }
  if (ctx.isMare) {
    if (inGroup(nome, AFFINITY_GROUPS[1])) score += 18
    if (/salamino|wurstel|prosciutto cotto/.test(nome)) score -= 10
  } else if (inGroup(nome, AFFINITY_GROUPS[1])) {
    // Mare su pizza land: non in prima fila
    score -= 8
  }

  return score
}
