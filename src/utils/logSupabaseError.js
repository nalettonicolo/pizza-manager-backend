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

/**
 * Log per errori HTTP (axios/fetch), senza body né header sensibili.
 * @param {string} scope
 * @param {import('axios').AxiosError | Error | unknown} err
 * @param {Record<string, unknown>} [extra]
 */
export function logHttpError(scope, err, extra = {}) {
  const ax = err && typeof err === "object" && "isAxiosError" in err ? err : null
  console.error(`[${scope}]`, {
    message: ax?.message ?? err?.message,
    status: ax?.response?.status,
    url: ax?.config?.url,
    ...extra,
  })
}
