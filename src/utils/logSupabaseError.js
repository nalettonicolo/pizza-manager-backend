/**
 * Log strutturato per errori PostgREST/Supabase (message, code, details, hint).
 * Non loggare token o password.
 * @param {string} scope
 * @param {import('@supabase/supabase-js').PostgrestError | Error | null | undefined} err
 * @param {Record<string, unknown>} [extra]
 */
export function logSupabaseError(scope, err, extra = {}) {
  console.error(`[${scope}]`, {
    message: err?.message,
    code: err?.code,
    details: err?.details,
    hint: err?.hint,
    ...extra,
  })
}
