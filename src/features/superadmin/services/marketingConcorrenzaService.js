// Servizio per l'area Superadmin "Marketing e Concorrenza": concorrenti monitorati e note
// strategiche di pricing/posizionamento. Vedi sql/modules/78_marketing_concorrenza.sql.
import { supabase } from "@/lib/supabaseClient"
import { logSupabaseError } from "@/utils/logSupabaseError"

export async function listConcorrenti() {
  const { data, error } = await supabase.from("concorrenti").select("*").order("nome", { ascending: true })
  if (error) {
    logSupabaseError("marketingConcorrenzaService.listConcorrenti", error)
    throw error
  }
  return data || []
}

export async function upsertConcorrente(row) {
  const { data, error } = await supabase.from("concorrenti").upsert(row).select().single()
  if (error) {
    logSupabaseError("marketingConcorrenzaService.upsertConcorrente", error)
    throw error
  }
  return data
}

export async function listNoteMarketing({ categoria } = {}) {
  let q = supabase.from("note_marketing").select("*").order("priorita", { ascending: false }).order("created_at", { ascending: false })
  if (categoria) q = q.eq("categoria", categoria)
  const { data, error } = await q
  if (error) {
    logSupabaseError("marketingConcorrenzaService.listNoteMarketing", error)
    throw error
  }
  return data || []
}

export async function upsertNotaMarketing(row) {
  const { data, error } = await supabase.from("note_marketing").upsert(row).select().single()
  if (error) {
    logSupabaseError("marketingConcorrenzaService.upsertNotaMarketing", error)
    throw error
  }
  return data
}

export async function updateNotaStato(id, stato) {
  const { data, error } = await supabase.from("note_marketing").update({ stato }).eq("id", id).select().single()
  if (error) {
    logSupabaseError("marketingConcorrenzaService.updateNotaStato", error)
    throw error
  }
  return data
}

export const NOTA_CATEGORIE = Object.freeze([
  "pricing",
  "posizionamento",
  "funnel_acquisizione",
  "differenziazione",
  "messaggistica",
  "seo",
  "ai_visibility",
  "social",
  "go_to_market",
  "altro",
])

export const NOTA_STATI = Object.freeze(["da_valutare", "approvata", "scartata", "implementata"])
