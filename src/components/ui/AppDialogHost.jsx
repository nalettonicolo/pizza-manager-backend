import { useCallback, useEffect, useRef, useState } from "react"
import { registerAppDialogPresenter } from "@/utils/appDialog"
import "@/styles/app-dialog.css"

/**
 * Host globale: dialoghi alert/confirm centrati a schermo.
 * Montare una sola volta sotto i provider (main.jsx).
 */
export default function AppDialogHost() {
  const [state, setState] = useState(null)
  const resolverRef = useRef(null)
  const okBtnRef = useRef(null)

  const close = useCallback((result) => {
    const resolve = resolverRef.current
    resolverRef.current = null
    setState(null)
    if (resolve) resolve(Boolean(result))
  }, [])

  useEffect(() => {
    registerAppDialogPresenter((req) => {
      return new Promise((resolve) => {
        // Se un dialogo è già aperto, la coda in appDialog.js serializza.
        resolverRef.current = resolve
        setState(req)
      })
    })
    return () => registerAppDialogPresenter(null)
  }, [])

  useEffect(() => {
    if (!state) return undefined
    const onKey = (e) => {
      if (e.key === "Escape") {
        e.preventDefault()
        close(state.kind === "confirm" ? false : true)
      }
      if (e.key === "Enter" && state.kind === "alert") {
        e.preventDefault()
        close(true)
      }
    }
    document.addEventListener("keydown", onKey)
    const t = window.setTimeout(() => okBtnRef.current?.focus?.(), 30)
    return () => {
      document.removeEventListener("keydown", onKey)
      window.clearTimeout(t)
    }
  }, [state, close])

  if (!state) return null

  const variant = state.variant || "info"
  const isConfirm = state.kind === "confirm"

  return (
    <div className="app-dialog-overlay" role="presentation">
      <div
        className={`app-dialog app-dialog--${variant}`}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="app-dialog-title"
        aria-describedby="app-dialog-msg"
      >
        <h2 id="app-dialog-title" className="app-dialog-title">
          {state.title || (isConfirm ? "Conferma" : "Messaggio")}
        </h2>
        <p id="app-dialog-msg" className="app-dialog-message">
          {state.message}
        </p>
        <div className="app-dialog-actions">
          {isConfirm ? (
            <button type="button" className="app-dialog-btn app-dialog-btn--ghost" onClick={() => close(false)}>
              {state.cancelLabel || "Annulla"}
            </button>
          ) : null}
          <button
            ref={okBtnRef}
            type="button"
            className={`app-dialog-btn app-dialog-btn--primary app-dialog-btn--${variant}`}
            onClick={() => close(true)}
          >
            {state.okLabel || (isConfirm ? "Conferma" : "OK")}
          </button>
        </div>
      </div>
    </div>
  )
}
