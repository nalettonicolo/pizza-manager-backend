import { supabase } from "@/lib/supabaseClient";

/**
 * GET ALL OPERATIVE ROLES
 */
export async function getUserOperativeRoles(userId) {
  if (!userId) return [];

  const { data, error } = await supabase
    .from("user_operatives")
    .select("*")
    .eq("user_id", userId);

  if (error) {
    console.error("Errore getUserOperativeRoles:", error.message);
    return [];
  }

  return data || [];
}
