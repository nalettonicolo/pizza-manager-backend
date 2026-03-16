import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? "";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? "";

if (import.meta.env.DEV) {
  console.log("[Supabase]", supabaseUrl ? "URL configurato" : "URL mancante (VITE_SUPABASE_URL)", supabaseAnonKey ? "key presente" : "key mancante (VITE_SUPABASE_ANON_KEY)");
}
if (!import.meta.env.DEV && (!supabaseUrl || !supabaseAnonKey)) {
  console.error("[Supabase] In produzione URL o ANON_KEY mancanti: le chiamate a Supabase daranno 401. Verifica .env.production e rifai npm run build.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
