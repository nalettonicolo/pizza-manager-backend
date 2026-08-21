import {
  prossimoPremioSuScheda,
  readFidelityProgramSlice,
  timbriSuSchedaCorrente,
} from "@/utils/fidelityProgramConfig"

/**
 * Stato riscatto premio in cassa (scheda timbri o soglie su saldo totale).
 * Con scheda a timbri: conta i timbri sulla scheda corrente e le schede già completate “in banca”.
 * @param {Record<string, unknown>} parametriOperativi
 * @param {number} puntiSaldo
 * @returns {{
 *   cost: number | null,
 *   premioLabel: string | null,
 *   premiRaggiunti: { soglia: number, descrizione: string }[],
 *   prossimoPremio: { soglia: number, descrizione: string } | null,
 *   suScheda: number | null,
 *   timbriSchedaTotale: number,
 *   puntiSaldo: number,
 * }}
 */
export function computeFidelityRedeemPuntiCost(parametriOperativi, puntiSaldo) {
  const p = Math.max(0, Math.floor(Number(puntiSaldo) || 0))
  const slice = readFidelityProgramSlice(parametriOperativi || {})
  const tot = slice.timbriSchedaTotale

  const empty = {
    cost: null,
    premioLabel: null,
    premiRaggiunti: [],
    prossimoPremio: null,
    suScheda: null,
    timbriSchedaTotale: tot,
    puntiSaldo: p,
  }

  // Scheda a timbri: soglie = timbri sulla scheda; schede già piene restano riscattabili.
  if (tot >= 1) {
    const su = timbriSuSchedaCorrente(p, tot)
    const schedeCompletate = Math.floor(p / tot)
    const raggiuntiMap = new Map()

    for (const pr of slice.premi) {
      const onCurrent = su >= pr.soglia
      // Almeno una scheda piena in banca ⇒ ha già superato ogni soglia ≤ tot.
      const fromBank = schedeCompletate >= 1 && pr.soglia <= tot
      if (onCurrent || fromBank) {
        raggiuntiMap.set(pr.soglia, pr)
      }
    }

    // Scheda piena (corrente o in banca) senza premio esplicito alla soglia massima.
    if ((su >= tot || schedeCompletate >= 1) && !raggiuntiMap.has(tot)) {
      const fallback = slice.premi.find((pr) => pr.soglia === tot)
      raggiuntiMap.set(tot, {
        soglia: tot,
        descrizione: fallback?.descrizione || "Premio scheda fedeltà",
      })
    }

    const raggiunti = [...raggiuntiMap.values()].sort((a, b) => b.soglia - a.soglia)
    const prossimo = prossimoPremioSuScheda(slice.premi, su)

    if (raggiunti.length > 0) {
      const pr = raggiunti[0]
      // Scala i punti della soglia premio (max una scheda), senza superare il saldo.
      const cost = Math.min(pr.soglia, tot, p)
      if (cost < 1) {
        return { ...empty, suScheda: su, prossimoPremio: prossimo }
      }
      return {
        cost,
        premioLabel: pr.descrizione || "Premio fedeltà",
        premiRaggiunti: raggiunti,
        prossimoPremio: prossimo,
        suScheda: su,
        timbriSchedaTotale: tot,
        puntiSaldo: p,
      }
    }

    return {
      ...empty,
      suScheda: su,
      prossimoPremio: prossimo,
    }
  }

  // Senza griglia: soglie sul saldo punti totale (premio più alto raggiunto).
  const raggiunti = slice.premi.filter((pr) => p >= pr.soglia).sort((a, b) => b.soglia - a.soglia)
  const prossimo = slice.premi.find((pr) => p < pr.soglia) || null

  if (raggiunti.length === 0) {
    return {
      ...empty,
      prossimoPremio: prossimo,
    }
  }

  const pr = raggiunti[0]
  return {
    cost: pr.soglia,
    premioLabel: pr.descrizione || "Premio fedeltà",
    premiRaggiunti: raggiunti,
    prossimoPremio: prossimo,
    suScheda: null,
    timbriSchedaTotale: 0,
    puntiSaldo: p,
  }
}
