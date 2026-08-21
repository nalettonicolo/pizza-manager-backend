import { useEffect, useRef, useState } from "react"
import { supabase } from "@/lib/supabaseClient"

/** Sync posizione server: al massimo una volta ogni 60s (RPC rider_upsert_posizione). */
const SYNC_MIN_INTERVAL_MS = 60000

/**
 * Posizione GPS locale (per l'ordinamento nearest-neighbor in Delivery Dashboard), con sync
 * opzionale lato server: se il chiamante risulta essere un rider (RPC `rider_upsert_posizione`,
 * modulo SQL 42/42b — risolve il rider dal JWT via `core.rider.auth_user_id`), la posizione viene
 * anche salvata su `core.rider_posizione` al massimo ogni 60s. Chi non è un rider (es. staff che
 * apre la dashboard solo per supervisione) riceve `rider non trovato per l'utente corrente` dalla
 * RPC: l'errore viene ignorato in silenzio, non è un fallimento della sync locale.
 * @returns {{ position: { lat: number, lng: number } | null }}
 */
export function useRiderPositionSync() {
  const [position, setPosition] = useState(null)
  const lastSyncAtRef = useRef(0)
  const notARiderRef = useRef(false)

  useEffect(() => {
    if (!navigator.geolocation) return undefined

    const syncToServer = async (lat, lng, accuracy) => {
      if (notARiderRef.current) return
      const now = Date.now()
      if (now - lastSyncAtRef.current < SYNC_MIN_INTERVAL_MS) return
      lastSyncAtRef.current = now
      try {
        const { error } = await supabase.rpc("rider_upsert_posizione", {
          p_lat: lat,
          p_lng: lng,
          p_accuracy_m: accuracy ?? null,
        })
        if (error) {
          if (/rider non trovato/i.test(error.message || "")) {
            notARiderRef.current = true
          } else {
            throw error
          }
        }
      } catch (e) {
        console.warn("[useRiderPositionSync] sync posizione:", e?.message ?? e)
      }
    }

    const watch = navigator.geolocation.watchPosition(
      (pos) => {
        const lat = pos.coords.latitude
        const lng = pos.coords.longitude
        setPosition({ lat, lng })
        void syncToServer(lat, lng, pos.coords.accuracy)
      },
      () => {},
      { enableHighAccuracy: false, maximumAge: 60000 },
    )
    return () => navigator.geolocation.clearWatch(watch)
  }, [])

  return { position }
}
