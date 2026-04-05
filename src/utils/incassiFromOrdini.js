/**
 * Aggregazione incassi da elenco ordini (es. giornata cassa).
 * Esclude ordini annullati per totali e ripartizioni.
 */
export function ordineIsAnnullato(o) {
  return String(o?.stato ?? "").trim().toUpperCase() === "ANNULLATO"
}

export function filtraOrdiniNonAnnullati(ordini) {
  return (ordini || []).filter((o) => !ordineIsAnnullato(o))
}

/**
 * @param {object[]} ordini
 * @returns {{ byTipo: Record<string, number>, totale: number, count: number, annullatiCount: number }}
 */
export function aggregateIncassiDaOrdini(ordini) {
  const list = ordini || []
  const active = filtraOrdiniNonAnnullati(list)
  const byTipo = {}
  let totale = 0
  for (const o of active) {
    const raw = o?.tipo_pagamento
    const t =
      raw != null && String(raw).trim() !== "" ? String(raw).trim() : "Da pagare"
    const val = Number(o.totale || 0)
    byTipo[t] = (byTipo[t] || 0) + val
    totale += val
  }
  return {
    byTipo,
    totale,
    count: active.length,
    annullatiCount: list.length - active.length,
  }
}
