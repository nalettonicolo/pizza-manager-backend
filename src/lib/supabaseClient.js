import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? "";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? "";

if (import.meta.env.DEV) {
  console.log("[Supabase]", supabaseUrl ? "URL configurato" : "URL mancante (VITE_SUPABASE_URL)", supabaseAnonKey ? "key presente" : "key mancante (VITE_SUPABASE_ANON_KEY)");
}
if (!import.meta.env.DEV && (!supabaseUrl || !supabaseAnonKey)) {
  console.error("[Supabase] In produzione URL o ANON_KEY mancanti: le chiamate a Supabase daranno 401. Verifica .env.production e rifai npm run build.");
}

/**
 * Edge (Tracking Prevention) o impostazioni privacy possono bloccare localStorage.
 * Supabase auth usa lo storage per il refresh token: senza fallback la sessione può risultare assente.
 * Adapter minimale compatibile con @supabase/supabase-js (getItem / setItem / removeItem sincroni).
 */
function getAuthStorage() {
  if (typeof window === "undefined") return undefined;
  try {
    const probe = "__pm_supabase_ls_probe__";
    window.localStorage.setItem(probe, "1");
    window.localStorage.removeItem(probe);
    return window.localStorage;
  } catch {
    const memory = new Map();
    return {
      getItem: (key) => (memory.has(key) ? memory.get(key) : null),
      setItem: (key, value) => {
        memory.set(key, String(value));
      },
      removeItem: (key) => {
        memory.delete(key);
      },
    };
  }
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: getAuthStorage(),
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
