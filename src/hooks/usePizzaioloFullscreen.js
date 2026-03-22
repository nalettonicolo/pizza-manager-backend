/**
 * Schermo intero browser (area Pizzaiolo su tablet).
 * Nota: molti browser richiedono un gesto utente; il primo tap sulla pagina può attivare il fullscreen.
 */

import { useEffect } from "react"

export function requestBrowserFullscreen() {
  const el = document.documentElement
  const fn =
    el.requestFullscreen ||
    el.webkitRequestFullscreen ||
    el.webkitRequestFullScreen ||
    el.msRequestFullscreen
  if (!fn) return Promise.resolve(false)
  return Promise.resolve(fn.call(el))
    .then(() => true)
    .catch(() => false)
}

export function isTabletLike() {
  if (typeof window === "undefined") return false
  const narrow = window.matchMedia("(max-width: 1280px)").matches
  const touch = "ontouchstart" in window || navigator.maxTouchPoints > 0
  return narrow && touch
}

/**
 * Su tablet, al primo tocco o click sulla pagina prova ad entrare in fullscreen.
 */
export function useAutoFullscreenOnTablet(active) {
  useEffect(() => {
    if (!active || !isTabletLike()) return
    let done = false
    const tryOnce = () => {
      if (done) return
      done = true
      requestBrowserFullscreen()
    }
    window.addEventListener("touchstart", tryOnce, { once: true, passive: true })
    window.addEventListener("click", tryOnce, { once: true, passive: true })
    return () => {
      window.removeEventListener("touchstart", tryOnce)
      window.removeEventListener("click", tryOnce)
    }
  }, [active])
}
