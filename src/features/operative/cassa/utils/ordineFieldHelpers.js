/**
 * Normalizzazione campi ordine (vista PostgREST snake_case / camelCase).
 * Usato da Cassa e da moduli estratti (es. modifica ordine).
 */

export function ordineTipoOrdine(o) {
  return String(o?.tipo_ordine ?? o?.tipoOrdine ?? "").trim().toLowerCase()
}

export function ordineIsDelivery(o) {
  return ordineTipoOrdine(o) === "delivery"
}

export function ordineNomeCliente(o) {
  return String(o?.nome_cliente ?? o?.nomeCliente ?? o?.nome ?? "").trim()
}

export function ordineTelefonoRitiro(o) {
  return String(o?.telefono_ritiro ?? o?.telefonoRitiro ?? "").trim()
}

export function ordineIndirizzoConsegna(o) {
  return String(o?.indirizzo_consegna ?? o?.indirizzoConsegna ?? o?.indirizzo ?? "").trim()
}

export function ordineOrarioRitiro(o) {
  return String(o?.orario_ritiro ?? o?.orarioRitiro ?? "").trim()
}

/** Ordine web in attesa di Accetta / Sposta / Rifiuta da cassa. */
export function ordineRichiedeAccettazioneCassa(o) {
  return o?.richiede_accettazione_cassa === true || o?.richiedeAccettazioneCassa === true
}

/** Stato del pagamento online (JSONB online_payment.status), es. "succeeded", "PENDING", "requires_payment_method". */
export function ordineOnlinePaymentStatus(o) {
  const op = o?.online_payment ?? o?.onlinePayment
  return String(op?.status ?? "").trim().toLowerCase()
}

const STATI_PAGAMENTO_ONLINE_FALLITO = new Set(["payment_failed", "failed", "canceled", "cancelled", "expired"])

/** true se il provider ha segnalato esplicitamente che il pagamento online NON è andato a buon fine
 * (non semplice attesa: un fallimento dichiarato — es. carta rifiutata, checkout scaduto/annullato). */
export function ordineOnlinePaymentFallito(o) {
  return STATI_PAGAMENTO_ONLINE_FALLITO.has(ordineOnlinePaymentStatus(o))
}

/**
 * Minuti mancanti da adesso all'orario di ritiro/consegna previsto per oggi (può essere negativo
 * se l'orario è già passato). `null` se orario_ritiro non è un "HH:MM" valido.
 * @param {object} o
 * @param {Date} [now]
 * @returns {number|null}
 */
export function minutiAllOrarioRitiro(o, now = new Date()) {
  const raw = ordineOrarioRitiro(o)
  const m = raw.match(/^(\d{1,2}):(\d{2})/)
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  if (!Number.isFinite(h) || !Number.isFinite(min)) return null
  const target = new Date(now)
  target.setHours(h, min, 0, 0)
  return Math.round((target.getTime() - now.getTime()) / 60000)
}
