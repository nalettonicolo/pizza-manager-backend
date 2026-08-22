/**
 * Config stampa operativa (cassa vs tablet / ricevuta di cortesia).
 * Chiavi in `parametri_operativi`.
 */

/** @typedef {'solo_cassa' | 'con_tablet'} StampaModalita */
/** @typedef {'auto' | 'manuale' | 'mai'} StampaQuando */

export const STAMPA_MODALITA_OPTIONS = Object.freeze([
  {
    id: "solo_cassa",
    label: "Solo cassa (niente tablet in sala)",
    hint: "La stampante è in cassa: scegli quante copie di comanda e quando stamparle alla conferma ordine.",
  },
  {
    id: "con_tablet",
    label: "Con tablet nei reparti",
    hint: "I reparti lavorano da tablet. La ricevuta di cortesia (non fiscale) parte dal reparto che scegli sotto.",
  },
])

export const STAMPA_QUANDO_OPTIONS = Object.freeze([
  { id: "auto", label: "Subito alla conferma ordine" },
  { id: "manuale", label: "Manuale (pulsante dopo la conferma)" },
  { id: "mai", label: "Non proporre in automatico" },
])

/** Reparti che possono avviare la stampa della ricevuta di cortesia. */
export const STAMPA_CORTESIA_REPARTI = Object.freeze([
  { id: "", label: "Nessuno — disattivata" },
  { id: "delivery", label: "Delivery / Pony" },
  { id: "bancone", label: "Bancone" },
  { id: "cucina", label: "Cucina" },
  { id: "pizzaiolo", label: "Pizzaioli" },
  { id: "cassa", label: "Cassa" },
])

/**
 * @param {Record<string, unknown>} [parametri]
 * @returns {StampaModalita}
 */
export function readStampaModalita(parametri) {
  const raw = String(parametri?.stampa_modalita ?? "").trim().toLowerCase()
  if (raw === "con_tablet" || raw === "tablet" || raw === "con_tablet_reparti") return "con_tablet"
  return "solo_cassa"
}

/**
 * @param {Record<string, unknown>} [parametri]
 * @param {'comanda' | 'ricevuta'} kind
 * @returns {StampaQuando}
 */
export function readStampaQuando(parametri, kind) {
  const key = kind === "ricevuta" ? "cassa_stampa_ricevuta_quando" : "comanda_stampa_quando"
  const raw = String(parametri?.[key] ?? "").trim().toLowerCase()
  if (raw === "auto" || raw === "manuale" || raw === "mai") return raw
  // Legacy boolean, rispettato solo se impostato esplicitamente (true o false). Se il tenant
  // non ha mai configurato nulla: stampa subito alla conferma ordine, senza uno step manuale
  // in più — default richiesto esplicitamente, non più "manuale" silenzioso.
  const legacyKey = kind === "comanda" ? "comanda_stampa_auto" : "cassa_stampa_ricevuta_auto"
  const legacyRaw = parametri?.[legacyKey]
  if (legacyRaw === true || legacyRaw === "true") return "auto"
  if (legacyRaw === false || legacyRaw === "false") return "manuale"
  return "auto"
}

/**
 * @param {Record<string, unknown>} [parametri]
 * @returns {string} id reparto o ""
 */
export function readStampaRicevutaCortesiaReparto(parametri) {
  const id = String(parametri?.stampa_ricevuta_cortesia_reparto ?? "").trim().toLowerCase()
  if (!id || id === "none" || id === "nessuno") return ""
  const ok = STAMPA_CORTESIA_REPARTI.some((r) => r.id === id)
  return ok ? id : ""
}

/**
 * True se il reparto corrente può mostrare «Stampa ricevuta di cortesia».
 * @param {Record<string, unknown>} [parametri]
 * @param {string} repartoKey
 */
export function canRepartoStampareRicevutaCortesia(parametri, repartoKey) {
  if (readStampaModalita(parametri) !== "con_tablet") return false
  const configured = readStampaRicevutaCortesiaReparto(parametri)
  if (!configured) return false
  return String(repartoKey || "").trim().toLowerCase() === configured
}

/**
 * Numero copie comanda (1–5).
 * @param {Record<string, unknown>} [parametri]
 */
export function readComandaCopie(parametri) {
  const n = Number(parametri?.comanda_copie)
  if (!Number.isFinite(n) || n < 1) return 1
  return Math.min(5, Math.floor(n))
}
