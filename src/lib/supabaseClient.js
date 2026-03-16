import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? "";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? "";

if (import.meta.env.DEV) {
  console.log("[Supabase]", supabaseUrl ? "URL configurato" : "URL mancante (VITE_SUPABASE_URL)", supabaseAnonKey ? "key presente" : "key mancante (VITE_SUPABASE_ANON_KEY)");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
