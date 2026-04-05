import { supabase } from "@/lib/supabaseClient"

/**
 * Riesegue login con email sessione corrente + password inserita (solo verifica).
 * Utile prima di mostrare dati sensibili (es. note password dipendenti).
 */
export async function verifyCurrentAdminPassword(password) {
  const pwd = typeof password === "string" ? password : ""
  if (!pwd) return { ok: false, message: "Inserisci la password." }

  const { data: sessionData, error: sessionErr } = await supabase.auth.getSession()
  if (sessionErr || !sessionData?.session?.user?.email) {
    return { ok: false, message: "Sessione non valida. Effettua di nuovo l’accesso." }
  }

  const email = String(sessionData.session.user.email).trim()
  const { error } = await supabase.auth.signInWithPassword({ email, password: pwd })
  if (error) {
    return { ok: false, message: "Password non corretta." }
  }
  return { ok: true }
}
