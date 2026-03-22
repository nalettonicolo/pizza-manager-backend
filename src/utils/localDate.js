/** Data locale YYYY-MM-DD (timezone browser). */
export function getLocalYYYYMMDD(d = new Date()) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

/** Data locale dell’ordine da createdAt / created_at. */
export function orderCreatedLocalDateKey(o) {
  const raw = o?.createdAt ?? o?.created_at
  if (!raw) return null
  return getLocalYYYYMMDD(new Date(raw))
}
