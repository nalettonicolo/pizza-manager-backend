import { useEffect, useRef } from "react"
import { supabase } from "@/lib/supabaseClient"
import { subscribeOperativeOrdersBroadcast } from "@/utils/operativeOrderBroadcast"

let channelSeq = 0

/**
 * Refresh ordini operativi via Supabase Realtime (core.ordini) + segnale stesso-browser
 * + polling di sicurezza.
 * @param {object} opts
 * @param {string|null|undefined} opts.tenantId
 * @param {() => void|Promise<void>} opts.onRefresh — tipicamente loadOrders({ silent: true })
 * @param {number} [opts.pollMs=8000] — fallback se Realtime non arriva (minimo 8s)
 * @param {number} [opts.debounceMs=80] — raggruppa burst Realtime ravvicinati in un solo reload
 */
export function useOperativeOrdersLiveRefresh({ tenantId, onRefresh, pollMs = 8000, debounceMs = 80 }) {
  const onRefreshRef = useRef(onRefresh)
  onRefreshRef.current = onRefresh

  useEffect(() => {
    if (!tenantId || typeof onRefreshRef.current !== "function") return undefined

    let cancelled = false
    // Un reload alla volta: se ne arriva un altro (evento Realtime/broadcast/poll) mentre uno è
    // già in corso, non lo affianca (doppia query di rete in parallelo, spreco inutile) — lo mette
    // in coda e parte una volta sola appena il reload in corso finisce.
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
      }, debounceMs)
    }

    run() // primo caricamento all'avvio: immediato, nessun debounce

    // Nome canale univoco per ogni mount dell'hook, non solo per tenant: in "Test 4 reparti"
    // Pizzaioli/Bancone/Cucina/Delivery montano TUTTI questo hook contemporaneamente sullo stesso
    // tenant — prima il topic era identico per tutti e quattro (`operative-ordini:${tenantId}`),
    // e il client Realtime di Supabase non deduplica i join sullo stesso topic: le 4 subscribe
    // concorrenti sullo stesso nome si intralciavano a vicenda, e in pratica gli eventi arrivavano
    // solo al fallback di polling invece che in tempo reale — da cui il ritardo percepito
    // segnalato dal vivo (click "In forno" su Pizzaioli → comparsa su Bancone dopo decine di secondi).
    // Oggi: canale univoco + segnale stesso-browser (BroadcastChannel) + poll 8s di sicurezza.
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
    const unsubBroadcast = subscribeOperativeOrdersBroadcast(() => scheduleRun())

    return () => {
      cancelled = true
      unsubBroadcast()
      if (debounceTimer) window.clearTimeout(debounceTimer)
      window.clearInterval(poll)
      void supabase.removeChannel(channel)
    }
  }, [tenantId, pollMs, debounceMs])
}
