/**
 * Parametri consegne / rider da `parametri_operativi` (velocità, soglie, evidenza forno).
 * Regola A: il ricalcolo percorsi non sposta ordini già in forno su cucina/bancone (logica applicativa futura).
 */

import {
  orarioToMinutes,
  nowMinutes,
  getRitardoMinuti,
} from "@/features/operative/pizzaiolo/utils/pizzaioloUtils"

function num(po, key, def, min, max) {
  const raw = po && typeof po === "object" ? po[key] : undefined
  const n = raw === "" || raw == null ? def : Number(raw)
  if (!Number.isFinite(n)) return def
  return Math.min(max, Math.max(min, n))
}

/** Velocità media pianificazione percorsi (km/h). */
export function readRiderVelocitaMediaKmh(po) {
  return num(po, "rider_velocita_media_kmh", 28, 5, 120)
}

/** Velocità in condizioni avverse (più bassa = tempi più lunghi). */
export function readRiderVelocitaMalTempoKmh(po) {
  return num(po, "rider_velocita_mal_tempo_kmh", 22, 5, 120)
}

/** Soglia ritardo (minuti) per allarmi cross-reparto. */
export function readRiderRitardoSogliaMin(po) {
  return num(po, "rider_ritardo_soglia_min", 5, 1, 180)
}

/** Tempo medio attesa al cliente (citofono / consegna fisica), minuti. */
export function readRiderTempoFermataClienteMin(po) {
  return num(po, "rider_tempo_fermata_cliente_min", 2, 0, 60)
}

/** Se true, il sistema può ricalcolare automaticamente (quando implementato). */
export function readRiderRicalcoloAutomatico(po) {
  const raw = po && typeof po === "object" ? po.rider_ricalcolo_automatico : undefined
  return raw === true || raw === "true"
}

/**
 * Minuti prima della scadenza “in cucina” (orario consegna − partenza pony) in cui evidenziare
 * gli ordini delivery ancora in preparazione: “mandare al forno con urgenza”.
 */
export function readRiderFornoEvidenzaMin(po) {
  return num(po, "rider_forno_evidenza_min", 15, 1, 120)
}

/** Minuti prima dell’orario cliente in cui la merce pronto-bancone deve partire (buffer rider). */
export function readRiderPartenzaBufferMin(po) {
  return num(po, "rider_partenza_buffer_min", 5, 0, 60)
}

/**
 * Minuti rimanenti alla scadenza “pizze pronte per partenza rider” (orario − partenza consegna).
 * @returns {number|null} minuti (negativo = già in ritardo rispetto a quella scadenza)
 */
export function minutesUntilKitchenDeadlineForDelivery(ordine, partenzaConsegneMinuti) {
  const isDelivery = (ordine.tipo_ordine || "").toLowerCase() === "delivery"
  if (!isDelivery) return null
  const om = orarioToMinutes(ordine.orario_ritiro ?? ordine.orarioRitiro)
  if (om == null) return null
  const p = Math.max(0, Number(partenzaConsegneMinuti) || 30)
  const deadline = om - p
  return deadline - nowMinutes()
}

/**
 * Ordine delivery in preparazione: evidenza forno (finestra prima della scadenza cucina).
 * Include anche ritardo già in corso (minuti rimanenti negativi → sempre critico se delivery).
 */
export function isDeliveryUrgentForno(ordine, parametriOperativi, partenzaConsegneMinuti) {
  const stato = String(ordine.stato || "").toUpperCase()
  if (stato !== "IN_PREPARAZIONE") return false
  const left = minutesUntilKitchenDeadlineForDelivery(ordine, partenzaConsegneMinuti)
  if (left == null) return false
  const ev = readRiderFornoEvidenzaMin(parametriOperativi)
  if (left < 0) return true
  return left <= ev
}

/**
 * Bancone: delivery già PRONTO — finestra critica prima dell’orario cliente (buffer partenza rider).
 */
export function isDeliveryUrgentPartenzaBancone(ordine, parametriOperativi) {
  const stato = String(ordine.stato || "").toUpperCase()
  if (stato !== "PRONTO") return false
  if ((ordine.tipo_ordine || "").toLowerCase() !== "delivery") return false
  const om = orarioToMinutes(ordine.orario_ritiro ?? ordine.orarioRitiro)
  if (om == null) return false
  const buffer = readRiderPartenzaBufferMin(parametriOperativi)
  const ev = readRiderFornoEvidenzaMin(parametriOperativi)
  const now = nowMinutes()
  const departBy = om - buffer
  return now >= departBy - ev && now <= om
}

/**
 * True se superata la soglia ritardo (stessa logica getRitardoMinuti ma con soglia configurabile) — utile alert.
 */
export function isDeliveryRitardoBeyondSoglia(ordine, parametriOperativi, partenzaConsegneMinuti) {
  if ((ordine.tipo_ordine || "").toLowerCase() !== "delivery") return false
  const r = getRitardoMinuti(ordine, partenzaConsegneMinuti)
  const soglia = readRiderRitardoSogliaMin(parametriOperativi)
  return r >= soglia
}

/**
 * Per banner cassa: presenza almeno un ordine delivery oggi in criticità (ritardo o urgenza forno / partenza).
 */
export function ordineDeliveryRichiedeAttenzione(ordine, parametriOperativi, partenzaConsegneMinuti) {
  if ((ordine.tipo_ordine || "").toLowerCase() !== "delivery") return false
  const stato = String(ordine.stato || "").toUpperCase()
  if (stato === "IN_PREPARAZIONE") {
    return (
      isDeliveryUrgentForno(ordine, parametriOperativi, partenzaConsegneMinuti) ||
      isDeliveryRitardoBeyondSoglia(ordine, parametriOperativi, partenzaConsegneMinuti)
    )
  }
  if (stato === "PRONTO") {
    return (
      isDeliveryUrgentPartenzaBancone(ordine, parametriOperativi) ||
      getRitardoMinuti(ordine, partenzaConsegneMinuti) > 0
    )
  }
  return false
}
