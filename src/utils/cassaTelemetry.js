/**
 * Telemetria checkout cassa: console + hook opzionale + Sentry (se DSN configurato).
 */

const PREFIX = "[CassaTelemetry]"

let sentryModulePromise = null

function loadSentry() {
  if (!sentryModulePromise) {
    sentryModulePromise = import("@sentry/react").catch(() => null)
  }
  return sentryModulePromise
}

function hasSentryDsn() {
  return Boolean(String(import.meta.env.VITE_SENTRY_DSN ?? "").trim())
}

export function markCheckoutStart() {
  const t0 = typeof performance !== "undefined" && performance.now ? performance.now() : Date.now()
  return { t0 }
}

/**
 * @param {{ t0: number }} ctx
 * @param {{ ok: boolean, tenantId?: string, ordineId?: string, ms?: number, errorMessage?: string }} meta
 */
export function markCheckoutEnd(ctx, meta) {
  const t1 = typeof performance !== "undefined" && performance.now ? performance.now() : Date.now()
  const ms = meta.ms ?? (ctx?.t0 != null ? Math.round(t1 - ctx.t0) : undefined)
  const payload = {
    ok: meta.ok,
    tenantId: meta.tenantId,
    ordineId: meta.ordineId,
    durationMs: ms,
    errorMessage: meta.errorMessage,
    at: new Date().toISOString(),
  }
  if (meta.ok) {
    console.info(PREFIX, "checkout_ok", payload)
  } else {
    console.warn(PREFIX, "checkout_err", payload)
  }
  if (typeof window !== "undefined" && typeof window.__CASSA_TELEMETRY_HOOK__ === "function") {
    try {
      window.__CASSA_TELEMETRY_HOOK__(payload)
    } catch {
      /* ignore */
    }
  }
  if (hasSentryDsn()) {
    void reportCheckoutToSentry(payload)
  }
}

async function reportCheckoutToSentry(payload) {
  const Sentry = await loadSentry()
  if (!Sentry) return
  const tags = {
    area: "cassa",
    checkout_ok: String(payload.ok),
  }
  if (payload.tenantId) tags.tenant_id = payload.tenantId
  if (payload.ordineId) tags.ordine_id = payload.ordineId

  Sentry.withScope((scope) => {
    scope.setTags(tags)
    scope.setContext("cassa_checkout", {
      duration_ms: payload.durationMs,
      at: payload.at,
    })
    if (payload.ok) {
      Sentry.captureMessage("cassa_checkout_ok", "info")
    } else {
      Sentry.captureMessage(payload.errorMessage || "cassa_checkout_err", "warning")
    }
  })
}
