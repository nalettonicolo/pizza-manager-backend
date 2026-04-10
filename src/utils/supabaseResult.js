import { logSupabaseError } from "./logSupabaseError.js"

/**
 * Esegue una chiamata Supabase `.select()` / `.insert()` ecc. che restituisce `{ data, error }`.
 * In caso di errore logga con `logSupabaseError` e rilancia (o restituisce `null` se `soft`).
 *
 * @template T
 * @param {string} scope - Etichetta per i log (es. nome feature)
 * @param {Promise<{ data: T; error: import('@supabase/supabase-js').PostgrestError | null }>} resultPromise
 * @param {{ soft?: boolean }} [opts] - `soft: true` → non throw, ritorna `null` e logga
 * @returns {Promise<T | null>}
 */
export async function unwrapSupabase(scope, resultPromise, opts = {}) {
  const { data, error } = await resultPromise
  if (error) {
    logSupabaseError(scope, error)
    if (opts.soft) return null
    throw error
  }
  return data
}
