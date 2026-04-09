/**
 * Utility per il planning fasce orarie in Cassa.
 * Fasce basate su orari di apertura/chiusura (orari_settimana).
 * Griglia fasce: sempre quarti d'ora (:00, :15, :30, :45). I parametri ritiro_ogni_min / consegne_ogni_min
 * servono solo per la capacità (max pizze) in UI, non per l’intervallo tra le etichette orarie.
 */

/** Griglia fissa fasce planning: quarti d'ora. */
export const PLANNING_GRID_SLOT_MINUTES = 15

function snapMinutesToQuarterUp(min) {
  return Math.ceil(min / PLANNING_GRID_SLOT_MINUTES) * PLANNING_GRID_SLOT_MINUTES
}

/** orari_settimana: giorno 0 = Lunedì, ... 6 = Domenica. JS getDay(): 0 = Domenica, 1 = Lun, ... */
const GIORNI = [
  { key: 0, nome: "Lunedì" },
  { key: 1, nome: "Martedì" },
  { key: 2, nome: "Mercoledì" },
  { key: 3, nome: "Giovedì" },
  { key: 4, nome: "Venerdì" },
  { key: 5, nome: "Sabato" },
  { key: 6, nome: "Domenica" },
]

function parseOrari(val) {
  if (!val || !Array.isArray(val)) return null
  const map = new Map((val || []).map((o) => [o.giorno, o]))
  return GIORNI.map((g) => {
    const existing = map.get(g.key) ?? map.get(String(g.key))
    return {
      ...g,
      aperto: existing?.aperto ?? false,
      apertura: existing?.apertura ?? "11:00",
      chiusura: existing?.chiusura ?? "15:00",
      consegnaDiversa: existing?.consegnaDiversa ?? false,
      consegnaDa: existing?.consegnaDa ?? "11:30",
      consegnaA: existing?.consegnaA ?? "14:30",
    }
  })
}

/** Indice giorno per orari_settimana: 0 = Lunedì, 6 = Domenica. */
function getGiornoIndex(date) {
  const d = date || new Date()
  const jsDay = d.getDay() // 0 = Domenica, 1 = Lun, ...
  return (jsDay + 6) % 7 // 0 = Lun, 6 = Dom
}

/** Restituisce orari di oggi { aperto, apertura, chiusura } (stringhe "HH:mm"). */
export function getTodayOrari(orariSettimana) {
  const orari = parseOrari(orariSettimana)
  if (!orari?.length) return { aperto: true, apertura: "00:00", chiusura: "23:59" }
  const idx = getGiornoIndex(new Date())
  const row = orari[idx]
  if (!row) return { aperto: false, apertura: "00:00", chiusura: "00:00" }
  return {
    aperto: row.aperto,
    apertura: row.apertura || "00:00",
    chiusura: row.chiusura || "23:59",
  }
}

/** Converte "HH:mm" in minuti da mezzanotte. 00:00 = 0, 24:00 = 1440. */
function timeToMinutes(str) {
  if (!str || typeof str !== "string") return 0
  const [h, m] = str.trim().split(":").map(Number)
  const mins = (h || 0) * 60 + (m || 0)
  if (mins === 0 && (h || 0) === 0) return 0
  return mins
}

/** Minuti di fine giornata: se chiusura è 00:00 consideriamo mezzanotte = 24*60. */
function endMinutesForDay(chiusuraStr) {
  const m = timeToMinutes(chiusuraStr)
  return m === 0 ? 24 * 60 : m
}

/**
 * Ultimo minuto di inizio fascia consentito rispetto a "chiusura" (HH:mm).
 * Chiusura 15:00 = l'ultimo slot può iniziare alle 15:00 (non fermarsi a 14:45).
 * Sentinella mezzanotte (1440 da 00:00): niente fascia che parte a "24:00" — ultimo slot ~23:45.
 */
function lastSlotStartInclusive(endMinTotal, slotMinutes) {
  if (!slotMinutes || slotMinutes < 1) slotMinutes = 15
  if (endMinTotal >= 24 * 60) return endMinTotal - slotMinutes
  return endMinTotal
}

/**
 * Inizio fascia (timestamp locale) contenente `date`.
 * Allineato ai minuti della giornata (come buildSlotsInOpeningHours / buildSlotsFullDay).
 * La versione precedente usava l’epoch UTC: griglia sfasata → etichette tipo :36, :51 invece di :00, :15, :30, :45.
 */
export function slotKeyForDate(date, slotMinutes) {
  const grid = PLANNING_GRID_SLOT_MINUTES
  if (!slotMinutes || slotMinutes < 1) slotMinutes = grid
  const d = new Date(date)
  const y = d.getFullYear()
  const mo = d.getMonth()
  const day = d.getDate()
  const minsIntoDay = d.getHours() * 60 + d.getMinutes()
  const slotStartMin = Math.floor(minsIntoDay / grid) * grid
  const out = new Date(y, mo, day, 0, 0, 0, 0)
  out.setMinutes(slotStartMin)
  return out.getTime()
}

/**
 * Fasce sullo stesso giorno da slotStartMin (incluso) fino a endMinTotale (es. 24*60 = mezzanotte).
 */
function buildSlotsSameDayRange(now, slotStartMin, endMinTotale, count) {
  const grid = PLANNING_GRID_SLOT_MINUTES
  const lastStart = lastSlotStartInclusive(endMinTotale, grid)
  if (slotStartMin > lastStart) return []
  const slots = []
  let m = slotStartMin
  for (let i = 0; i < count; i++) {
    if (m > lastStart) break
    const d = new Date(now)
    d.setHours(Math.floor(m / 60), m % 60, 0, 0)
    slots.push({
      key: d.getTime(),
      label: d.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }),
      date: new Date(d),
    })
    m += grid
  }
  return slots
}

/**
 * Genera fasce orarie nell'intervallo di apertura (da apertura a chiusura).
 * Se siamo oltre l'orario di chiusura restituisce [] (nessuna disponibilità).
 * orariOggi: { aperto, apertura, chiusura } da getTodayOrari().
 *
 * @param {{ staffOverrideClosing?: boolean }} [options] — In cassa: consente fasce dopo la chiusura (fino a fine giornata)
 * e, se il giorno è chiuso in calendario, comunque slot da “ora” per inserimenti operativi.
 */
export function buildSlotsInOpeningHours(orariOggi, count = 24, options = {}) {
  const staffOverrideClosing = options.staffOverrideClosing === true
  const grid = PLANNING_GRID_SLOT_MINUTES
  const now = new Date()
  const nowMin = now.getHours() * 60 + now.getMinutes()

  if (!orariOggi) return []

  // Cassa: giorno “chiuso” in calendario → slot da ora a 23:45 (ordini operativi)
  if (staffOverrideClosing && !orariOggi.aperto) {
    return buildSlotsSameDayRange(now, snapMinutesToQuarterUp(nowMin), 24 * 60, count)
  }

  if (!orariOggi.aperto) return []

  const startMin = timeToMinutes(orariOggi.apertura)
  const endMin = timeToMinutes(orariOggi.chiusura)
  const lastStart = lastSlotStartInclusive(endMin, grid)

  // Cassa: oltre l’orario di chiusura configurato → estendi fino a fine giornata (stesso giorno solare)
  if (staffOverrideClosing && nowMin >= endMin) {
    return buildSlotsSameDayRange(now, snapMinutesToQuarterUp(nowMin), 24 * 60, count)
  }

  if (nowMin >= endMin) return [] // oltre chiusura: nessuna disponibilità (cliente / flusso standard)
  const firstSlotStartMin = snapMinutesToQuarterUp(nowMin)
  const firstAfterOpening = snapMinutesToQuarterUp(startMin)
  let slotStartMin = Math.max(firstSlotStartMin, firstAfterOpening)
  if (slotStartMin > lastStart) return []
  const slots = []
  for (let i = 0; i < count; i++) {
    if (slotStartMin > lastStart) break
    const d = new Date(now)
    d.setHours(Math.floor(slotStartMin / 60), slotStartMin % 60, 0, 0)
    slots.push({
      key: d.getTime(),
      label: d.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }),
      date: new Date(d),
    })
    slotStartMin += grid
  }
  return slots
}

/**
 * Genera tutte le caselle da apertura a chiusura (fino a mezzanotte).
 * Per il planning lato cassa: griglia completa della giornata.
 * orariOggi: { aperto, apertura, chiusura }. Chiusura 00:00 = fine giornata (24:00).
 */
export function buildSlotsFullDay(orariOggi) {
  const grid = PLANNING_GRID_SLOT_MINUTES
  if (!orariOggi?.aperto) return []
  const now = new Date()
  const startMin = timeToMinutes(orariOggi.apertura)
  let endMin = endMinutesForDay(orariOggi.chiusura)
  if (endMin <= startMin) endMin += 24 * 60
  const lastStart = lastSlotStartInclusive(endMin, grid)
  const slots = []
  let slotStartMin = snapMinutesToQuarterUp(startMin)
  let guard = 0
  while (slotStartMin <= lastStart && guard < 200) {
    guard += 1
    const h = Math.floor(slotStartMin / 60) % 24
    const min = slotStartMin % 60
    const d = new Date(now)
    d.setHours(h, min, 0, 0)
    slots.push({
      key: d.getTime(),
      label: d.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }),
      date: new Date(d),
    })
    slotStartMin += grid
  }
  return slots
}

/**
 * Vetrina web: non si accetta la consegna nel quarto d’ora immediatamente successivo a quello corrente
 * (minimo due intervalli da “ora”: fine fascia corrente + 1 fascia di buffer).
 */
export function minSlotStartMinutesWebDelivery(now) {
  const grid = PLANNING_GRID_SLOT_MINUTES
  const d = now instanceof Date ? now : new Date(now)
  const nowMin = d.getHours() * 60 + d.getMinutes()
  const nowSlotStart = Math.floor(nowMin / grid) * grid
  return nowSlotStart + 2 * grid
}

export function filterSlotsWebDeliveryLeadTime(slots, nowDate) {
  if (!Array.isArray(slots) || !slots.length) return []
  const minM = minSlotStartMinutesWebDelivery(nowDate)
  return slots.filter((s) => {
    const dt = s.date instanceof Date ? s.date : new Date(s.date)
    const sm = dt.getHours() * 60 + dt.getMinutes()
    return sm >= minM
  })
}

/**
 * Opzioni filtro vetrina (parametri_operativi), personalizzabili da Admin → Parametri.
 * @typedef {{ enabled: boolean, endHour: number, minute: number }} WebVetrinaQuarterFilter
 */

/**
 * Legge la regola “solo un quarto d’ora” per il checkout consegna web.
 * Default: attivo, ora fine 15, minuto 45 (comportamento precedente).
 */
export function getWebVetrinaSlotQuarterFilter(parametri) {
  const po = parametri && typeof parametri === "object" ? parametri : {}
  const enabled = po.vetrina_consegna_filtro_quarto_attivo !== false
  let endHour = Number(po.vetrina_consegna_filtro_quarto_ora_fine)
  if (!Number.isFinite(endHour)) endHour = 15
  endHour = Math.min(23, Math.max(0, Math.floor(endHour)))
  let minute = Number(po.vetrina_consegna_filtro_quarto_minuto)
  if (![0, 15, 30, 45].includes(minute)) minute = 45
  return { enabled, endHour, minute }
}

/** @deprecated Usare {@link getWebVetrinaSlotQuarterFilter}; mantenuto per compatibilità lettura. */
export const WEB_DELIVERY_MORNING_RULE_END_HOUR = 15

/**
 * Vetrina web (consegna): se attivo in parametri, fino a `endHour` (esclusa) mostra solo slot con `minute` scelto
 * (dopo lead-time). Dopo `endHour` valgono tutti i quarti. Non sostituisce il lead-time.
 * @param {unknown} parametri — `parametri_operativi` tenant (anche parziale)
 */
export function filterSlotsWebDeliveryVetrinaQuarter(slots, nowDate, parametri) {
  if (!Array.isArray(slots) || !slots.length) return []
  const { enabled, endHour, minute } = getWebVetrinaSlotQuarterFilter(parametri)
  if (!enabled) return slots
  const d = nowDate instanceof Date ? nowDate : new Date(nowDate)
  if (d.getHours() >= endHour) return slots
  return slots.filter((s) => {
    const dt = s.date instanceof Date ? s.date : new Date(s.date)
    return dt.getMinutes() === minute
  })
}

/** @deprecated Usare {@link filterSlotsWebDeliveryVetrinaQuarter} con parametri tenant. */
export function filterSlotsWebDeliveryMorning45Only(slots, nowDate) {
  return filterSlotsWebDeliveryVetrinaQuarter(slots, nowDate, {})
}

export function isSlotAllowedForWebDelivery(slotDate, nowDate) {
  if (!slotDate) return false
  const minM = minSlotStartMinutesWebDelivery(nowDate)
  const dt = slotDate instanceof Date ? slotDate : new Date(slotDate)
  const sm = dt.getHours() * 60 + dt.getMinutes()
  return sm >= minM
}

/** Lead-time + regola quarti vetrina (stessa logica di {@link filterSlotsWebDeliveryVetrinaQuarter}). */
export function isSlotAllowedForWebDeliveryFull(slotDate, nowDate, parametri) {
  if (!isSlotAllowedForWebDelivery(slotDate, nowDate)) return false
  const { enabled, endHour, minute } = getWebVetrinaSlotQuarterFilter(parametri)
  if (!enabled) return true
  const now = nowDate instanceof Date ? nowDate : new Date(nowDate)
  if (now.getHours() >= endHour) return true
  const dt = slotDate instanceof Date ? slotDate : new Date(slotDate)
  return dt.getMinutes() === minute
}

/** Genera fasce a partire da "adesso" (per backward compat, senza orari). */
export function buildPlanningSlots(slotMinutes, count = 12) {
  const grid = PLANNING_GRID_SLOT_MINUTES
  void slotMinutes
  const now = new Date()
  const startMs = slotKeyForDate(now, grid)
  const slots = []
  for (let i = 0; i < count; i++) {
    const t = new Date(startMs + i * grid * 60 * 1000)
    slots.push({
      key: t.getTime(),
      label: t.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }),
      date: new Date(t),
    })
  }
  return slots
}

/** Colore fascia in base a numero ordini/pizze (verde / giallo / rosso). */
export function slotColor(count, maxPerSlot, sogliaGiallo) {
  if (maxPerSlot <= 0) return "#e8f5e9"
  if (count >= maxPerSlot) return "#ffcdd2"
  if (count >= maxPerSlot - sogliaGiallo) return "#fff9c4"
  return "#c8e6c9"
}

/** Raggruppa ordini per fascia (usa createdAt o created_at). */
export function groupOrdersBySlot(ordini, slotMinutes) {
  const map = {}
  for (const o of ordini || []) {
    const raw = o.createdAt ?? o.created_at
    if (raw == null) continue
    const key = slotKeyForDate(new Date(raw), slotMinutes)
    map[key] = (map[key] || 0) + 1
  }
  return map
}

/** Raggruppa ordini per fascia usando orario_ritiro (ritiro/consegna a quell'ora). */
export function groupOrdersBySlotOrarioRitiro(ordini, slotMinutes) {
  const map = {}
  for (const o of ordini || []) {
    const key = orarioRitiroToSlotKey(o.orario_ritiro ?? o.orarioRitiro, slotMinutes)
    if (key == null) continue
    map[key] = (map[key] || 0) + 1
  }
  return map
}

/** Restituisce { [slotKey]: ordini[] } per orario_ritiro (per modale planning). */
export function groupOrdiniBySlotOrarioRitiro(ordini, slotMinutes) {
  const map = {}
  for (const o of ordini || []) {
    const key = orarioRitiroToSlotKey(o.orario_ritiro ?? o.orarioRitiro, slotMinutes)
    if (key == null) continue
    if (!map[key]) map[key] = []
    map[key].push(o)
  }
  return map
}

/** Raggruppa pizze per fascia: pizzePerOrdine = { [ordineId]: numeroPizze }. */
export function groupPizzeBySlot(ordini, pizzePerOrdine, slotMinutes) {
  const map = {}
  for (const o of ordini || []) {
    const raw = o.createdAt ?? o.created_at
    if (raw == null) continue
    const key = slotKeyForDate(new Date(raw), slotMinutes)
    const pizze = pizzePerOrdine?.[o.id] ?? 0
    map[key] = (map[key] || 0) + pizze
  }
  return map
}

/** Converte orario_ritiro "HH:mm" nel key della fascia (timestamp inizio fascia, come buildSlotsInOpeningHours). */
function orarioRitiroToSlotKey(orarioRitiroStr, slotMinutes) {
  if (!orarioRitiroStr || typeof orarioRitiroStr !== "string") return null
  const trimmed = orarioRitiroStr.trim()
  const [h, m] = trimmed.split(":").map(Number)
  if (h == null || isNaN(h)) return null
  const now = new Date()
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h || 0, m || 0, 0, 0)
  return slotKeyForDate(d, slotMinutes)
}

/** Raggruppa pizze per fascia usando orario_ritiro (come in Riepilogo: ritiro/consegna a quell'ora). */
export function groupPizzeBySlotOrarioRitiro(ordini, pizzePerOrdine, slotMinutes) {
  const map = {}
  for (const o of ordini || []) {
    const key = orarioRitiroToSlotKey(o.orario_ritiro ?? o.orarioRitiro, slotMinutes)
    if (key == null) continue
    const pizze = pizzePerOrdine?.[o.id] ?? 0
    map[key] = (map[key] || 0) + pizze
  }
  return map
}
