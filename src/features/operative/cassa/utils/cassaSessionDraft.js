import { getLocalYYYYMMDD } from "@/utils/localDate"

const PREFIX = "pm_cassa_draft_v1"

export function cassaDraftStorageKey(tenantId, pvId) {
  const day = getLocalYYYYMMDD()
  return `${PREFIX}:${tenantId}:${pvId ?? "nopv"}:${day}`
}

function slotToJSON(slot) {
  if (!slot || typeof slot !== "object") return null
  const date = slot.date
  const dateIso =
    date instanceof Date
      ? date.toISOString()
      : typeof date === "string"
        ? date
        : slot.dateIso ?? null
  return { key: slot.key, label: slot.label, dateIso }
}

function slotFromJSON(raw) {
  if (!raw || typeof raw !== "object") return null
  const d = raw.dateIso ? new Date(raw.dateIso) : null
  if (!d || Number.isNaN(d.getTime())) return null
  return { key: raw.key, label: raw.label || "", date: d }
}

/**
 * Carica bozza ordine cassa per tenant + PV + giorno locale (solo se coincide con oggi).
 * @returns {object | null}
 */
export function loadCassaDraft(tenantId, pvId) {
  if (!tenantId) return null
  try {
    const key = cassaDraftStorageKey(tenantId, pvId)
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const data = JSON.parse(raw)
    if (!data || data.v !== 1) return null
    const today = getLocalYYYYMMDD()
    if (data.day !== today) {
      localStorage.removeItem(key)
      return null
    }
    if (data.checkoutSelectedSlot) {
      data.checkoutSelectedSlot = slotFromJSON(data.checkoutSelectedSlot)
    }
    return data
  } catch {
    return null
  }
}

/**
 * Salva bozza (carrello + campi checkout) per la giornata corrente.
 */
export function saveCassaDraft(tenantId, pvId, payload) {
  if (!tenantId) return
  try {
    const key = cassaDraftStorageKey(tenantId, pvId)
    const day = getLocalYYYYMMDD()
    const slot = payload.checkoutSelectedSlot
    const serializable = {
      ...payload,
      checkoutSelectedSlot: slotToJSON(slot),
    }
    localStorage.setItem(
      key,
      JSON.stringify({
        v: 1,
        day,
        ...serializable,
      }),
    )
  } catch (e) {
    console.warn("[Cassa] salvataggio bozza:", e)
  }
}

export function clearCassaDraft(tenantId, pvId) {
  if (!tenantId) return
  try {
    localStorage.removeItem(cassaDraftStorageKey(tenantId, pvId))
  } catch {
    /* ignore */
  }
}
