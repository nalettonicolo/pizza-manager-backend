/**
 * Tema tessera fidelity da `parametri_operativi` (prefisso fidelity_card_*).
 */

export const FIDELITY_CARD_VARIANTS = [
  { id: "aurora", label: "Aurora (viola–teal)" },
  { id: "midnight", label: "Midnight (blu notte + oro)" },
  { id: "gold", label: "Gold (crema elegante)" },
  { id: "minimal", label: "Minimal (bianco pulito)" },
  { id: "custom", label: "Personalizzato (i tuoi colori)" },
]

export const FIDELITY_CARD_PATTERNS = [
  { id: "none", label: "Nessuno" },
  { id: "dots", label: "Puntini leggeri" },
  { id: "grid", label: "Griglia soft" },
  { id: "waves", label: "Onde" },
]

function presetForVariant(variant) {
  switch (variant) {
    case "midnight":
      return {
        primary: "#0f172a",
        secondary: "#312e81",
        accent: "#fbbf24",
        contrast: "chiaro",
      }
    case "gold":
      return {
        primary: "#faf6ef",
        secondary: "#e8dcc4",
        accent: "#92400e",
        contrast: "scuro",
      }
    case "minimal":
      return {
        primary: "#ffffff",
        secondary: "#f1f5f9",
        accent: "#0284c7",
        contrast: "scuro",
      }
    case "custom":
      return {
        primary: "#6366f1",
        secondary: "#0ea5e9",
        accent: "#f43f5e",
        contrast: "chiaro",
      }
    case "aurora":
    default:
      return {
        primary: "#4c1d95",
        secondary: "#0f766e",
        accent: "#fb7185",
        contrast: "chiaro",
      }
  }
}

function bool(po, key, defaultTrue = true) {
  const v = po?.[key]
  if (v === false || v === "false") return false
  if (v === true || v === "true") return true
  return defaultTrue
}

/**
 * @param {Record<string, unknown>} po — parametri_operativi (o slice)
 */
export function buildFidelityCardTheme(po) {
  const raw = po && typeof po === "object" ? po : {}
  const variant = FIDELITY_CARD_VARIANTS.some((v) => v.id === raw.fidelity_card_variant)
    ? raw.fidelity_card_variant
    : "aurora"
  const preset = presetForVariant(variant === "custom" ? "custom" : variant)

  const primary = String(raw.fidelity_card_colore_primario || "").trim() || preset.primary
  const secondary = String(raw.fidelity_card_colore_secondario || "").trim() || preset.secondary
  const accent = String(raw.fidelity_card_colore_accents || "").trim() || preset.accent
  const contrastRaw = raw.fidelity_card_testo_contrasto
  const contrast =
    contrastRaw === "chiaro" || contrastRaw === "scuro" ? contrastRaw : preset.contrast

  const radius = Math.min(32, Math.max(6, Number(raw.fidelity_card_angolo_bordo) || 18))
  const pattern = FIDELITY_CARD_PATTERNS.some((p) => p.id === raw.fidelity_card_pattern)
    ? raw.fidelity_card_pattern
    : "dots"

  return {
    variant,
    primary,
    secondary,
    accent,
    contrast,
    radius,
    pattern,
    subtitle: String(raw.fidelity_card_sottotitolo || "").trim(),
    labelPunti: String(raw.fidelity_card_label_punti || "Punti").trim() || "Punti",
    labelCodice: String(raw.fidelity_card_label_codice || "Codice").trim() || "Codice",
    mostraLogo: bool(raw, "fidelity_card_mostra_logo", true),
    mostraQr: bool(raw, "fidelity_card_mostra_qr", true),
    ombraForte: bool(raw, "fidelity_card_ombra", true),
    bordoSottile: bool(raw, "fidelity_card_bordo", variant === "minimal" || variant === "gold"),
  }
}

/** Aggiorna il tema partendo da parametri_operativi parziali (es. cambio variante). */
export function nextFidelityCardTheme(currentTheme, partialPo) {
  const po = { ...fidelityCardThemeKeysForSave(currentTheme), ...partialPo }
  return buildFidelityCardTheme(po)
}

/** Valori da unire in `parametri_operativi` al salvataggio. */
export function fidelityCardThemeKeysForSave(state) {
  return {
    fidelity_card_variant: state.variant,
    fidelity_card_colore_primario: state.primary,
    fidelity_card_colore_secondario: state.secondary,
    fidelity_card_colore_accents: state.accent,
    fidelity_card_testo_contrasto: state.contrast,
    fidelity_card_angolo_bordo: state.radius,
    fidelity_card_pattern: state.pattern,
    fidelity_card_sottotitolo: state.subtitle,
    fidelity_card_label_punti: state.labelPunti,
    fidelity_card_label_codice: state.labelCodice,
    fidelity_card_mostra_logo: state.mostraLogo,
    fidelity_card_mostra_qr: state.mostraQr,
    fidelity_card_ombra: state.ombraForte,
    fidelity_card_bordo: state.bordoSottile,
  }
}
