import { useEffect, useRef } from "react"
import { supabase } from "@/lib/supabaseClient"

/**
 * Refresh ordini operativi via Supabase Realtime (core.ordini) + polling di sicurezza.
 * @param {object} opts
 * @param {string|null|undefined} opts.tenantId
 * @param {() => void|Promise<void>} opts.onRefresh — tipicamente loadOrders({ silent: true })
 * @param {number} [opts.pollMs=30000] — fallback se Realtime non arriva
 * @param {number} [opts.debounceMs=300] — raggruppa più eventi Realtime ravvicinati (es. il
 *   pizzaiolo che clicca "In forno" su 3 ordini di fila) in un solo reload, invece di far
 *   partire un reload pesante e completo (più query in sequenza) per ognuno: senza questo,
 *   i reload si accavallano e competono per la rete, e lato reparto ricevente (es. Bancone)
 *   gli ordini appena segnati compaiono uno alla volta con un ritardo percepibile invece che
 *   tutti insieme.
 */
export function useOperativeOrdersLiveRefresh({ tenantId, onRefresh, pollMs = 30000, debounceMs = 300 }) {
  const onRefreshRef = useRef(onRefresh)
  onRefreshRef.current = onRefresh

  useEffect(() => {
    if (!tenantId || typeof onRefreshRef.current !== "function") return undefined

    let cancelled = false
    const run = () => {
      if (cancelled) return
      void Promise.resolve(onRefreshRef.current()).catch(() => {})
    }

    let debounceTimer = null
    const scheduleRun = () => {
      if (cancelled) return
      if (debounceTimer) window.clearTimeout(debounceTimer)
      debounceTimer = window.setTimeout(() => {
        debounceTimer = null
        run()
      }, debounceMs)
    }

    run() // primo caricamento all'avvio: immediato, nessun debounce

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
        () => scheduleRun(),
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          // polling resta attivo come fallback
        }
      })

    const poll = window.setInterval(run, Math.max(8000, pollMs))

    return () => {
      cancelled = true
      if (debounceTimer) window.clearTimeout(debounceTimer)
      window.clearInterval(poll)
      void supabase.removeChannel(channel)
    }
  }, [tenantId, pollMs, debounceMs])
}
