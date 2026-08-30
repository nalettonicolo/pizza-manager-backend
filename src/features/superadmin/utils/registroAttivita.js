export const REGISTRO_AREA_LABEL = {
  sicurezza: "Sicurezza",
  pagamenti: "Pagamenti",
  audit: "Audit",
  ai: "AI",
  ui: "Interfaccia",
  dati: "Dati",
  infrastruttura: "Infrastruttura",
  marketing: "Marketing",
  menu: "Menu",
  bug: "Bug",
}

export const REGISTRO_FONTE_LABEL = {
  cursor: "Cursor",
  claude: "Claude",
  umano: "Nota tua",
  sistema: "Sistema",
}

export const REGISTRO_STATO_LABEL = {
  completato: "Completato",
  parziale: "Parziale",
  bloccato: "Bloccato",
}

export function dayKeyFromIso(iso) {
  if (!iso) return ""
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

export function formatRegistroDayLabel(dayKey, now = new Date()) {
  if (!dayKey) return ""
  const todayKey = dayKeyFromIso(now.toISOString())
  const yest = new Date(now)
  yest.setDate(yest.getDate() - 1)
  const yestKey = dayKeyFromIso(yest.toISOString())
  if (dayKey === todayKey) return "Oggi"
  if (dayKey === yestKey) return "Ieri"
  const [y, m, d] = dayKey.split("-").map(Number)
  return new Date(y, m - 1, d).toLocaleDateString("it-IT", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}

export function filterRegistroRighe(righe, { query = "", area = "", fonte = "", stato = "", period = "all" } = {}, now = Date.now()) {
  const q = String(query || "").trim().toLowerCase()
  const cutoff =
    period === "24h"
      ? now - 24 * 60 * 60 * 1000
      : period === "7d"
        ? now - 7 * 24 * 60 * 60 * 1000
        : null
  return (righe || []).filter((r) => {
    if (area && r.area !== area) return false
    if (fonte && (r.fonte || "") !== fonte) return false
    if (stato && (r.stato || "") !== stato) return false
    if (cutoff != null) {
      const t = new Date(r.creato_il).getTime()
      if (!Number.isFinite(t) || t < cutoff) return false
    }
    if (!q) return true
    const blob = `${r.richiesta || ""} ${r.azioni || ""} ${r.branch || ""} ${r.pr_url || ""}`.toLowerCase()
    return blob.includes(q)
  })
}

export function groupRegistroByDay(righe) {
  const map = new Map()
  for (const r of righe || []) {
    const key = dayKeyFromIso(r.creato_il) || "sconosciuto"
    if (!map.has(key)) map.set(key, [])
    map.get(key).push(r)
  }
  return Array.from(map.entries()).map(([day, items]) => ({ day, items }))
}

export function computeRegistroMonitor(righe, now = Date.now()) {
  const list = righe || []
  const ultima = list[0] || null
  const tUltima = ultima?.creato_il ? new Date(ultima.creato_il).getTime() : null
  const oreSilenzio =
    tUltima != null && Number.isFinite(tUltima) ? (now - tUltima) / (60 * 60 * 1000) : null
  const cutoff24 = now - 24 * 60 * 60 * 1000
  const ultime24h = list.filter((r) => {
    const t = new Date(r.creato_il).getTime()
    return Number.isFinite(t) && t >= cutoff24
  })
  return {
    totale: list.length,
    ultime24h: ultime24h.length,
    completati: list.filter((r) => r.stato === "completato").length,
    parziali: list.filter((r) => r.stato === "parziale").length,
    bloccati: list.filter((r) => r.stato === "bloccato").length,
    oreSilenzio,
    silenzioLungo: oreSilenzio == null ? list.length === 0 : oreSilenzio >= 24,
    ultima,
  }
}
