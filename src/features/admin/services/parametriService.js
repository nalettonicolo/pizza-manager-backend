import { supabase } from "@/lib/supabaseClient"
import { logSupabaseError } from "@/utils/logSupabaseError"

/** Carica riga tenant (settings + parametri_operativi). */
export async function getTenantSettings(tenantId) {
  if (!tenantId) {
    throw new Error("tenantId obbligatorio")
  }
  const { data, error } = await supabase.from("tenants").select("*").eq("id", tenantId).maybeSingle()

  if (error) {
    logSupabaseError("admin.getTenantSettings", error, { tenantId })
    throw error
  }
  if (!data) {
    const err = new Error("Tenant non trovato o non accessibile")
    logSupabaseError("admin.getTenantSettings", err, { tenantId, code: "PGRST116" })
    throw err
  }
  return data
}

/**
 * Aggiorna campi tenant (indirizzo, parametri_operativi, dominio pubblico, Stripe pk, …).
 * Retry automatico se PostgREST segnala colonne assenti (PGRST204).
 */
export async function updateTenantSettings(tenantId, updates) {
  const payload = { ...updates }
  const optional = [
    "indirizzo",
    "telefono",
    "email",
    "lat",
    "lng",
    "logo_url",
    "orari_settimana",
    "parametri_operativi",
    "public_domain",
    "public_domain_status",
    "public_domain_requested_at",
    "sito_web_cliente",
    "legal_ragione_sociale",
    "legal_piva",
    "legal_pec",
    "privacy_policy_html",
    "cookie_policy_html",
    "pagamento_online_provider",
    "stripe_publishable_key",
    "sumup_merchant_public_id",
  ]
  const { error } = await supabase.from("tenants").update(payload).eq("id", tenantId)
  if (error) {
    if (error.code === "PGRST204") {
      const details = String(error.details || error.message || "")
      const missingFromError = optional.filter((key) => {
        const re = new RegExp(`\\b${key}\\b`, "i")
        return re.test(details)
      })
      const missing = missingFromError.length ? missingFromError : optional
      for (const key of missing) delete payload[key]
      const retry = await supabase.from("tenants").update(payload).eq("id", tenantId)
      if (retry.error) {
        logSupabaseError("admin.updateTenantSettings.retry", retry.error, { tenantId })
        throw retry.error
      }
      const droppedFields = missing.filter((key) => Object.prototype.hasOwnProperty.call(updates, key))
      return { droppedFields }
    }
    logSupabaseError("admin.updateTenantSettings", error, { tenantId })
    throw error
  }
  return { droppedFields: [] }
}

/** Merge di chiavi in `parametri_operativi` senza sovrascrivere l’intero blob accidentalmente. */
export async function patchTenantParametriOperativi(tenantId, patch) {
  if (!tenantId || !patch || typeof patch !== "object") {
    throw new Error("patchTenantParametriOperativi: tenantId e patch oggetto richiesti")
  }
  const settings = await getTenantSettings(tenantId)
  const current =
    settings?.parametri_operativi && typeof settings.parametri_operativi === "object"
      ? settings.parametri_operativi
      : {}
  return updateTenantSettings(tenantId, {
    parametri_operativi: { ...current, ...patch },
  })
}
