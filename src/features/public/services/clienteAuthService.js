import { supabase } from "@/lib/supabaseClient"

function originOrEmpty() {
  return typeof window !== "undefined" ? window.location.origin : ""
}

function clientePostConfirmUrl(origin) {
  if (!origin) return undefined
  return `${origin}/cliente/dashboard`
}

/**
 * Registrazione cliente (sito pizzeria). `tenantId` viene messo in user_metadata per il trigger handle_new_auth_user.
 */
export async function signUpCliente({
  email,
  password,
  tenantId,
  nome,
  telefono,
  indirizzo,
  latitudine = null,
  longitudine = null,
  noteConsegna = "",
}) {
  if (!tenantId) return { data: null, error: new Error("Tenant non disponibile. Ricarica la pagina.") }
  const origin = originOrEmpty()
  const lat = latitudine != null && Number.isFinite(Number(latitudine)) ? Number(latitudine) : null
  const lng = longitudine != null && Number.isFinite(Number(longitudine)) ? Number(longitudine) : null
  return supabase.auth.signUp({
    email: String(email).trim(),
    password,
    options: {
      emailRedirectTo: clientePostConfirmUrl(origin),
      data: {
        tenant_id: tenantId,
        nome: nome != null ? String(nome).trim() : "",
        telefono: telefono != null ? String(telefono).trim() : "",
        indirizzo: indirizzo != null ? String(indirizzo).trim() : "",
        ...(lat != null ? { latitudine: lat } : {}),
        ...(lng != null ? { longitudine: lng } : {}),
        note_consegna: noteConsegna != null ? String(noteConsegna).trim() : "",
      },
    },
  })
}

/** Aggiorna profilo cliente (RPC tenant-safe). */
export async function updateClienteProfilo({
  nome,
  telefono,
  indirizzo,
  noteConsegna = "",
  latitudine = null,
  longitudine = null,
}) {
  const lat = latitudine != null && Number.isFinite(Number(latitudine)) ? Number(latitudine) : null
  const lng = longitudine != null && Number.isFinite(Number(longitudine)) ? Number(longitudine) : null
  const { error } = await supabase.rpc("cliente_aggiorna_proprio_profilo", {
    p_nome: nome != null ? String(nome).trim() : null,
    p_telefono: telefono != null ? String(telefono).trim() : null,
    p_indirizzo: indirizzo != null ? String(indirizzo).trim() : null,
    p_note_consegna: noteConsegna != null ? String(noteConsegna).trim() : "",
    p_latitudine: lat,
    p_longitudine: lng,
  })
  if (error) return { error }
  const meta = {
    ...(nome != null ? { nome: String(nome).trim() } : {}),
    ...(telefono != null ? { telefono: String(telefono).trim() } : {}),
    ...(indirizzo != null ? { indirizzo: String(indirizzo).trim() } : {}),
    note_consegna: noteConsegna != null ? String(noteConsegna).trim() : "",
    ...(lat != null ? { latitudine: lat } : {}),
    ...(lng != null ? { longitudine: lng } : {}),
  }
  await supabase.auth.updateUser({ data: meta })
  return { error: null }
}

/** Reset password: link nel mail punta a /reimposta-password sullo stesso dominio della vetrina. */
export async function requestClientePasswordReset(email) {
  const origin = originOrEmpty()
  if (!origin) return { data: null, error: new Error("Origine non disponibile.") }
  return supabase.auth.resetPasswordForEmail(String(email).trim(), {
    redirectTo: `${origin}/reimposta-password`,
  })
}

/** Storico ordini web del cliente autenticato (RPC tenant-safe). */
export async function listClienteOrdini({ limit = 50, offset = 0 } = {}) {
  const { data, error } = await supabase.rpc("cliente_lista_propri_ordini", {
    p_limit: limit,
    p_offset: offset,
  })
  if (error) return { data: [], error }
  return { data: Array.isArray(data) ? data : [], error: null }
}

/** Dettaglio ordine con righe (solo ordini propri). */
export async function getClienteOrdineDettaglio(ordineId) {
  if (!ordineId) return { data: null, error: new Error("Ordine non valido.") }
  const { data, error } = await supabase.rpc("cliente_dettaglio_proprio_ordine", {
    p_ordine_id: ordineId,
  })
  if (error) return { data: null, error }
  return { data: data && typeof data === "object" ? data : null, error: null }
}

/** Saldo fidelity e ultimi movimenti (RPC tenant-safe). */
export async function getClienteFidelityProfile() {
  const { data, error } = await supabase.rpc("cliente_get_fidelity_profile")
  if (error) return { data: null, error }
  return { data: data && typeof data === "object" ? data : null, error: null }
}
