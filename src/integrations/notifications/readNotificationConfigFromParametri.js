import {
  NOTIFICATION_CHANNELS,
  NOTIFICATION_PARAM_KEYS,
} from "@/integrations/notifications/notificationConstants"

const VALID_CANALI = new Set(Object.values(NOTIFICATION_CHANNELS))

/**
 * @param {unknown} parametriOperativi
 * @returns {{
 *   ordineWebCanale: string,
 *   ordineWebTelefonoSms: string,
 *   ordineWebTelefonoWhatsapp: string,
 *   ordineWebEmail: string,
 * }}
 */
export function readNotificationConfigFromParametri(parametriOperativi) {
  const po = parametriOperativi && typeof parametriOperativi === "object" ? parametriOperativi : {}
  const rawCanale = String(po[NOTIFICATION_PARAM_KEYS.ordine_web_canale] ?? "").trim().toLowerCase()
  const ordineWebCanale = VALID_CANALI.has(rawCanale) ? rawCanale : NOTIFICATION_CHANNELS.EMAIL
  return {
    ordineWebCanale,
    ordineWebTelefonoSms: String(po[NOTIFICATION_PARAM_KEYS.ordine_web_telefono_sms] ?? "").trim(),
    ordineWebTelefonoWhatsapp: String(po[NOTIFICATION_PARAM_KEYS.ordine_web_telefono_whatsapp] ?? "").trim(),
    ordineWebEmail: String(po[NOTIFICATION_PARAM_KEYS.ordine_web_email] ?? "").trim(),
  }
}

/** Stato implementazione adapter (solo UI / diagnostica). */
export function notificationAdapterReadiness() {
  return {
    email: { ready: false, label: "Email (SMTP tenant / Supabase)", note: "Implementare adapters/email-smtp.ts" },
    sms: { ready: false, label: "SMS", note: "Implementare adapters/sms.ts + gateway scelto dal tenant" },
    whatsapp: { ready: false, label: "WhatsApp", note: "Implementare adapters/whatsapp.ts + API Business tenant" },
    in_app: { ready: true, label: "In-app (cucina/cassa/delivery)", note: "Schermate operative già attive" },
    stampa_comanda: {
      ready: true,
      label: "Stampa comanda automatica",
      note: "Percorso primario consigliato; disattiva la coda notifiche",
    },
  }
}
