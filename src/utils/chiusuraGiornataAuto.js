import { getTodayOrari } from "@/features/operative/cassa/utils/planningUtils"

function timeToMinutes(str) {
  if (!str || typeof str !== "string") return 0
  const [h, m] = str.trim().split(":").map(Number)
  return (h || 0) * 60 + (m || 0)
}

/**
 * Momento locale in cui eseguire la chiusura giornata automatica (solo logica orario).
 * - Se la chiusura del locale è `00:00` (fine giornata), chiudi alle 23:59 dello stesso giorno.
 * - Altrimenti: un’ora dopo l’orario di chiusura indicato per oggi.
 */
export function computeAutoChiusuraGiornataDate(orariSettimana) {
  const orari = getTodayOrari(orariSettimana)
  if (!orari.aperto) return null
  const ch = orari.chiusura || "23:59"
  const m = timeToMinutes(ch)
  const d = new Date()
  if (m === 0) {
    d.setHours(23, 59, 0, 0)
    return d
  }
  const h = Math.floor(m / 60) % 24
  const min = m % 60
  d.setHours(h, min, 0, 0)
  d.setTime(d.getTime() + 60 * 60 * 1000)
  return d
}
