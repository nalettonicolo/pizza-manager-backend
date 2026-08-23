/**
 * Utility per il planning fasce orarie in Cassa.
 * Fasce basate su orari di apertura/chiusura (orari_settimana).
 * Griglia fasce: sempre quarti d'ora (:00, :15, :30, :45). I parametri ritiro_ogni_min / consegne_ogni_min
 * definiscono finestre per etichette “max teorico” per colonna; il colore rosso/giallo/verde in Cassa usa il
 * carico forno cumulativo (somma consegna+ritiro) vs pizze_ogni_15_min sulla griglia (vedi Cassa planning).
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
      pranzoAttivo: existing?.pranzoAttivo ?? false,
      pranzoDa: existing?.pranzoDa ?? "12:00",
      pranzoA: existing?.pranzoA ?? "14:30",
    }
  })
}

/**
 * Fasce del giorno come coppie {apertura, chiusura}, ordinate cronologicamente.
 * Con "aperto anche a pranzo" attivo: due fasce (pranzo + esercizio principale) invece di una —
 * la griglia slot deve saltare il buco di chiusura pomeridiana tra le due, non generare fasce fittizie.
 * Senza pranzo attivo: sempre una sola fascia (comportamento identico a prima, nessuna regressione).
 */
function fasceDelGiorno(row) {
  const principale = { apertura: row?.apertura || "00:00", chiusura: row?.chiusura || "23:59" }
  if (!row?.pranzoAttivo) return [principale]
  const pranzo = { apertura: row.pranzoDa || "12:00", chiusura: row.pranzoA || "14:30" }
  return [pranzo, principale].sort((a, b) => timeToMinutes(a.apertura) - timeToMinutes(b.apertura))
}

/** Indice giorno per orari_settimana: 0 = Lunedì, 6 = Domenica. */
function getGiornoIndex(date) {
  const d = date || new Date()
  const jsDay = d.getDay() // 0 = Domenica, 1 = Lun, ...
  return (jsDay + 6) % 7 // 0 = Lun, 6 = Dom
}

/**
 * Restituisce orari di oggi { aperto, apertura, chiusura, fasce } (stringhe "HH:mm").
 * `apertura`/`chiusura` restano i confini esterni della giornata (prima apertura → ultima chiusura):
 * per un giorno senza pranzo attivo coincidono esattamente con la singola fascia, come prima (nessuna
 * regressione). `fasce` è il dettaglio per-banda usato dalla generazione degli slot, che deve saltare
 * il buco di chiusura pomeridiana quando il pranzo è attivo.
 */
export function getTodayOrari(orariSettimana) {
  const orari = parseOrari(orariSettimana)
  if (!orari?.length) {
    return { aperto: true, apertura: "00:00", chiusura: "23:59", fasce: [{ apertura: "00:00", chiusura: "23:59" }] }
  }
  const idx = getGiornoIndex(new Date())
  const row = orari[idx]
  if (!row) return { aperto: false, apertura: "00:00", chiusura: "00:00", fasce: [{ apertura: "00:00", chiusura: "00:00" }] }
  const fasce = fasceDelGiorno(row)
  return {
    aperto: row.aperto,
    apertura: fasce[0].apertura,
    chiusura: fasce[fasce.length - 1].chiusura,
    fasce,
  }
}

/**
 * Orari per griglia planning consegne: se oggi ha fascia consegna diversa, usa quella;
 * altrimenti apertura→chiusura esercizio.
 * @returns {{ aperto: boolean, apertura: string, chiusura: string, fonte: "consegna"|"apertura" }}
 */
export function getTodayOrariConsegna(orariSettimana) {
  const orari = parseOrari(orariSettimana)
  if (!orari?.length) {
    return { aperto: true, apertura: "00:00", chiusura: "23:59", fonte: "apertura" }
  }
  const idx = getGiornoIndex(new Date())
  const row = orari[idx]
  if (!row) return { aperto: false, apertura: "00:00", chiusura: "00:00", fonte: "apertura" }
  if (row.consegnaDiversa) {
    return {
      aperto: row.aperto,
      apertura: row.consegnaDa || row.apertura || "00:00",
      chiusura: row.consegnaA || row.chiusura || "23:59",
      fonte: "consegna",
    }
  }
  return {
    aperto: row.aperto,
    apertura: row.apertura || "00:00",
    chiusura: row.chiusura || "23:59",
    fonte: "apertura",
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
 * **Checkout pubblico (vetrina web):** non usare questa funzione. Usare
 * {@link buildPublicCheckoutDeliverySlots}, che applica solo gli orari effettivamente disponibili
 * (lead-time + filtro quarti vetrina). Qui, senza `staffOverrideClosing`, valgono solo le fasce da “ora”
 * in poi fino a chiusura (comportamento cliente).
 *
 * @param {{ staffOverrideClosing?: boolean }} [options] — Solo cassa/operativi: tutte le fasce della giornata
 * lavorativa (apertura→chiusura), non solo da “ora”; oltre la chiusura configurata estende fino a fine giornata;
 * se il giorno è chiuso in calendario, slot da “ora” per inserimenti operativi.
 */
export function buildSlotsInOpeningHours(orariOggi, count = 24, options = {}) {
  const staffOverrideClosing = options.staffOverrideClosing === true
  /** Griglia 15 min: al massimo 96 fasce in 24h; la cassa deve vedere l’intera giornata, non solo 24 slot. */
  const staffSlotCap = Math.max(count, 96)
  const grid = PLANNING_GRID_SLOT_MINUTES
  const now = new Date()
  const nowMin = now.getHours() * 60 + now.getMinutes()

  if (!orariOggi) return []

  // Cassa: giorno “chiuso” in calendario → slot da ora a 23:45 (ordini operativi)
  if (staffOverrideClosing && !orariOggi.aperto) {
    return buildSlotsSameDayRange(now, snapMinutesToQuarterUp(nowMin), 24 * 60, staffSlotCap)
  }

  if (!orariOggi.aperto) return []

  const startMin = timeToMinutes(orariOggi.apertura)
  const endMin = timeToMinutes(orariOggi.chiusura)
  const lastStart = lastSlotStartInclusive(endMin, grid)

  // Cassa/operativi: sempre l’intera fascia apertura→chiusura (come buildSlotsFullDay);
  // se già oltre la chiusura configurata, tutta la giornata fino a 23:45 per ordini operativi.
  if (staffOverrideClosing && orariOggi.aperto) {
    const endMd = endMinutesForDay(orariOggi.chiusura)
    const overnight = endMd <= startMin
    if (overnight) {
      return buildSlotsFullDay(orariOggi)
    }
    const pastClosing = endMin !== 0 && nowMin >= endMin
    if (!pastClosing) {
      return buildSlotsFullDay(orariOggi)
    }
    return buildSlotsSameDayRange(now, snapMinutesToQuarterUp(startMin), 24 * 60, staffSlotCap)
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
 * Sempre popolata (anche se oggi è «chiuso» o senza ordini): serve la tabella orari.
 * orariOggi: { aperto, apertura, chiusura }. Chiusura 00:00 = fine giornata (24:00).
 */
function buildFullDaySlotsForBand(band, now) {
  const grid = PLANNING_GRID_SLOT_MINUTES
  const startMin = timeToMinutes(band?.apertura || "11:00")
  let endMin = endMinutesForDay(band?.chiusura || "23:00")
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
 * Genera tutte le caselle da apertura a chiusura (fino a mezzanotte).
 * Per il planning lato cassa: griglia completa della giornata.
 * Sempre popolata (anche se oggi è «chiuso» o senza ordini): serve la tabella orari.
 * orariOggi: { aperto, apertura, chiusura, fasce? }. Chiusura 00:00 = fine giornata (24:00).
 * Con `fasce` multiple (pranzo attivo) genera gli slot di ciascuna banda e salta il buco tra le due
 * (es. 14:45–18:45): non una singola fascia apertura→chiusura come prima del pranzo configurabile.
 */
export function buildSlotsFullDay(orariOggi) {
  const now = new Date()
  const bands = Array.isArray(orariOggi?.fasce) && orariOggi.fasce.length
    ? orariOggi.fasce
    : [{ apertura: orariOggi?.apertura || "11:00", chiusura: orariOggi?.chiusura || "23:00" }]
  const byKey = new Map()
  for (const band of bands) {
    for (const s of buildFullDaySlotsForBand(band, now)) byKey.set(s.key, s)
  }
  return [...byKey.values()].sort((a, b) => a.key - b.key)
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
 * Vetrina web (consegna): se attivo in parametri, le fasce **prima di** `endHour`
 * (es. 15:00) restano solo al minuto scelto (es. :45); dalle `endHour` in poi valgono
 * tutti i quarti. La regola si applica all’orario della **fascia**, non all’orologio
 * di quando apri il checkout. Non sostituisce il lead-time.
 * @param {unknown} parametri — `parametri_operativi` tenant (anche parziale)
 */
export function filterSlotsWebDeliveryVetrinaQuarter(slots, _nowDate, parametri) {
  if (!Array.isArray(slots) || !slots.length) return []
  const { enabled, endHour, minute } = getWebVetrinaSlotQuarterFilter(parametri)
  if (!enabled) return slots
  return slots.filter((s) => {
    const dt = s.date instanceof Date ? s.date : new Date(s.date)
    if (dt.getHours() >= endHour) return true
    return dt.getMinutes() === minute
  })
}

/**
 * Checkout consegna **pubblico** (vetrina): solo slot prenotabili — griglia giornata + lead-time web +
 * regola quarti vetrina. Non usa la logica cassa ({@link buildSlotsInOpeningHours} con `staffOverrideClosing`).
 *
 * @param {{ aperto: boolean, apertura?: string, chiusura?: string }} orariOggi — da {@link getTodayOrari}
 * @param {Date} [nowDate] — default `new Date()`; per test o tick minuto
 */
export function buildPublicCheckoutDeliverySlots(orariOggi, nowDate, parametri) {
  if (!orariOggi?.aperto) return []
  const now = nowDate instanceof Date ? nowDate : new Date(nowDate)
  const po = parametri && typeof parametri === "object" ? parametri : {}
  const all = buildSlotsFullDay(orariOggi)
  const afterLead = filterSlotsWebDeliveryLeadTime(all, now)
  return filterSlotsWebDeliveryVetrinaQuarter(afterLead, now, po)
}

/**
 * Vetrina: giorno chiuso (o non aperto) sul calendario ma ordini dalla web attivi
 * (`parametri_operativi.ordini_online_attivi !== false`). Stesse regole disponibilità del giorno aperto:
 * lead-time web + filtro quarti vetrina, su fasce da “ora” fino a 23:45.
 */
export function buildPublicCheckoutDeliverySlotsClosedCalendar(nowDate, parametri) {
  const now = nowDate instanceof Date ? nowDate : new Date(nowDate)
  const po = parametri && typeof parametri === "object" ? parametri : {}
  const startMin = minSlotStartMinutesWebDelivery(now)
  const raw = buildSlotsSameDayRange(now, startMin, 24 * 60, 96)
  return filterSlotsWebDeliveryVetrinaQuarter(raw, now, po)
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
  const dt = slotDate instanceof Date ? slotDate : new Date(slotDate)
  if (dt.getHours() >= endHour) return true
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
    const key = ordineToSlotKey(o, slotMinutes)
    if (key == null) continue
    map[key] = (map[key] || 0) + 1
  }
  return map
}

/** Restituisce { [slotKey]: ordini[] } per orario_ritiro (per modale planning). */
export function groupOrdiniBySlotOrarioRitiro(ordini, slotMinutes) {
  const map = {}
  for (const o of ordini || []) {
    const key = ordineToSlotKey(o, slotMinutes)
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

/** Converte orario_ritiro "HH:mm" (o varianti / ISO) nel key della fascia (come buildSlotsInOpeningHours). */
export function orarioRitiroToSlotKey(orarioRitiroStr, slotMinutes) {
  if (orarioRitiroStr == null || orarioRitiroStr === "") return null
  if (orarioRitiroStr instanceof Date && !Number.isNaN(orarioRitiroStr.getTime())) {
    return slotKeyForDate(orarioRitiroStr, slotMinutes)
  }
  const raw = String(orarioRitiroStr).trim()
  if (!raw) return null
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
    const parsed = new Date(raw)
    if (!Number.isNaN(parsed.getTime())) return slotKeyForDate(parsed, slotMinutes)
  }
  const trimmed = raw.replace(/\u202f/g, "").replace(/\s/g, "")
  let h
  let m
  const dotOrComma = trimmed.match(/^(\d{1,2})[.:](\d{2})(?::\d{2})?/)
  if (dotOrComma) {
    h = Number(dotOrComma[1])
    m = Number(dotOrComma[2])
  } else {
    const parts = trimmed.split(":").map(Number)
    h = parts[0]
    m = parts[1] ?? 0
  }
  if (h == null || Number.isNaN(h)) return null
  const now = new Date()
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h || 0, m || 0, 0, 0)
  return slotKeyForDate(d, slotMinutes)
}

/** Fascia slot per ordine: orario_ritiro in DB, altrimenti ora creazione (come lista ordini cassa). */
export function ordineToSlotKey(o, slotMinutes) {
  if (!o) return null
  const orario =
    o.orario_ritiro ??
    o.orarioRitiro ??
    o.orario_consegna ??
    o.orarioConsegna ??
    ""
  let key = orarioRitiroToSlotKey(orario, slotMinutes)
  if (key != null) return key
  const raw = o.createdAt ?? o.created_at ?? o.updatedAt ?? o.updated_at
  if (raw == null) return null
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return null
  return slotKeyForDate(d, slotMinutes)
}

/** Raggruppa pizze per fascia usando orario_ritiro (come in Riepilogo: ritiro/consegna a quell'ora). */
export function groupPizzeBySlotOrarioRitiro(ordini, pizzePerOrdine, slotMinutes) {
  const map = {}
  for (const o of ordini || []) {
    const key = ordineToSlotKey(o, slotMinutes)
    if (key == null) continue
    const oid = o.id != null ? String(o.id) : ""
    const pizze = oid ? (pizzePerOrdine?.[oid] ?? pizzePerOrdine?.[o.id] ?? 0) : 0
    map[key] = (map[key] || 0) + pizze
  }
  return map
}
