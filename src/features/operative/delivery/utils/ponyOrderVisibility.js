function statoConsegna(o) {
  return String(o?.stato_consegna ?? o?.statoConsegna ?? "").trim().toUpperCase()
}

function riderIdOf(o) {
  return o?.rider_id ?? o?.riderId ?? null
}

/**
 * Schermata pony: mostra le consegne libere e quelle prese da me.
 * Le consegne già prese da un altro pony spariscono.
 * Consegnato non resta in lista operativa.
 */
export function ordineVisibileAlPony(ordine, { riderId } = {}) {
  const sc = statoConsegna(ordine)
  if (sc === "CONSEGNATO") return false

  const assignedRider = riderIdOf(ordine)
  const taken = sc === "IN_VIAGGIO" || sc === "ASSEGNATO" || Boolean(assignedRider)
  if (!taken) return true

  if (assignedRider && riderId) return String(assignedRider) === String(riderId)
  return true
}

export function filterOrdiniPerPony(orders, ctx) {
  return (orders || []).filter((o) => ordineVisibileAlPony(o, ctx))
}
