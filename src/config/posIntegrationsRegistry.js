/**
 * Catalogo integrazioni POS / PSP / pay-by-link.
 * Ogni voce è "predisposta" a livello prodotto; l'attivazione concreta avviene con dati tenant (chiavi, contratti).
 */

/** @typedef {'checkout_web' | 'pay_by_link' | 'pos_terminal' | 'manual_only'} PosIntegrationTrack */

/** @typedef {{ id: string, label: string, track: PosIntegrationTrack, implementation: 'scaffold' | 'partial' | 'live', notes?: string }} PosIntegrationDefinition */

/** @type {PosIntegrationDefinition[]} */
export const POS_INTEGRATION_CATALOG = Object.freeze([
  {
    id: "manual_pos_register",
    label: "Registrazione manuale cassa (POS esterno)",
    track: "manual_only",
    implementation: "live",
    notes: "Nessun collegamento API: incassi su terminale terzi e tipi pagamento registrati in cassa.",
  },
  {
    id: "stripe_checkout_web",
    label: "Stripe — checkout web / vetrina",
    track: "checkout_web",
    implementation: "partial",
    notes: "Chiavi tenant in Dati pizzeria; Edge create-intent per ordini online.",
  },
  {
    id: "sumup_checkout_web",
    label: "SumUp — checkout web",
    track: "checkout_web",
    implementation: "scaffold",
    notes: "Campi pubblici tenant; serve Edge/worker dedicato e webhook.",
  },
  {
    id: "nexi_xpay_hosted",
    label: "Nexi — XPay / hosted (e-commerce)",
    track: "checkout_web",
    implementation: "scaffold",
    notes: "Alias e segreti lato server; mapping ordine → Nexi da implementare.",
  },
  {
    id: "paypal_commerce",
    label: "PayPal — Commerce / hosted",
    track: "checkout_web",
    implementation: "scaffold",
  },
  {
    id: "satispay_business",
    label: "Satispay for Business",
    track: "checkout_web",
    implementation: "scaffold",
  },
  {
    id: "stripe_payment_link",
    label: "Stripe — pay-by-link / PaymentIntent (cassa)",
    track: "pay_by_link",
    implementation: "partial",
    notes: "Intent su DB + Edge payment-stripe-create-intent; URL SMS/hosted in evoluzione.",
  },
  {
    id: "sumup_payment_link",
    label: "SumUp — link pagamento",
    track: "pay_by_link",
    implementation: "scaffold",
  },
  {
    id: "nexi_pay_by_link",
    label: "Nexi — pay-by-link",
    track: "pay_by_link",
    implementation: "scaffold",
  },
  {
    id: "stripe_terminal",
    label: "Stripe Terminal (lettori)",
    track: "pos_terminal",
    implementation: "scaffold",
    notes: "SDK lettori / ConnectionToken lato backend.",
  },
  {
    id: "sumup_reader",
    label: "SumUp — lettori / Solo",
    track: "pos_terminal",
    implementation: "scaffold",
  },
  {
    id: "nexi_smartpos",
    label: "Nexi — Smart POS / terminali",
    track: "pos_terminal",
    implementation: "scaffold",
  },
  {
    id: "ingenico_axium",
    label: "Ingenico / Worldline — terminali",
    track: "pos_terminal",
    implementation: "scaffold",
  },
  {
    id: "pax_integrated",
    label: "PAX — integrazione POS",
    track: "pos_terminal",
    implementation: "scaffold",
  },
])

/** Chiavi passate a payment_link_intents.provider_key e al registry pay-by-link */
export const PAYMENT_LINK_PROVIDER_KEYS = Object.freeze({
  STRIPE: "stripe",
  SUMUP: "sumup",
  NEXI: "nexi",
  PAYPAL: "paypal",
  SATISPAY: "satispay",
})

/** Chiavi adapter terminali (parametri_operativi.pos_terminal_provider_key) */
export const TERMINAL_PROVIDER_KEYS = Object.freeze({
  NONE: "",
  STRIPE_TERMINAL: "stripe_terminal",
  SUMUP_READER: "sumup_reader",
  NEXI_SMARTPOS: "nexi_smartpos",
  INGENICO: "ingenico",
  PAX: "pax",
  GENERIC_CLOUD: "generic_cloud",
})

const CATALOG_IDS = POS_INTEGRATION_CATALOG.map((x) => x.id)

/**
 * Stato persistito per ogni integrazione (parametri_operativi.pos_payment_predispositions).
 * predisposed: la piattaforma espone il perimetro; activated: il cliente ha chiesto attivazione e i dati sono stati collegati.
 */
export function defaultPosPaymentPredispositions() {
  /** @type {Record<string, { predisposed: boolean, activated: boolean, notes: string }>} */
  const providers = {}
  for (const id of CATALOG_IDS) {
    providers[id] = { predisposed: true, activated: false, notes: "" }
  }
  return { version: 1, providers }
}

/**
 * @param {unknown} raw
 */
export function mergePosPaymentPredispositions(raw) {
  const base = defaultPosPaymentPredispositions()
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return base
  const v = raw
  const providersIn = v.providers && typeof v.providers === "object" && !Array.isArray(v.providers) ? v.providers : {}
  const providers = { ...base.providers }
  for (const id of CATALOG_IDS) {
    const row = providersIn[id]
    if (row && typeof row === "object" && !Array.isArray(row)) {
      providers[id] = {
        predisposed: row.predisposed !== false,
        activated: row.activated === true,
        notes: typeof row.notes === "string" ? row.notes : "",
      }
    }
  }
  return { version: 1, providers }
}

/**
 * @param {string} paymentLinkProviderKey
 */
export function paymentLinkProviderImplementationStatus(paymentLinkProviderKey) {
  const k = String(paymentLinkProviderKey || "").trim().toLowerCase()
  if (k === PAYMENT_LINK_PROVIDER_KEYS.STRIPE) return "partial"
  if (!k) return "none"
  return "scaffold"
}
