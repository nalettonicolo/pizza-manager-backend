/**
 * Calcolo ritardo consegne delivery, per badge/evidenziazione in Delivery Dashboard.
 */

import { orarioToMinutes } from "@/features/operative/pizzaiolo/utils/pizzaioloUtils"

/** Soglie (minuti) di ritardo per la severità del badge. */
export const DELIVERY_DELAY_LIEVE_MIN = 5
export const DELIVERY_DELAY_GRAVE_MIN = 15

/**
 * Minuti di ritardo di un ordine rispetto all'orario di ritiro/consegna previsto
 * (`orario_ritiro`), calcolato sull'orario corrente. Negativo/zero = in anticipo o in orario.
 * @param {string|null|undefined} orarioRitiro "HH:MM"
 * @param {Date} [now]
 * @returns {number|null} minuti di ritardo, null se orarioRitiro non è valorizzato/valido
 */
export function minutiRitardoConsegna(orarioRitiro, now = new Date()) {
  const previstoMin = orarioToMinutes(orarioRitiro)
  if (previstoMin == null) return null
  const attualeMin = now.getHours() * 60 + now.getMinutes()
  return attualeMin - previstoMin
}

/**
 * Severità del ritardo per il badge in Delivery Dashboard.
 * @param {number|null|undefined} minutiRitardo
 * @returns {"in_orario"|"lieve"|"grave"}
 */
export function severitaRitardoConsegna(minutiRitardo) {
  if (minutiRitardo == null || minutiRitardo <= DELIVERY_DELAY_LIEVE_MIN) return "in_orario"
  if (minutiRitardo <= DELIVERY_DELAY_GRAVE_MIN) return "lieve"
  return "grave"
}

/** Etichetta breve per il badge (es. "In ritardo (12 min)"), null se in orario. */
export function etichettaRitardoConsegna(minutiRitardo) {
  const sev = severitaRitardoConsegna(minutiRitardo)
  if (sev === "in_orario") return null
  const min = Math.round(minutiRitardo)
  return sev === "grave" ? `In forte ritardo (${min} min)` : `In ritardo (${min} min)`
}

/**
 * Minuti trascorsi dall'assegnazione rider (`assegnato_rider_at`): utile per rilevare consegne
 * assegnate ma "ferme" (rider non è mai partito).
 * @param {string|null|undefined} assegnatoRiderAt timestamp ISO
 * @param {Date} [now]
 * @returns {number|null}
 */
export function minutiDaAssegnazione(assegnatoRiderAt, now = new Date()) {
  if (!assegnatoRiderAt) return null
  const assegnato = new Date(assegnatoRiderAt)
  if (Number.isNaN(assegnato.getTime())) return null
  return Math.round((now.getTime() - assegnato.getTime()) / 60000)
}
