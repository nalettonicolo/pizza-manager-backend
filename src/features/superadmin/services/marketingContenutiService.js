// Servizio per l'area Superadmin "Marketing → Contenuti" (blog + landing page).
// Vedi sql/modules/80_marketing_contenuti_blog_landing.sql.
import { supabase } from "@/lib/supabaseClient"
import { logSupabaseError } from "@/utils/logSupabaseError"

export async function listBlogArticoli() {
  const { data, error } = await supabase.from("blog_articoli").select("*").order("created_at", { ascending: false })
  if (error) {
    logSupabaseError("marketingContenutiService.listBlogArticoli", error)
    throw error
  }
  return data || []
}

export async function upsertBlogArticolo(row) {
  const { data, error } = await supabase.from("blog_articoli").upsert(row).select().single()
  if (error) {
    logSupabaseError("marketingContenutiService.upsertBlogArticolo", error)
    throw error
  }
  return data
}

export async function listLandingPages() {
  const { data, error } = await supabase.from("landing_pages").select("*").order("tipo", { ascending: true }).order("slug", { ascending: true })
  if (error) {
    logSupabaseError("marketingContenutiService.listLandingPages", error)
    throw error
  }
  return data || []
}

export async function upsertLandingPage(row) {
  const { data, error } = await supabase.from("landing_pages").upsert(row).select().single()
  if (error) {
    logSupabaseError("marketingContenutiService.upsertLandingPage", error)
    throw error
  }
  return data
}
