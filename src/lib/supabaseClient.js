import { createClient } from "@supabase/supabase-js";
import { getSupabaseConfiguredHostname, resolveSupabaseUrlForRuntime } from "@/lib/supabaseEnv";

const rawUrl = String(import.meta.env.VITE_SUPABASE_URL ?? "").trim();
const supabaseUrl = resolveSupabaseUrlForRuntime(rawUrl);
const supabaseAnonKey = String(import.meta.env.VITE_SUPABASE_ANON_KEY ?? "").trim();

if (import.meta.env.DEV) {
  console.log(
    "[Supabase]",
    supabaseUrl ? "URL configurato" : "URL mancante (VITE_SUPABASE_URL)",
    supabaseAnonKey ? "key presente" : "key mancante (VITE_SUPABASE_ANON_KEY)",
  );
}
if (!import.meta.env.DEV && (!supabaseUrl || !supabaseAnonKey)) {
  console.error(
    "[Supabase] In produzione URL o ANON_KEY mancanti: le chiamate a Supabase falliscono. Verifica .env.production e rifai npm run build.",
  );
}
if (
  !import.meta.env.DEV &&
  typeof window !== "undefined" &&
  window.location.protocol === "https:" &&
  rawUrl &&
  /^http:\/\//i.test(rawUrl) &&
  /\.supabase\.co/i.test(rawUrl)
) {
  console.warn(
    "[Supabase] VITE_SUPABASE_URL usa http: su dominio HTTPS: rischio mixed content — in .env.production usa https:// per il progetto Supabase.",
  );
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

if (import.meta.env.PROD && typeof window !== "undefined" && supabaseUrl) {
  const h = getSupabaseConfiguredHostname();
  if (h) console.info("[Supabase] Host API incluso nel bundle:", h);
  if (h === "localhost" || h === "127.0.0.1") {
    console.error(
      "[Supabase] L’URL del progetto punta a",
      h,
      "nel build produzione: da un dominio pubblico HTTPS il login fallisce. Imposta https://<ref>.supabase.co in .env.production e rifai build + deploy hosting.",
    );
  }
}
