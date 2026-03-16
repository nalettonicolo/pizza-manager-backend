import { supabase } from "@/lib/supabaseClient";
import { sortByOrdine } from "@/utils/sortByOrdine";

export async function getPublicMenu() {
  const { data, error } = await supabase
    .from("Prodotto")
    .select("*")
    .eq("visibile_online", true)
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
    .select("id, nome, orari_settimana")
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Errore caricamento tenant pubblico:", error);
    return null;
  }

  return data || null;
}
