/**
 * Tema menu / UI da `parametri_operativi.menuTheme` (Impostazioni → Layout).
 * Merge con default così chiavi mancanti non lasciano variabili CSS vuote.
 */
export const DEFAULT_MENU_THEME = Object.freeze({
  primary: "#c0392b",
  accent: "#e67e22",
  background: "#fdf2e9",
  cardBackground: "#ffffff",
})

/** @param {Record<string, unknown> | null | undefined} parametriOperativiOrNull — es. `tenantData?.parametri_operativi` */
export function resolveMenuTheme(parametriOperativiOrNull) {
  const raw = parametriOperativiOrNull?.menuTheme
  if (raw && typeof raw === "object") {
    return { ...DEFAULT_MENU_THEME, ...raw }
  }
  return null
}

/** Stile inline per layout admin/operativo (variabili CSS). */
export function adminLayoutCssVarsFromTheme(theme) {
  if (!theme) return {}
  return {
    "--admin-bar-bg": theme.primary,
    "--admin-bar-accent": theme.accent,
    "--admin-sidebar-bg": theme.primary,
    "--admin-content-bg": theme.background,
  }
}
