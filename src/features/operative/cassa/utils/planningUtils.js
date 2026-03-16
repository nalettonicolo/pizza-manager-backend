/**
 * Utility per il planning fasce orarie in Cassa.
 * Fasce basate su orari di apertura/chiusura (orari_settimana).
 * Allineato ai parametri: consegne_ogni_min, ritiro_ogni_min, pizze_ogni_15_min, soglia_giallo_pizze.
 */

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

/** Restituisce l'inizio della fascia (timestamp) che contiene la data data. */
export function slotKeyForDate(date, slotMinutes) {
  if (!slotMinutes || slotMinutes < 1) slotMinutes = 15
  const d = new Date(date)
  const t = d.getTime()
  const slotMs = slotMinutes * 60 * 1000
  return Math.floor(t / slotMs) * slotMs
}

/**
 * Genera fasce orarie nell'intervallo di apertura (da apertura a chiusura).
 * Se siamo oltre l'orario di chiusura restituisce [] (nessuna disponibilità).
 * orariOggi: { aperto, apertura, chiusura } da getTodayOrari().
 */
export function buildSlotsInOpeningHours(slotMinutes, orariOggi, count = 24) {
  if (!slotMinutes || slotMinutes < 1) slotMinutes = 15
  if (!orariOggi?.aperto) return []
  const now = new Date()
  const startMin = timeToMinutes(orariOggi.apertura)
  const endMin = timeToMinutes(orariOggi.chiusura)
  const nowMin = now.getHours() * 60 + now.getMinutes()
  if (nowMin >= endMin) return [] // oltre chiusura: nessuna disponibilità
  const firstSlotStartMin = Math.ceil(nowMin / slotMinutes) * slotMinutes
  let slotStartMin = Math.max(firstSlotStartMin, startMin)
  if (slotStartMin >= endMin) return []
  const slots = []
  for (let i = 0; i < count; i++) {
    if (slotStartMin >= endMin) break
    const d = new Date(now)
    d.setHours(Math.floor(slotStartMin / 60), slotStartMin % 60, 0, 0)
    slots.push({
      key: d.getTime(),
      label: d.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }),
      date: new Date(d),
    })
    slotStartMin += slotMinutes
  }
  return slots
}

/**
 * Genera tutte le caselle da apertura a chiusura (fino a mezzanotte).
 * Per il planning lato cassa: griglia completa della giornata.
 * orariOggi: { aperto, apertura, chiusura }. Chiusura 00:00 = fine giornata (24:00).
 */
export function buildSlotsFullDay(slotMinutes, orariOggi) {
  if (!slotMinutes || slotMinutes < 1) slotMinutes = 15
  if (!orariOggi?.aperto) return []
  const now = new Date()
  const startMin = timeToMinutes(orariOggi.apertura)
  let endMin = endMinutesForDay(orariOggi.chiusura)
  if (endMin <= startMin) endMin += 24 * 60
  const slots = []
  let slotStartMin = startMin
  while (slotStartMin < endMin) {
    const h = Math.floor(slotStartMin / 60) % 24
    const min = slotStartMin % 60
    const d = new Date(now)
    d.setHours(h, min, 0, 0)
    slots.push({
      key: d.getTime(),
      label: d.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }),
      date: new Date(d),
    })
    slotStartMin += slotMinutes
  }
  return slots
}

/** Genera fasce a partire da "adesso" (per backward compat, senza orari). */
export function buildPlanningSlots(slotMinutes, count = 12) {
  if (!slotMinutes || slotMinutes < 1) slotMinutes = 15
  const now = new Date()
  const startMs = slotKeyForDate(now, slotMinutes)
  const slots = []
  for (let i = 0; i < count; i++) {
    const t = new Date(startMs + i * slotMinutes * 60 * 1000)
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
