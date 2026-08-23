/**
 * Assegnazione pony (A/B/…) alle consegne del planning cassa.
 * Override manuali in localStorage per tenant+giorno.
 *
 * Auto (stesso civico):
 * - riempie bauletti (capienza admin) preferendo giri pieni;
 * - può spezzare un ordine grosso su più pony (es. 17 → 12+5);
 * - l’ordine piccolo si combina col residuo solo se gli orari rientrano
 *   nella finestra (`consegne_ogni_min`, default 15).
 */

const LETTERS = "ABCDEFGH"

/** Capienza bauletto di default (pizze/giro) se admin non ha impostato `capienza_bauletto`. */
export const DEFAULT_BAULETTO_CAP = 12

/** Finestra minuti entro cui due orari sullo stesso civico possono condividere il giro. */
export const DEFAULT_COMBINE_WINDOW_MIN = 15

/** Legge `parametri_operativi.capienza_bauletto` (admin tenant). */
export function baulettoCapFromParametri(parametri) {
  const n = Number(parametri?.capienza_bauletto)
  if (Number.isFinite(n) && n >= 1) return Math.min(99, Math.floor(n))
  return DEFAULT_BAULETTO_CAP
}

/** Finestra combinazione da `consegne_ogni_min` (tempi stabiliti consegna). */
export function combineWindowFromParametri(parametri) {
  const n = Number(parametri?.consegne_ogni_min)
  if (Number.isFinite(n) && n >= 0) return Math.min(120, Math.floor(n))
  return DEFAULT_COMBINE_WINDOW_MIN
}

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

function addressKey(o) {
  const raw = String(o?.indirizzo_consegna ?? o?.indirizzoConsegna ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
  if (raw) return raw
  return `__id_${o?.id ?? Math.random()}`
}

function pizzeOf(o, pizzePerOrdine) {
  if (!o?.id) return 0
  const n = Number(pizzePerOrdine?.[o.id] ?? pizzePerOrdine?.[String(o.id)] ?? 0)
  return Number.isFinite(n) && n > 0 ? n : 0
}

function createdMs(o) {
  return new Date(o?.createdAt ?? o?.created_at ?? 0).getTime() || 0
}

/** Minuti da mezzanotte da orario_ritiro HH:mm (o ISO). */
export function orarioRitiroToMinutes(o) {
  const raw = o?.orario_ritiro ?? o?.orarioRitiro ?? ""
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    return raw.getHours() * 60 + raw.getMinutes()
  }
  const s = String(raw || "")
    .trim()
    .replace(/\./g, ":")
  if (!s) return null
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const d = new Date(s)
    if (!Number.isNaN(d.getTime())) return d.getHours() * 60 + d.getMinutes()
  }
  const m = s.match(/^(\d{1,2}):(\d{2})/)
  if (!m) return null
  return Number(m[1]) * 60 + Number(m[2])
}

/**
 * Due (o più) ordini sono combinabili sullo stesso giro se gli orari
 * rientrano nella finestra (tempi stabiliti consegna).
 */
export function ordersWithinCombineWindow(orders, windowMin = DEFAULT_COMBINE_WINDOW_MIN) {
  const mins = (orders || []).map(orarioRitiroToMinutes).filter((n) => n != null && Number.isFinite(n))
  if (mins.length <= 1) return true
  const span = Math.max(...mins) - Math.min(...mins)
  return span <= Math.max(0, Number(windowMin) || 0)
}

function pushShare(buckets, loadPizze, ponyIdx, ordine, pz, manual = false, split = false) {
  if (pz <= 0) return
  buckets[ponyIdx].push({
    ordine,
    manual,
    pzShare: pz,
    split,
  })
  loadPizze[ponyIdx] += pz
}

function emptyPonyIndex(loadPizze, baulettoCap) {
  let best = -1
  for (let i = 0; i < loadPizze.length; i += 1) {
    if (loadPizze[i] >= baulettoCap) continue
    if (best < 0 || loadPizze[i] < loadPizze[best]) best = i
  }
  if (best >= 0) return best
  let fallback = 0
  for (let i = 1; i < loadPizze.length; i += 1) {
    if (loadPizze[i] < loadPizze[fallback]) fallback = i
  }
  return fallback
}

function emptyPonyFromHigh(loadPizze, baulettoCap) {
  for (let i = loadPizze.length - 1; i >= 0; i -= 1) {
    if (loadPizze[i] === 0) return i
  }
  return emptyPonyIndex(loadPizze, baulettoCap)
}

function emptyPonyFromLow(loadPizze, baulettoCap) {
  for (let i = 0; i < loadPizze.length; i += 1) {
    if (loadPizze[i] < baulettoCap) return i
  }
  return emptyPonyIndex(loadPizze, baulettoCap)
}

/**
 * Riempie bauletti sullo stesso civico:
 * 1) i giri “pieni” (capienza) dal pezzo più grosso → pony alti (B, C…) aiutano;
 * 2) residuo del grosso → pony bassi (A);
 * 3) ordini piccoli si combinano col residuo SOLO se entro i tempi stabiliti;
 *    altrimenti NON si assegnano in automatico (restano da prendere a mano / ⚙).
 */
function packSameAddressGroup(orders, buckets, loadPizze, baulettoCap, pizzePerOrdine, combineWindowMin) {
  const pieces = orders
    .map((o) => ({
      ordine: o,
      left: pizzeOf(o, pizzePerOrdine),
      total: pizzeOf(o, pizzePerOrdine),
    }))
    .filter((p) => p.left > 0)
    .sort((a, b) => b.left - a.left || createdMs(a.ordine) - createdMs(b.ordine))

  if (!pieces.length) return

  const anchor = pieces[0] // pezzo più grosso = riferimento orario del giro

  // 1) Estrai bauletti pieni dal pezzo più grosso → pony B/C (indici alti)
  while (true) {
    const big = pieces.find((p) => p.left >= baulettoCap)
    if (!big) break
    const ponyIdx = emptyPonyFromHigh(loadPizze, baulettoCap)
    const space = Math.max(0, baulettoCap - loadPizze[ponyIdx])
    // `space || baulettoCap` era un bug: quando tutti i pony sono già al limite (più grossi
    // ordini che capienza flotta), emptyPonyFromHigh ripiega su un pony già pieno, `space`
    // diventa 0 — ma essendo 0 "falsy" in JS, `0 || baulettoCap` tornava un bauletto INTERO
    // invece di 0, sovraccaricando quel pony invece di fermarsi (la guardia `take <= 0 break`
    // sotto esiste apposta per questo caso e veniva silenziosamente aggirata).
    const take = Math.min(big.left, space)
    if (take <= 0) break
    pushShare(buckets, loadPizze, ponyIdx, big.ordine, take, false, take < big.total)
    big.left -= take
  }

  // 2) Residuo del/dei pezzi grandi (già spezzati): sempre in automatico
  const largeLeftovers = pieces.filter((p) => p.left > 0 && p.total >= baulettoCap)
  for (const p of largeLeftovers) {
    if (p.left <= 0) continue
    const ponyIdx = emptyPonyFromLow(loadPizze, baulettoCap)
    pushShare(buckets, loadPizze, ponyIdx, p.ordine, p.left, false, p.left < p.total)
    p.left = 0
  }

  // Anche pezzi medi/grandi sotto la capienza ma che sono l'anchor (un solo ordine grosso < cap)
  for (const p of pieces) {
    if (p.left <= 0) continue
    if (p === anchor || p.total >= baulettoCap) {
      const ponyIdx = emptyPonyFromLow(loadPizze, baulettoCap)
      pushShare(buckets, loadPizze, ponyIdx, p.ordine, p.left, false, p.left < p.total)
      p.left = 0
    }
  }

  // 3) Pezzi piccoli: solo se entro i tempi rispetto all'anchor; altrimenti niente auto
  const smalls = pieces.filter((p) => p.left > 0)
  for (const p of smalls) {
    const inTime = ordersWithinCombineWindow([anchor.ordine, p.ordine], combineWindowMin)
    if (!inTime) {
      // Non si prende in automatico se i tempi stabiliti sono attivi e non combina
      p.left = 0
      continue
    }
    const ponyIdx = emptyPonyFromLow(loadPizze, baulettoCap)
    let room = Math.max(0, baulettoCap - loadPizze[ponyIdx])
    if (room <= 0) {
      // Bauletti pieni: non forzare il piccolo in automatico
      p.left = 0
      continue
    }
    const take = Math.min(p.left, room)
    pushShare(buckets, loadPizze, ponyIdx, p.ordine, take, false, take < p.total)
    p.left -= take
    // eventuale residuo del piccolo (oltre cap) non auto
    p.left = 0
  }
}

/**
 * Assegna consegne a pony.
 *
 * @param {object[]} deliveryOrdini
 * @param {number} ponyCount
 * @param {Record<string, { pony?: string, manual?: boolean }>} overrides
 * @param {{ pizzePerOrdine?: Record<string, number>, baulettoCap?: number, combineWindowMin?: number }} [opts]
 */
export function assignDeliveriesToPonies(deliveryOrdini, ponyCount, overrides = {}, opts = {}) {
  const count = Math.max(1, ponyCount || 1)
  const pizzePerOrdine = opts.pizzePerOrdine || {}
  const baulettoCap = Math.max(
    1,
    Number(opts.baulettoCap) > 0 ? Number(opts.baulettoCap) : DEFAULT_BAULETTO_CAP,
  )
  const combineWindowMin =
    opts.combineWindowMin != null && Number.isFinite(Number(opts.combineWindowMin))
      ? Math.max(0, Number(opts.combineWindowMin))
      : DEFAULT_COMBINE_WINDOW_MIN

  const sorted = [...(deliveryOrdini || [])].sort((a, b) => createdMs(a) - createdMs(b))

  const buckets = Array.from({ length: count }, () => [])
  const loadPizze = Array.from({ length: count }, () => 0)
  const unassigned = []

  for (const o of sorted) {
    const id = String(o.id)
    const ov = overrides[id]
    if (ov?.pony) {
      const idx = LETTERS.indexOf(String(ov.pony).toUpperCase())
      if (idx >= 0 && idx < count) {
        const pz = pizzeOf(o, pizzePerOrdine)
        pushShare(buckets, loadPizze, idx, o, pz || 0, ov.manual === true, false)
        continue
      }
    }
    unassigned.push(o)
  }

  const groupsMap = new Map()
  for (const o of unassigned) {
    const key = addressKey(o)
    if (!groupsMap.has(key)) {
      groupsMap.set(key, { orders: [], pizze: 0, earliest: createdMs(o) })
    }
    const g = groupsMap.get(key)
    g.orders.push(o)
    g.pizze += pizzeOf(o, pizzePerOrdine)
    g.earliest = Math.min(g.earliest, createdMs(o))
  }

  const groups = [...groupsMap.values()].sort((a, b) => {
    if (b.pizze !== a.pizze) return b.pizze - a.pizze
    return a.earliest - b.earliest
  })

  for (const g of groups) {
    packSameAddressGroup(g.orders, buckets, loadPizze, baulettoCap, pizzePerOrdine, combineWindowMin)
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
        pzShare: entry.pzShare,
        split: entry.split === true,
      })
    })
  }
  return rows
}

/**
 * Bucket per pony inclusivi anche se vuoti (CA-14: mostra tutti i pony del giorno).
 * @returns {{ letter: string, items: object[] }[]}
 */
export function ponyBucketsWithEmpty(deliveryOrdini, ponyCount, overrides = {}, opts = {}) {
  const count = Math.max(1, ponyCount || 1)
  const assigned = assignDeliveriesToPonies(deliveryOrdini, count, overrides, opts)
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
export function ponyDayLoadSummary(slotRows, ponyCount, overrides = {}, opts = {}) {
  const count = Math.max(1, ponyCount || 1)
  const totals = Array.from({ length: count }, (_, i) => ({
    letter: ponyLetterAt(i),
    consegne: 0,
    pizze: 0,
  }))
  const pizzePerOrdine = opts.pizzePerOrdine || {}
  for (const row of slotRows || []) {
    const list = (row.deliveryOrdiniList || []).filter((o) => o && !o._skip)
    const assigned = assignDeliveriesToPonies(list, count, overrides, opts)
    for (const a of assigned) {
      const idx = LETTERS.indexOf(a.ponyLetter)
      if (idx >= 0 && idx < count) {
        totals[idx].consegne += 1
        const share =
          a.pzShare != null && Number.isFinite(Number(a.pzShare))
            ? Number(a.pzShare)
            : pizzeOf(a.ordine, pizzePerOrdine)
        totals[idx].pizze += share
      }
    }
  }
  return totals
}

/**
 * Sposta ordine a pony adiacente (up = letter precedente, down = successiva).
 * @param {string} [currentLetter] — lettera già assegnata in UI; se manca usa override o A.
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
