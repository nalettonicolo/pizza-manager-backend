/**
 * Assegnazione pony (A/B/…) alle consegne del planning cassa.
 * Override manuali in localStorage per tenant+giorno.
 */

const LETTERS = "ABCDEFGH"

export function ponyCountForToday(parametri, date = new Date()) {
  const po = parametri && typeof parametri === "object" ? parametri : {}
  const d = date instanceof Date ? date : new Date(date)
  const jsDay = d.getDay() // 0=dom … 5=ven 6=sab
  const isVenDom = jsDay === 0 || jsDay === 5 || jsDay === 6
  const raw = isVenDom ? po.pony_ven_dom : po.pony_lun_gio
  const n = Number(raw)
  if (!Number.isFinite(n) || n < 1) return 1
  return Math.min(8, Math.floor(n))
}

export function ponyLetterAt(index) {
  const i = Math.max(0, Math.min(LETTERS.length - 1, index))
  return LETTERS[i]
}

function storageKey(tenantId, dayKey) {
  return `pm_planning_pony_${tenantId || "x"}_${dayKey || ""}`
}

export function loadPonyOverrides(tenantId, dayKey) {
  try {
    const raw = localStorage.getItem(storageKey(tenantId, dayKey))
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === "object" ? parsed : {}
  } catch {
    return {}
  }
}

export function savePonyOverrides(tenantId, dayKey, map) {
  try {
    localStorage.setItem(storageKey(tenantId, dayKey), JSON.stringify(map || {}))
  } catch {
    /* ignore */
  }
}

/**
 * Assegna consegne a pony con sequenza A/1, A/2, B/1…
 * @param {object[]} deliveryOrdini — ordini delivery della fascia
 * @param {number} ponyCount
 * @param {Record<string, { pony?: string, manual?: boolean }>} overrides
 */
export function assignDeliveriesToPonies(deliveryOrdini, ponyCount, overrides = {}) {
  const count = Math.max(1, ponyCount || 1)
  const sorted = [...(deliveryOrdini || [])].sort((a, b) => {
    const ta = new Date(a.createdAt ?? a.created_at ?? 0).getTime()
    const tb = new Date(b.createdAt ?? b.created_at ?? 0).getTime()
    return ta - tb
  })

  const buckets = Array.from({ length: count }, () => [])
  const unassigned = []

  for (const o of sorted) {
    const id = String(o.id)
    const ov = overrides[id]
    if (ov?.pony) {
      const idx = LETTERS.indexOf(String(ov.pony).toUpperCase())
      if (idx >= 0 && idx < count) {
        buckets[idx].push({ ordine: o, manual: ov.manual === true })
        continue
      }
    }
    unassigned.push(o)
  }

  // Round-robin su pony con meno carico
  for (const o of unassigned) {
    let minI = 0
    for (let i = 1; i < count; i += 1) {
      if (buckets[i].length < buckets[minI].length) minI = i
    }
    buckets[minI].push({ ordine: o, manual: false })
  }

  const rows = []
  for (let i = 0; i < count; i += 1) {
    const letter = ponyLetterAt(i)
    buckets[i].forEach((entry, seqIdx) => {
      rows.push({
        ordine: entry.ordine,
        ponyLetter: letter,
        seq: seqIdx + 1,
        label: `${letter}/${seqIdx + 1}`,
        manual: entry.manual === true,
        arrowDir: i % 2 === 0 ? "down" : "up",
      })
    })
  }
  return rows
}

/**
 * Bucket per pony inclusivi anche se vuoti (CA-14: mostra tutti i pony del giorno).
 * @returns {{ letter: string, items: object[] }[]}
 */
export function ponyBucketsWithEmpty(deliveryOrdini, ponyCount, overrides = {}) {
  const count = Math.max(1, ponyCount || 1)
  const assigned = assignDeliveriesToPonies(deliveryOrdini, count, overrides)
  const buckets = Array.from({ length: count }, (_, i) => ({
    letter: ponyLetterAt(i),
    items: [],
  }))
  for (const a of assigned) {
    const idx = LETTERS.indexOf(a.ponyLetter)
    if (idx >= 0 && idx < count) buckets[idx].items.push(a)
  }
  return buckets
}

/** Carico consegne per pony sull’intera giornata (tutte le fasce). */
export function ponyDayLoadSummary(slotRows, ponyCount, overrides = {}) {
  const count = Math.max(1, ponyCount || 1)
  const totals = Array.from({ length: count }, (_, i) => ({
    letter: ponyLetterAt(i),
    consegne: 0,
  }))
  for (const row of slotRows || []) {
    const list = (row.deliveryOrdiniList || []).filter((o) => o && !o._skip)
    const assigned = assignDeliveriesToPonies(list, count, overrides)
    for (const a of assigned) {
      const idx = LETTERS.indexOf(a.ponyLetter)
      if (idx >= 0 && idx < count) totals[idx].consegne += 1
    }
  }
  return totals
}

/**
 * Sposta ordine a pony adiacente (up = letter precedente, down = successiva).
 * @param {string} [currentLetter] — lettera già assegnata in UI (round-robin); se manca usa override o A.
 */
export function moveOrdinePony(overrides, ordineId, ponyCount, direction, currentLetter) {
  const count = Math.max(1, ponyCount || 1)
  const id = String(ordineId)
  const from =
    (currentLetter && String(currentLetter).toUpperCase()) ||
    overrides[id]?.pony ||
    "A"
  let idx = LETTERS.indexOf(String(from).toUpperCase())
  if (idx < 0) idx = 0
  if (direction === "up") idx = Math.max(0, idx - 1)
  else idx = Math.min(count - 1, idx + 1)
  return {
    ...overrides,
    [id]: { pony: ponyLetterAt(idx), manual: true },
  }
}

export function isOrdinePonyManual(ordineId, overrides = {}) {
  return overrides[String(ordineId)]?.manual === true
}
