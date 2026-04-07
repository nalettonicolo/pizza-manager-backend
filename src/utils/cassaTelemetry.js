/**
 * Telemetria leggera checkout cassa (nessuna dipendenza esterna).
 * In dev: log strutturato su console. In prod: stesso canale; integrare Sentry/OTel in seguito.
 */

const PREFIX = "[CassaTelemetry]"

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
}
