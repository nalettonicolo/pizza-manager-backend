import { supabase } from "@/lib/supabaseClient";
import { logSupabaseError } from "@/utils/logSupabaseError";
import { sortByOrdine } from "@/utils/sortByOrdine";

export async function getPublicMenu() {
  const { data, error } = await supabase
    .from("prodotti_menu_pubblico")
    .select("*")
    .order("nome", { ascending: true });

  if (error) {
    console.error("Errore caricamento menu pubblico:", error);
    throw error;
  }

  return sortByOrdine(data || []);
}

// Info tenant per home pubblica (usata per messaggi tipo "oggi siamo chiusi").
// Su domini dedicati di pizzeria, in genere esiste un solo tenant attivo.
export async function getPublicTenantInfo() {
  const { data, error } = await supabase
    .from("tenants")
    .select("id, nome, logo_url, indirizzo, email, telefono, orari_settimana, parametri_operativi")
    .limit(1)
    .maybeSingle();

  if (error) {
    logSupabaseError("publicService.getPublicTenantInfo", error, {
      operation: "from(tenants).select(...).limit(1).maybeSingle",
    });
    return null;
  }

  return data || null;
}
