/**
 * Catalogo gestori pagamento online vetrina (multi-provider).
 * `checkoutLive`: checkout cliente implementato (Edge). Gli altri sono configurabili in admin per test futuri.
 */

/** @typedef {'live' | 'config_only'} OnlinePaymentImplementation */

/** @typedef {{
 *   key: string,
 *   label: string,
 *   shortLabel: string,
 *   description: string,
 *   implementation: OnlinePaymentImplementation,
 *   docsUrl?: string,
 *   sortOrder: number,
 *   accent?: string,
 * }} OnlinePaymentProviderDefinition */

/** @type {OnlinePaymentProviderDefinition[]} */
export const ONLINE_PAYMENT_PROVIDERS = Object.freeze([
  {
    key: "stripe",
    label: "Stripe",
    shortLabel: "Stripe",
    description: "Carte, Apple Pay e Google Pay. Form integrato in checkout.",
    implementation: "live",
    docsUrl: "https://dashboard.stripe.com/test/apikeys",
    sortOrder: 10,
    accent: "#635bff",
  },
  {
    key: "sumup",
    label: "SumUp",
    shortLabel: "SumUp",
    description: "Checkout hosted SumUp (sandbox in test). Redirect sicuro.",
    implementation: "live",
    docsUrl: "https://developer.sumup.com",
    sortOrder: 20,
    accent: "#1a1a1a",
  },
  {
    key: "satispay",
    label: "Satispay",
    shortLabel: "Satispay",
    description: "Pagamenti Satispay for Business. Configura ora per i test — checkout in arrivo.",
    implementation: "config_only",
    docsUrl: "https://developers.satispay.com",
    sortOrder: 30,
    accent: "#e8214a",
  },
  {
    key: "nexi",
    label: "Nexi (XPay)",
    shortLabel: "Nexi",
    description: "Nexi XPay / e-commerce hosted. Configura alias e chiavi per i test.",
    implementation: "config_only",
    docsUrl: "https://developer.nexi.it",
    sortOrder: 40,
    accent: "#0033a0",
  },
  {
    key: "paypal",
    label: "PayPal",
    shortLabel: "PayPal",
    description: "PayPal Commerce / hosted. Configura credenziali sandbox.",
    implementation: "config_only",
    docsUrl: "https://developer.paypal.com",
    sortOrder: 50,
    accent: "#003087",
  },
])

/** @type {Record<string, OnlinePaymentProviderDefinition>} */
export const ONLINE_PAYMENT_PROVIDER_BY_KEY = Object.freeze(
  Object.fromEntries(ONLINE_PAYMENT_PROVIDERS.map((p) => [p.key, p])),
)

/**
 * @param {unknown} tenant
 * @returns {Array<{ provider_key: string, public_config?: Record<string, unknown> }>}
 */
export function getTenantOnlinePaymentProviders(tenant) {
  const t = tenant && typeof tenant === "object" ? tenant : {}
  const fromRpc = t.online_payment_providers
  if (Array.isArray(fromRpc) && fromRpc.length > 0) {
    return fromRpc.map((row) => ({
      provider_key: String(row.provider_key || row.providerKey || "").toLowerCase(),
      public_config: row.public_config || row.publicConfig || {},
    }))
  }
  // Legacy single provider
  const legacy = String(t.pagamento_online_provider || "").toLowerCase().trim()
  if (legacy === "stripe" && String(t.stripe_publishable_key || "").startsWith("pk_")) {
    return [{ provider_key: "stripe", public_config: { stripe_publishable_key: t.stripe_publishable_key } }]
  }
  if (legacy === "sumup" && String(t.sumup_merchant_public_id || "").length >= 4) {
    return [{ provider_key: "sumup", public_config: { sumup_merchant_public_id: t.sumup_merchant_public_id } }]
  }
  return []
}

/**
 * Solo gestori con checkout live e pronti in vetrina.
 * @param {unknown} tenant
 */
export function getCheckoutLiveProviders(tenant) {
  return getTenantOnlinePaymentProviders(tenant).filter((row) => {
    const def = ONLINE_PAYMENT_PROVIDER_BY_KEY[row.provider_key]
    return def?.implementation === "live"
  })
}

/** @deprecated usa getCheckoutLiveProviders — mantiene compat se un solo provider */
export function describePaymentProvider(tenant) {
  const live = getCheckoutLiveProviders(tenant)
  if (live.length === 1) return live[0].provider_key
  return ""
}

/**
 * @param {string} providerKey
 * @param {unknown} publicConfig
 * @param {boolean} secretConfigured
 */
export function detectProviderMode(providerKey, publicConfig, secretConfigured) {
  const cfg = publicConfig && typeof publicConfig === "object" ? publicConfig : {}
  const k = String(providerKey || "").toLowerCase()
  if (k === "stripe") {
    const pk = String(cfg.stripe_publishable_key || "")
    const sk = String(cfg._secret_hint || "")
    if (pk.startsWith("pk_test_") || sk.startsWith("sk_test_")) return "test"
    if (pk.startsWith("pk_live_") || sk.startsWith("sk_live_")) return "live"
  }
  if (k === "sumup") {
    const hint = String(cfg._secret_hint || "")
    if (hint.includes("test") || hint.startsWith("sk_test_")) return "test"
    if (hint.startsWith("sk_live_")) return "live"
    return hint || secretConfigured ? "test" : null
  }
  if (secretConfigured) return "test"
  return null
}

/**
 * @param {string} providerKey
 * @param {Record<string, unknown>} row from RPC list
 */
export function providerStatusLabel(providerKey, row) {
  const def = ONLINE_PAYMENT_PROVIDER_BY_KEY[providerKey]
  if (!row?.enabled) return { tone: "muted", text: "Non attivo" }
  if (row.ready && def?.implementation === "live") return { tone: "ok", text: "Pronto in vetrina" }
  if (row.ready && def?.implementation === "config_only") {
    return { tone: "info", text: "Configurato · checkout in arrivo" }
  }
  if (row.secret_configured) return { tone: "warn", text: "Completa i dati pubblici" }
  return { tone: "warn", text: "Da configurare" }
}
