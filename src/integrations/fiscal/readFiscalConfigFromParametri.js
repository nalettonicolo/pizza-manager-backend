import { FISCAL_MODES, FISCAL_PARAM_KEYS } from "./fiscalConstants"

/**
 * Legge la configurazione fiscal / pay-by-link da `parametri_operativi`.
 * @param {Record<string, unknown> | null | undefined} parametriOperativi
 * @returns {{
 *   fiscalMode: string,
 *   fiscalProviderKey: string | null,
 *   paymentLinkEnabled: boolean,
 *   paymentLinkProviderKey: string | null,
 *   posManualExportEnabled: boolean,
 *   posTerminalProviderKey: string | null,
 * }}
 */
export function readFiscalConfigFromParametri(parametriOperativi) {
  const po = parametriOperativi && typeof parametriOperativi === "object" ? parametriOperativi : {}
  const modeRaw = po[FISCAL_PARAM_KEYS.fiscal_mode]
  const fiscalMode =
    typeof modeRaw === "string" && modeRaw.trim() ? modeRaw.trim() : FISCAL_MODES.NONE
  const fpk = po[FISCAL_PARAM_KEYS.fiscal_provider_key]
  const fiscalProviderKey = typeof fpk === "string" && fpk.trim() ? fpk.trim() : null
  const ple = po[FISCAL_PARAM_KEYS.payment_link_enabled]
  const paymentLinkEnabled = ple === true || ple === "true"
  const plpk = po[FISCAL_PARAM_KEYS.payment_link_provider_key]
  const paymentLinkProviderKey = typeof plpk === "string" && plpk.trim() ? plpk.trim() : null
  const pme = po[FISCAL_PARAM_KEYS.pos_manual_export_enabled]
  const posManualExportEnabled = pme === true || pme === "true"
  const ptpk = po[FISCAL_PARAM_KEYS.pos_terminal_provider_key]
  const posTerminalProviderKey = typeof ptpk === "string" && ptpk.trim() ? ptpk.trim() : null
  return {
    fiscalMode,
    fiscalProviderKey,
    paymentLinkEnabled,
    paymentLinkProviderKey,
    posManualExportEnabled,
    posTerminalProviderKey,
  }
}
