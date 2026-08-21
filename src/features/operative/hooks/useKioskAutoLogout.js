import { useEffect, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "@/app/contexts/AuthContext"

/** Eventi che contano come attività utente e resettano il timer. */
const ACTIVITY_EVENTS = ["click", "touchstart", "keydown"]

/**
 * Logout automatico per postazioni kiosk/tablet condivise: dopo `timeoutMin` minuti senza
 * click/tocco/tasto, esegue logout() e reindirizza a /login. **Non collegata di default** — va
 * abilitata esplicitamente con `enabled` (vedi OperativeLayout.jsx, gated su
 * `parametri_operativi.kiosk_logout_minuti`).
 * @param {object} opts
 * @param {boolean} opts.enabled
 * @param {number} opts.timeoutMin
 */
export function useKioskAutoLogout({ enabled, timeoutMin }) {
  const { logout } = useAuth()
  const navigate = useNavigate()
  const timerRef = useRef(null)
  const loggingOutRef = useRef(false)

  useEffect(() => {
    if (!enabled || !Number.isFinite(timeoutMin) || timeoutMin <= 0) return undefined

    const timeoutMs = timeoutMin * 60000

    const doLogout = async () => {
      if (loggingOutRef.current) return
      loggingOutRef.current = true
      try {
        await logout()
      } finally {
        navigate("/login", { replace: true })
      }
    }

    const resetTimer = () => {
      if (timerRef.current) window.clearTimeout(timerRef.current)
      timerRef.current = window.setTimeout(doLogout, timeoutMs)
    }

    resetTimer()
    for (const evt of ACTIVITY_EVENTS) {
      window.addEventListener(evt, resetTimer, { passive: true })
    }
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current)
      for (const evt of ACTIVITY_EVENTS) {
        window.removeEventListener(evt, resetTimer)
      }
    }
  }, [enabled, timeoutMin, logout, navigate])
}
