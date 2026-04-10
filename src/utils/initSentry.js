/**
 * Inizializzazione opzionale Sentry (solo se `import.meta.env.VITE_SENTRY_DSN` è valorizzato).
 * Non inviare PII né `tenant_id` senza consenso/privacy assessment: usare `beforeSend` in produzione.
 */
export async function initSentry() {
  const dsn =
    typeof import.meta !== "undefined" && import.meta.env?.VITE_SENTRY_DSN
      ? String(import.meta.env.VITE_SENTRY_DSN).trim()
      : ""
  if (!dsn) return

  try {
    const Sentry = await import("@sentry/react")
    const env = import.meta.env?.MODE || "development"

    Sentry.init({
      dsn,
      environment: env,
      // Estendere con integrations (tracing/replay) e beforeSend filtri privacy quando serve.
    })
  } catch (e) {
    console.warn("[initSentry] @sentry/react non disponibile", e)
  }
}
