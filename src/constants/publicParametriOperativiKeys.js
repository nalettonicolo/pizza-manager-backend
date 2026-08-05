/**
 * Chiavi esposte ad anon via pm_public_parametri_operativi (mod. 40).
 * Mantenere allineato a sql/modules/40_public_parametri_whitelist.sql
 */
export const PUBLIC_PARAMETRI_OPERATIVI_KEYS = [
  "ordini_online_attivi",
  "menuTheme",
  "promozioni_calendario",
  "consegna_area_poligono",
  "consegna_domicilio_attiva",
  "pizze_ogni_15_min",
  "fidelity_attivo",
  "fidelity_abilita_clienti_domicilio",
  "fidelity_modalita_accredito",
  "fidelity_timbri_per_pizza",
  "fidelity_timbri_scheda_totale",
  "fidelity_premi",
  "fidelity_punti_per_euro",
]

/** Chiavi sensibili che non devono comparire nella risposta pubblica. */
export const PUBLIC_PARAMETRI_FORBIDDEN_KEYS = [
  "leak_cassa",
  "stampa_comanda_ordine_web_automatica",
  "cassa_apertura_automatica",
  "smtp_host",
  "stripe_webhook_secret",
  "notifiche_email_attive",
]

export function filterPublicParametriOperativi(obj) {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return {}
  const out = {}
  for (const k of PUBLIC_PARAMETRI_OPERATIVI_KEYS) {
    if (Object.prototype.hasOwnProperty.call(obj, k)) out[k] = obj[k]
  }
  return out
}

export function assertPublicParametriSafe(parametri) {
  const keys = Object.keys(parametri || {})
  const allowed = new Set(PUBLIC_PARAMETRI_OPERATIVI_KEYS)
  const forbidden = keys.filter((k) => !allowed.has(k))
  const leakedForbidden = PUBLIC_PARAMETRI_FORBIDDEN_KEYS.filter((k) =>
    Object.prototype.hasOwnProperty.call(parametri || {}, k),
  )
  return {
    ok: forbidden.length === 0 && leakedForbidden.length === 0,
    extraKeys: forbidden,
    leakedForbidden,
  }
}
