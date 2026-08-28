// Servizio per il catalogo attrezzature e i noleggi per tenant (public.attrezzature_catalogo,
// public.tenant_noleggi — vedi sql/modules/77_noleggio_attrezzature.sql). Tabelle presenti da
// tempo ma MAI collegate a nessuna UI prima d'ora: usato dalla pagina Superadmin "Preventivi e
// contratti" per far scegliere al superadmin le attrezzature da includere nel contratto.
import { supabase } from "@/lib/supabaseClient"
import { logSupabaseError } from "@/utils/logSupabaseError"

export async function listAttrezzatureCatalogo({ soloDisponibili = false } = {}) {
  let q = supabase.from("attrezzature_catalogo").select("*").order("categoria").order("nome")
  if (soloDisponibili) q = q.eq("disponibile", true)
  const { data, error } = await q
  if (error) {
    logSupabaseError("noleggiAttrezzatureService.listAttrezzatureCatalogo", error)
    throw error
  }
  return data || []
}

export async function createAttrezzaturaCatalogo(payload) {
  const { data, error } = await supabase.from("attrezzature_catalogo").insert(payload).select().single()
  if (error) {
    logSupabaseError("noleggiAttrezzatureService.createAttrezzaturaCatalogo", error)
    throw error
  }
  return data
}

export async function updateAttrezzaturaCatalogo(id, patch) {
  if (!id) throw new Error("id mancante")
  const { data, error } = await supabase.from("attrezzature_catalogo").update(patch).eq("id", id).select().single()
  if (error) {
    logSupabaseError("noleggiAttrezzatureService.updateAttrezzaturaCatalogo", error)
    throw error
  }
  return data
}

export async function listTenantNoleggi(tenantId) {
  if (!tenantId) return []
  const { data, error } = await supabase
    .from("tenant_noleggi")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
  if (error) {
    logSupabaseError("noleggiAttrezzatureService.listTenantNoleggi", error)
    throw error
  }
  return data || []
}

export async function createTenantNoleggio(payload) {
  const { data, error } = await supabase.from("tenant_noleggi").insert(payload).select().single()
  if (error) {
    logSupabaseError("noleggiAttrezzatureService.createTenantNoleggio", error)
    throw error
  }
  return data
}

export async function updateTenantNoleggio(id, patch) {
  if (!id) throw new Error("id mancante")
  const { data, error } = await supabase.from("tenant_noleggi").update(patch).eq("id", id).select().single()
  if (error) {
    logSupabaseError("noleggiAttrezzatureService.updateTenantNoleggio", error)
    throw error
  }
  return data
}
