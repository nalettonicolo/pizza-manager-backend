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

/**
 * Ripartizione euristica per movimenti contabilità (contanti vs elettronico).
 * "Da pagare" e tipi non riconosciuti finiscono in `altro`.
 */
export function aggregateIncassiContantiElettronicoDaOrdini(ordini) {
  const active = filtraOrdiniNonAnnullati(ordini)
  let contanti = 0
  let elettronico = 0
  let altro = 0
  for (const o of active) {
    const raw = String(o?.tipo_pagamento ?? "").trim().toLowerCase()
    const val = Number(o.totale || 0)
    if (raw.includes("contant")) contanti += val
    else if (
      raw.includes("carta") ||
      raw.includes("misto") ||
      raw.includes("pos") ||
      raw.includes("stripe") ||
      raw.includes("sumup") ||
      raw.includes("elettron") ||
      raw.includes("bonific")
    ) {
      elettronico += val
    } else {
      altro += val
    }
  }
  return { contanti, elettronico, altro, count: active.length }
}
