import { supabase } from "@/lib/supabaseClient"

function originOrEmpty() {
  return typeof window !== "undefined" ? window.location.origin : ""
}

/**
 * Registrazione cliente (sito pizzeria). `tenantId` viene messo in user_metadata per il trigger handle_new_auth_user.
 */
export async function signUpCliente({ email, password, tenantId, nome, telefono, indirizzo }) {
  if (!tenantId) return { data: null, error: new Error("Tenant non disponibile. Ricarica la pagina.") }
  const origin = originOrEmpty()
  return supabase.auth.signUp({
    email: String(email).trim(),
    password,
    options: {
      emailRedirectTo: origin ? `${origin}/` : undefined,
      data: {
        tenant_id: tenantId,
        nome: nome != null ? String(nome).trim() : "",
        telefono: telefono != null ? String(telefono).trim() : "",
        indirizzo: indirizzo != null ? String(indirizzo).trim() : "",
      },
    },
  })
}

/** Reset password: link nel mail punta a /reimposta-password sullo stesso dominio della vetrina. */
export async function requestClientePasswordReset(email) {
  const origin = originOrEmpty()
  if (!origin) return { data: null, error: new Error("Origine non disponibile.") }
  return supabase.auth.resetPasswordForEmail(String(email).trim(), {
    redirectTo: `${origin}/reimposta-password`,
  })
}
