import { supabase } from "@/lib/supabaseClient"

/** Salva la chiave segreta Stripe (sk_…) lato database — solo ruolo admin tenant. */
export async function saveTenantStripeSecret(tenantId, secret) {
  const { error } = await supabase.rpc("save_tenant_stripe_secret", {
    p_tenant_id: tenantId,
    p_secret: String(secret || "").trim(),
  })
  if (error) throw error
}

/** True se è stata salvata una sk_ per il tenant (senza esporre il valore). */
export async function fetchTenantStripeSecretConfigured(tenantId) {
  const { data, error } = await supabase.rpc("tenant_payment_stripe_configured", {
    p_tenant_id: tenantId,
  })
  if (error) throw error
  return !!data
}

export async function fetchTenantStripeWebhookConfigured(tenantId) {
  const { data, error } = await supabase.rpc("tenant_stripe_webhook_configured", {
    p_tenant_id: tenantId,
  })
  if (error) throw error
  return !!data
}

export async function saveTenantStripeWebhookSecret(tenantId, secret) {
  const { error } = await supabase.rpc("save_tenant_stripe_webhook_secret", {
    p_tenant_id: tenantId,
    p_secret: String(secret || "").trim(),
  })
  if (error) throw error
}

export async function saveTenantSumupSecret(tenantId, secret) {
  const { error } = await supabase.rpc("save_tenant_sumup_secret", {
    p_tenant_id: tenantId,
    p_secret: String(secret || "").trim(),
  })
  if (error) throw error
}

export async function fetchTenantSumupSecretConfigured(tenantId) {
  const { data, error } = await supabase.rpc("tenant_payment_sumup_configured", {
    p_tenant_id: tenantId,
  })
  if (error) throw error
  return !!data
}

/** @returns {Promise<{ provider: string|null, stripe_publishable_configured: boolean, stripe_secret_configured: boolean, stripe_webhook_configured: boolean, sumup_merchant_configured?: boolean, sumup_secret_configured?: boolean, ready: boolean }>} */
export async function fetchTenantOnlinePaymentSetupStatus(tenantId) {
  const { data, error } = await supabase.rpc("tenant_online_payment_setup_status", {
    p_tenant_id: tenantId,
  })
  if (error) throw error
  return data && typeof data === "object" ? data : {}
}

/** @returns {Promise<Array<{ provider_key: string, enabled: boolean, public_config: object, ready: boolean, secret_configured: boolean }>>} */
export async function listTenantOnlinePaymentProviders(tenantId) {
  const { data, error } = await supabase.rpc("list_tenant_online_payment_providers", {
    p_tenant_id: tenantId,
  })
  if (error) throw error
  return Array.isArray(data) ? data : []
}

/**
 * @param {string} tenantId
 * @param {string} providerKey
 * @param {{ enabled?: boolean, publicConfig?: object, sortOrder?: number }} opts
 */
export async function upsertTenantOnlinePaymentProvider(tenantId, providerKey, opts = {}) {
  const { data, error } = await supabase.rpc("upsert_tenant_online_payment_provider", {
    p_tenant_id: tenantId,
    p_provider_key: providerKey,
    p_enabled: opts.enabled ?? null,
    p_public_config: opts.publicConfig ?? null,
    p_sort_order: opts.sortOrder ?? null,
  })
  if (error) throw error
  return Array.isArray(data) ? data : data?.providers || []
}

export async function saveTenantPaymentProviderSecret(tenantId, providerKey, secret) {
  const { error } = await supabase.rpc("save_tenant_payment_provider_secret", {
    p_tenant_id: tenantId,
    p_provider_key: providerKey,
    p_secret: String(secret || "").trim(),
  })
  if (error) throw error
}

export function getStripeWebhookUrl() {
  const base = import.meta.env.VITE_SUPABASE_URL
  if (!base) return ""
  return `${String(base).replace(/\/$/, "")}/functions/v1/payment-stripe-webhook`
}

export const STRIPE_EDGE_FUNCTIONS = [
  "payment-stripe-create-intent",
  "payment-stripe-confirm",
  "payment-stripe-refund",
  "payment-stripe-webhook",
]

export const SUMUP_EDGE_FUNCTIONS = [
  "payment-sumup-create-checkout",
  "payment-sumup-confirm",
]
