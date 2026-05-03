import { devWarn } from "@/lib/devLog"

let misconfigWarned = false

/** Login JWT Nest attivo: richiede anche `VITE_API_URL` verso il backend. */
export function isNestAuthEnabled() {
  if (import.meta.env.VITE_USE_NEST_AUTH !== "true") return false
  const url = String(import.meta.env.VITE_API_URL ?? "").trim()
  if (!url) {
    if (!misconfigWarned) {
      misconfigWarned = true
      devWarn("nestAuthMode", "VITE_USE_NEST_AUTH senza VITE_API_URL, uso Supabase")
    }
    return false
  }
  return true
}
