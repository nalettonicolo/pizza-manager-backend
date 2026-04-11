import { TERMINAL_PROVIDER_KEYS } from "@/config/posIntegrationsRegistry"

/**
 * Percorso C: avvio incasso su terminale fisico/cloud (nessuna implementazione vendor ancora).
 *
 * @param {{
 *   tenantId: string,
 *   providerKey: string | null | undefined,
 *   importoCent: number,
 *   ordineId?: string | null,
 *   puntoVenditaId?: string | null,
 * }} ctx
 * @returns {Promise<{ ok: boolean, code: string, detail?: string }>}
 */
export async function requestTerminalCollection(ctx) {
  const pk = String(ctx.providerKey || "").trim()
  if (!pk || pk === TERMINAL_PROVIDER_KEYS.NONE) {
    return { ok: false, code: "terminal_provider_unset", detail: "Scegli un adapter terminale nelle impostazioni cassa" }
  }
  return {
    ok: false,
    code: "not_implemented",
    detail: `Adapter "${pk}" predisposto: servono SDK/credenziali fornitore e backend dedicato.`,
  }
}
