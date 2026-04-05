import { slugifyHeading } from "@/utils/guidaMarkdownToc"

/**
 * Mappa concettuale del manuale tenant: **macro** (##) e **micro** (###), opzionale sotto-voce (####).
 * I titoli devono coincidere esattamente con le righe `##` / `###` / `####` in `manualeUtente.md`.
 */
export const MANUALE_ROADMAP = [
  { macro: "Introduzione", micros: [] },
  {
    macro: "Area amministratore",
    micros: [
      "Manuale in app",
      "Report vendite",
      "Menu e listino",
      "Magazzino e contabilità",
      "Dipendenti",
      "Ruoli e permessi operativi",
      { title: "Nota sui piani e sui moduli", level: "sub" },
      "Impostazioni",
    ],
  },
  { macro: "Area operativa", micros: [] },
  { macro: "Sito pubblico e contatti", micros: [] },
  { macro: "Aggiornare il manuale", micros: [] },
  { macro: "Cronologia contenuti", micros: [] },
]

export function anchorId(title) {
  return slugifyHeading(title)
}

/** Voce micro: stringa o { title, level: 'sub' } per #### */
function microTitle(m) {
  return typeof m === "string" ? m : m.title
}

function isSub(m) {
  return typeof m === "object" && m && m.level === "sub"
}

/**
 * Per sidebar: macro con elenco micro (id slug + label).
 */
export function getManualeRoadmapNav() {
  return MANUALE_ROADMAP.map((block) => {
    const macroId = anchorId(block.macro)
    const items = []
    for (const m of block.micros) {
      const title = microTitle(m)
      items.push({
        id: anchorId(title),
        title,
        sub: isSub(m),
      })
    }
    return { macroId, macroTitle: block.macro, items }
  })
}

/**
 * Card per mappa concettuale in cima alla pagina (solo macro con almeno un micro, + Introduzione).
 */
export function getManualeMacroCards() {
  return MANUALE_ROADMAP.map((b) => ({
    id: anchorId(b.macro),
    title: b.macro,
    hint:
      b.micros.length === 0
        ? "Sezione unica"
        : `${b.micros.length} argoment${b.micros.length === 1 ? "o" : "i"}`,
  }))
}
