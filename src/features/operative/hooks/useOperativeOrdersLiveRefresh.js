import { useEffect, useRef } from "react"
import { supabase } from "@/lib/supabaseClient"

let channelSeq = 0

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

    // Nome canale univoco per ogni mount dell'hook, non solo per tenant: in "Test 4 reparti"
    // Pizzaioli/Bancone/Cucina/Delivery montano TUTTI questo hook contemporaneamente sullo stesso
    // tenant — prima il topic era identico per tutti e quattro (`operative-ordini:${tenantId}`),
    // e il client Realtime di Supabase non deduplica i join sullo stesso topic: le 4 subscribe
    // concorrenti sullo stesso nome si intralciavano a vicenda, e in pratica gli eventi arrivavano
    // solo al fallback di polling (30s) invece che in tempo reale — da cui il ritardo percepito
    // segnalato dal vivo (click "In forno" su Pizzaioli → comparsa su Bancone dopo ~30s).
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
          // Non blocca l'app (il polling sotto resta attivo come fallback), ma senza questo log
          // un fallimento di Realtime era invisibile: sembrava solo "un po' lento", non "rotto".
          console.warn(`[useOperativeOrdersLiveRefresh] canale Realtime ${status.toLowerCase()} per tenant ${tenantId} — resto sul polling ogni ${Math.max(8000, pollMs) / 1000}s`)
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
