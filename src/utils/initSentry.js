/**
 * Inizializzazione opzionale Sentry (solo se `import.meta.env.VITE_SENTRY_DSN` è valorizzato).
 * Filtra PII evidenti; non inviare email/nome cliente in beforeSend.
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
      tracesSampleRate: import.meta.env.PROD ? 0.1 : 0,
      beforeSend(event) {
        if (event.user?.email) delete event.user.email
        if (event.user?.username) delete event.user.username
        return event
      },
    })

    if (typeof window !== "undefined" && typeof window.__CASSA_TELEMETRY_HOOK__ !== "function") {
      window.__CASSA_TELEMETRY_HOOK__ = (payload) => {
        Sentry.addBreadcrumb({
          category: "cassa",
          message: payload.ok ? "checkout_ok" : "checkout_err",
          level: payload.ok ? "info" : "warning",
          data: {
            duration_ms: payload.durationMs,
            tenant_id: payload.tenantId,
            ordine_id: payload.ordineId,
          },
        })
      }
    }
  } catch (e) {
    console.warn("[initSentry] @sentry/react non disponibile", e)
  }
}
