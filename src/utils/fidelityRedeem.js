import { readFidelityProgramSlice } from "@/utils/fidelityProgramConfig"

/**
 * Costo in punti per un riscatto premio in cassa (scheda timbri o soglia da fidelity_premi).
 * @param {Record<string, unknown>} parametriOperativi
 * @param {number} puntiSaldo
 * @returns {{ cost: number | null, premioLabel: string | null }}
 */
export function computeFidelityRedeemPuntiCost(parametriOperativi, puntiSaldo) {
  const p = Math.max(0, Math.floor(Number(puntiSaldo) || 0))
  const slice = readFidelityProgramSlice(parametriOperativi || {})

  if (slice.timbriSchedaTotale >= 1) {
    if (p < slice.timbriSchedaTotale) {
      return { cost: null, premioLabel: null }
    }
    const matchPremio = slice.premi.find((pr) => pr.soglia === slice.timbriSchedaTotale)
    return {
      cost: slice.timbriSchedaTotale,
      premioLabel: matchPremio?.descrizione || "Premio scheda fedeltà",
    }
  }

  const premiRaggiunti = slice.premi.filter((pr) => p >= pr.soglia).sort((a, b) => a.soglia - b.soglia)
  if (premiRaggiunti.length === 0) {
    return { cost: null, premioLabel: null }
  }
  const pr = premiRaggiunti[0]
  return { cost: pr.soglia, premioLabel: pr.descrizione || "Premio fedeltà" }
}
