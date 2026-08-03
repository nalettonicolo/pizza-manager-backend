import { useEffect, useRef } from "react"
import { supabase } from "@/lib/supabaseClient"

/**
 * Refresh ordini operativi via Supabase Realtime (core.ordini) + polling di sicurezza.
 * @param {object} opts
 * @param {string|null|undefined} opts.tenantId
 * @param {() => void|Promise<void>} opts.onRefresh — tipicamente loadOrders({ silent: true })
 * @param {number} [opts.pollMs=30000] — fallback se Realtime non arriva
 */
export function useOperativeOrdersLiveRefresh({ tenantId, onRefresh, pollMs = 30000 }) {
  const onRefreshRef = useRef(onRefresh)
  onRefreshRef.current = onRefresh

  useEffect(() => {
    if (!tenantId || typeof onRefreshRef.current !== "function") return undefined

    let cancelled = false
    const run = () => {
      if (cancelled) return
      void Promise.resolve(onRefreshRef.current()).catch(() => {})
    }

    run()

    const channel = supabase
      .channel(`operative-ordini:${tenantId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "core",
          table: "ordini",
          filter: `tenant_id=eq.${tenantId}`,
        },
        () => run(),
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          // polling resta attivo come fallback
        }
      })

    const poll = window.setInterval(run, Math.max(8000, pollMs))

    return () => {
      cancelled = true
      window.clearInterval(poll)
      void supabase.removeChannel(channel)
    }
  }, [tenantId, pollMs])
}
