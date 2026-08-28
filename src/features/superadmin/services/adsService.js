// Servizio per l'area Superadmin "Marketing → Ads": campagne, metriche giornaliere e
// pubblicazione (manuale / n8n / api diretta). Vedi sql/modules/81_campagne_ads.sql e
// sql/modules/82_ads_pubblicazione_automazione.sql.
import { supabase } from "@/lib/supabaseClient"
import { logSupabaseError } from "@/utils/logSupabaseError"

export async function listCampagneRiepilogo() {
  const { data, error } = await supabase
    .from("v_campagne_ads_riepilogo")
    .select("*")
    .order("nome", { ascending: true })
  if (error) {
    logSupabaseError("adsService.listCampagneRiepilogo", error)
    throw error
  }
  return data || []
}

export async function listLandingPageOptions() {
  const { data, error } = await supabase.from("landing_pages").select("id, slug, titolo").order("slug")
  if (error) {
    logSupabaseError("adsService.listLandingPageOptions", error)
    throw error
  }
  return data || []
}

export async function upsertCampagna(row) {
  const { data, error } = await supabase.from("campagne_ads").upsert(row).select().single()
  if (error) {
    logSupabaseError("adsService.upsertCampagna", error)
    throw error
  }
  return data
}

export async function getCampagna(id) {
  const { data, error } = await supabase.from("campagne_ads").select("*").eq("id", id).maybeSingle()
  if (error) {
    logSupabaseError("adsService.getCampagna", error)
    throw error
  }
  return data
}

export async function registraMetricaGiornaliera(row) {
  const { data, error } = await supabase
    .from("campagne_ads_metriche")
    .upsert(row, { onConflict: "campagna_id,data" })
    .select()
    .single()
  if (error) {
    logSupabaseError("adsService.registraMetricaGiornaliera", error)
    throw error
  }
  return data
}

/** Costruisce l'URL della landing con i parametri UTM della campagna, da incollare nell'annuncio. */
export function buildUrlTrackciato({ baseUrl, slugLanding, campagna }) {
  const base = String(baseUrl || "https://pizzamanager.it").replace(/\/$/, "")
  const path = slugLanding ? `/${slugLanding}` : "/"
  const params = new URLSearchParams()
  if (campagna.utm_source) params.set("utm_source", campagna.utm_source)
  if (campagna.utm_medium) params.set("utm_medium", campagna.utm_medium)
  if (campagna.utm_campaign) params.set("utm_campaign", campagna.utm_campaign)
  if (campagna.utm_content) params.set("utm_content", campagna.utm_content)
  const qs = params.toString()
  return `${base}${path}${qs ? `?${qs}` : ""}`
}

/** Chiama l'Edge Function pubblica-campagna-ads (pubblicazione manuale/n8n/api_diretta). */
export async function pubblicaCampagna(campagnaId) {
  const { data, error } = await supabase.functions.invoke("pubblica-campagna-ads", {
    body: { campagna_id: campagnaId },
  })
  if (error) {
    logSupabaseError("adsService.pubblicaCampagna", error)
    throw error
  }
  return data
}

export const PIATTAFORME = Object.freeze(["google_ads", "meta_ads", "tiktok_ads", "linkedin_ads", "altro"])
export const STATI_CAMPAGNA = Object.freeze(["bozza", "programmata", "attiva", "in_pausa", "conclusa"])
