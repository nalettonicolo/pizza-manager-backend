import { useEffect, useRef } from "react"
import { supabase } from "@/lib/supabaseClient"
import { subscribeOperativeOrderSync } from "@/features/operative/hooks/operativeOrderSync"

let channelSeq = 0

/**
 * Refresh ordini operativi: bus in-process (istantaneo), Realtime, polling rapido.
 * @param {object} opts
 * @param {string|null|undefined} opts.tenantId
 * @param {() => void|Promise<void>} opts.onRefresh
 * @param {number} [opts.pollMs=1000]
 * @param {number} [opts.debounceMs=40]
 */
export function useOperativeOrdersLiveRefresh({ tenantId, onRefresh, pollMs = 1000, debounceMs = 40 }) {
  const onRefreshRef = useRef(onRefresh)
  onRefreshRef.current = onRefresh

  useEffect(() => {
    if (!tenantId || typeof onRefreshRef.current !== "function") return undefined

    let cancelled = false
    let inFlight = false
    let queued = false

    const run = () => {
      if (cancelled) return
      if (inFlight) {
        queued = true
        return
      }
      inFlight = true
      void Promise.resolve(onRefreshRef.current())
        .catch(() => {})
        .finally(() => {
          inFlight = false
          if (queued && !cancelled) {
            queued = false
            run()
          }
        })
    }

    let debounceTimer = null
    const scheduleRun = () => {
      if (cancelled) return
      if (debounceTimer) window.clearTimeout(debounceTimer)
      debounceTimer = window.setTimeout(() => {
        debounceTimer = null
        run()
      }, Math.max(0, debounceMs))
    }

    run()

    const unsubBus = subscribeOperativeOrderSync(() => {
      scheduleRun()
    })

    channelSeq += 1
    const channel = supabase
      .channel(`operative-ordini:${tenantId}:${channelSeq}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "core",
          table: "ordini",
          filter: `tenant_id=eq.${tenantId}`,
        },
        () => scheduleRun(),
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          console.warn(
            `[useOperativeOrdersLiveRefresh] canale Realtime ${status.toLowerCase()} per tenant ${tenantId} — polling ogni ${Math.max(1000, pollMs) / 1000}s`,
          )
        }
      })

    const poll = window.setInterval(run, Math.max(1000, pollMs))

    return () => {
      cancelled = true
      unsubBus()
      if (debounceTimer) window.clearTimeout(debounceTimer)
      window.clearInterval(poll)
      void supabase.removeChannel(channel)
    }
  }, [tenantId, pollMs, debounceMs])
}
