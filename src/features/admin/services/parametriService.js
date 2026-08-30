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

function isMissingRpc(error) {
  const text = `${error?.code || ""} ${error?.message || ""} ${error?.details || ""}`
  return error?.code === "PGRST202" || /admin_update_tenant_parametri_operativi/i.test(text)
}

async function writeParametriOperativi(tenantId, parametri) {
  const { data, error } = await supabase.rpc("admin_update_tenant_parametri_operativi", {
    p_tenant_id: tenantId,
    p_parametri: parametri,
  })
  if (!error) return data

  if (!isMissingRpc(error)) {
    logSupabaseError("admin.updateTenantSettings.parametri", error, { tenantId })
    throw error
  }

  const { data: row, error: updateError } = await supabase
    .from("tenants")
    .update({ parametri_operativi: parametri })
    .eq("id", tenantId)
    .select("id")
    .maybeSingle()
  if (updateError) {
    logSupabaseError("admin.updateTenantSettings.parametriFallback", updateError, { tenantId })
    throw updateError
  }
  if (!row) {
    const err = new Error("Salvataggio non applicato: i parametri operativi non sono stati scritti.")
    logSupabaseError("admin.updateTenantSettings.parametriFallback", err, { tenantId, code: "NO_ROWS" })
    throw err
  }
  return parametri
}

/**
 * Aggiorna campi tenant (indirizzo, parametri_operativi, dominio pubblico, Stripe pk, …).
 * Retry automatico se PostgREST segnala colonne assenti (PGRST204).
 * `parametri_operativi` passa da RPC dedicato: non viene mai scartato in silenzio.
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

  if (Object.prototype.hasOwnProperty.call(payload, "parametri_operativi")) {
    await writeParametriOperativi(tenantId, payload.parametri_operativi)
    delete payload.parametri_operativi
    if (Object.keys(payload).length === 0) {
      return { droppedFields: [] }
    }
  }

  const { data, error } = await supabase.from("tenants").update(payload).eq("id", tenantId).select("id").maybeSingle()
  if (error) {
    if (error.code === "PGRST204") {
      const details = String(error.details || error.message || "")
      const missingFromError = optional.filter((key) => {
        const re = new RegExp(`\\b${key}\\b`, "i")
        return re.test(details)
      })
      const missing = missingFromError.length ? missingFromError : optional
      for (const key of missing) delete payload[key]
      if (Object.keys(payload).length === 0) {
        return { droppedFields: missing.filter((key) => Object.prototype.hasOwnProperty.call(updates, key)) }
      }
      const retry = await supabase.from("tenants").update(payload).eq("id", tenantId).select("id").maybeSingle()
      if (retry.error) {
        logSupabaseError("admin.updateTenantSettings.retry", retry.error, { tenantId })
        throw retry.error
      }
      if (!retry.data) {
        const err = new Error("Salvataggio non applicato: il tenant non è stato aggiornato.")
        logSupabaseError("admin.updateTenantSettings.retry", err, { tenantId, code: "NO_ROWS" })
        throw err
      }
      const droppedFields = missing.filter((key) => Object.prototype.hasOwnProperty.call(updates, key))
      return { droppedFields }
    }
    logSupabaseError("admin.updateTenantSettings", error, { tenantId })
    throw error
  }
  if (!data) {
    const err = new Error("Salvataggio non applicato: il tenant non è stato aggiornato.")
    logSupabaseError("admin.updateTenantSettings", err, { tenantId, code: "NO_ROWS" })
    throw err
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
