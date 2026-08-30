function statoConsegna(o) {
  return String(o?.stato_consegna ?? o?.statoConsegna ?? "").trim().toUpperCase()
}

function riderIdOf(o) {
  return o?.rider_id ?? o?.riderId ?? null
}

function ponySlotOf(o) {
  const v = o?.presa_da_pony_slot ?? o?.presaDaPonySlot
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? n : null
}

/**
 * Schermata pony: mostra le consegne libere e quelle prese da me.
 * Le consegne già prese da un altro ragazzo spariscono.
 * Consegnato non resta in lista operativa.
 */
export function ordineVisibileAlPony(ordine, { riderId, ponySlot } = {}) {
  const sc = statoConsegna(ordine)
  if (sc === "CONSEGNATO") return false

  const assignedRider = riderIdOf(ordine)
  const assignedSlot = ponySlotOf(ordine)
  const taken = sc === "IN_VIAGGIO" || sc === "ASSEGNATO" || Boolean(assignedRider) || assignedSlot != null
  if (!taken) return true

  if (assignedRider && riderId && String(assignedRider) === String(riderId)) {
    if (ponySlot != null && assignedSlot != null && Number(assignedSlot) !== Number(ponySlot)) return false
    return true
  }
  if (assignedRider && riderId && String(assignedRider) !== String(riderId)) return false
  if (ponySlot != null && assignedSlot != null) return Number(assignedSlot) === Number(ponySlot)
  return true
}

export function filterOrdiniPerPony(orders, ctx) {
  return (orders || []).filter((o) => ordineVisibileAlPony(o, ctx))
}
