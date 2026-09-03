/**
 * Chiavi in `parametri_operativi` per notifiche staff (ordine web, delivery, ecc.).
 * Gli adapter in `supabase/functions/_shared/notifications/adapters/` consumano la stessa semantica.
 */

export const NOTIFICATION_PARAM_KEYS = Object.freeze({
  /** Canale preferito se stampa comanda web automatica è OFF: email | sms | whatsapp | in_app */
  ordine_web_canale: "notifica_ordine_web_canale",
  /** E.164 o nazionale — destinatario SMS staff */
  ordine_web_telefono_sms: "notifica_ordine_web_telefono_sms",
  /** E.164 — destinatario WhatsApp staff (numero Business) */
  ordine_web_telefono_whatsapp: "notifica_ordine_web_telefono_whatsapp",
  /** Email staff override (default: email_fatturazione tenant) */
  ordine_web_email: "notifica_ordine_web_email",
})

/** Canali supportati dalla coda `notifiche_outbox` (allineare a Edge registry). */
export const NOTIFICATION_CHANNELS = Object.freeze({
  EMAIL: "email",
  SMS: "sms",
  WHATSAPP: "whatsapp",
  IN_APP: "in_app",
})

/** Tipi riga outbox (DB `notifiche_outbox.tipo`). */
export const NOTIFICATION_OUTBOX_TIPOS = Object.freeze({
  NUOVO_ORDINE_WEB: "nuovo_ordine_web",
  DOCUMENTO_COMMERCIALE: "documento_commerciale",
})

/**
 * Codici esito adapter (worker Edge / futuro Nest).
 * NOT_CONFIGURED = mancano credenziali/env; NOT_IMPLEMENTED = stub da completare.
 */
export const NOTIFICATION_ADAPTER_CODES = Object.freeze({
  SENT: "sent",
  NOT_CONFIGURED: "NOT_CONFIGURED",
  NOT_IMPLEMENTED: "NOT_IMPLEMENTED",
  FAILED: "FAILED",
})
