import { useEffect, useRef } from "react"
import { useLocation } from "react-router-dom"
import { supabase } from "@/lib/supabaseClient"
import { useAuth } from "@/app/contexts/AuthContext"

const HEARTBEAT_MS = 25_000

function labelFromPath(pathname) {
  const p = String(pathname || "/")
  if (p.startsWith("/operative/cassa")) return "Cassa"
  if (p.startsWith("/operative/cucina")) return "Cucina"
  if (p.startsWith("/operative/bancone")) return "Bancone"
  if (p.startsWith("/operative/delivery")) return "Delivery"
  if (p.startsWith("/operative/pizzaioli")) return "Pizzaioli"
  if (p.startsWith("/operative")) return "Operativo"
  if (p.startsWith("/admin")) return "Admin"
  if (p.startsWith("/cliente")) return "Area cliente"
  if (p.startsWith("/preview") || p.startsWith("/negozio")) return "Vetrina"
  if (p.startsWith("/superadmin")) return null // non pubblicare presence SA
  return p
}

/**
 * Heartbeat path corrente → support_presence (per Sala QA Super Admin).
 * Il tenant è deciso solo dal DB in base a auth.uid() (modulo SQL 30):
 * non inviamo p_tenant_id come autorizzazione.
 */
export function useSupportPresenceHeartbeat() {
  const { user, ruolo, isSupportTenantMode } = useAuth()
  const location = useLocation()
  const lastSent = useRef("")

  useEffect(() => {
    if (!user?.id) return
    // Super Admin: non pubblica presence (né in console SA né in override supporto).
    if (ruolo === "superadmin") return
    if (isSupportTenantMode) return

    const path = `${location.pathname}${location.search || ""}`
    const label = labelFromPath(location.pathname)
    if (label == null) return

    const key = path
    const send = async () => {
      try {
        await supabase.rpc("upsert_support_presence", {
          p_path: path.slice(0, 500),
          p_page_label: label,
          p_tenant_id: null,
        })
        lastSent.current = key
      } catch {
        /* ignore — tabella/RPC assenti in ambienti non migrati */
      }
    }

    if (lastSent.current !== key) void send()
    const t = window.setInterval(() => void send(), HEARTBEAT_MS)
    return () => window.clearInterval(t)
  }, [user?.id, ruolo, isSupportTenantMode, location.pathname, location.search])
}
