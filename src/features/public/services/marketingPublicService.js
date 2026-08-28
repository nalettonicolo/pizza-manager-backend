// Letture pubbliche (anon) per FAQ, landing page e articoli blog del sito marketing.
// Vedi sql/modules/79_piano_attacco_seo_faq.sql e sql/modules/80_marketing_contenuti_blog_landing.sql.
// Tutte le query filtrano già lato RLS su pubblicata/pubblicato = true.
import { supabase } from "@/lib/supabaseClient"
import { logSupabaseError } from "@/utils/logSupabaseError"

export async function getFaqPubbliche() {
  const { data, error } = await supabase
    .from("faq_pubbliche")
    .select("id, domanda, risposta, categoria, ordine")
    .eq("pubblicata", true)
    .order("ordine", { ascending: true })
  if (error) {
    logSupabaseError("marketingPublicService.getFaqPubbliche", error)
    return []
  }
  return data || []
}

export async function getLandingPageBySlug(slug) {
  if (!slug) return null
  const { data, error } = await supabase
    .from("landing_pages")
    .select("*")
    .eq("slug", slug)
    .eq("pubblicata", true)
    .maybeSingle()
  if (error) {
    logSupabaseError("marketingPublicService.getLandingPageBySlug", error)
    return null
  }
  return data || null
}

export async function getBlogArticoloBySlug(slug) {
  if (!slug) return null
  const { data, error } = await supabase
    .from("blog_articoli")
    .select("*")
    .eq("slug", slug)
    .eq("pubblicato", true)
    .maybeSingle()
  if (error) {
    logSupabaseError("marketingPublicService.getBlogArticoloBySlug", error)
    return null
  }
  return data || null
}
