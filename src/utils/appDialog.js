/**
 * Dialoghi in-app (alert / confirm) centrati — sostituiscono window.alert nativo.
 * Uso: await appAlert("Messaggio") · const ok = await appConfirm("Sei sicuro?")
 */

/** @typedef {{ kind: 'alert'|'confirm', title?: string, message: string, okLabel?: string, cancelLabel?: string, variant?: 'info'|'success'|'danger' }} AppDialogRequest */

/** @type {null | ((req: AppDialogRequest) => Promise<boolean>)} */
let presentFn = null
let busy = false

/** @type {{ req: AppDialogRequest, resolve: (v: boolean) => void }[]} */
const queue = []

/** @param {(req: AppDialogRequest) => Promise<boolean> | null} fn */
export function registerAppDialogPresenter(fn) {
  presentFn = typeof fn === "function" ? fn : null
  pump()
}

function pump() {
  if (busy || !presentFn || queue.length === 0) return
  busy = true
  const item = queue.shift()
  if (!item) {
    busy = false
    return
  }
  void Promise.resolve()
    .then(() => presentFn(item.req))
    .then((v) => item.resolve(Boolean(v)))
    .catch(() => item.resolve(false))
    .finally(() => {
      busy = false
      pump()
    })
}

/**
 * @param {AppDialogRequest} req
 * @returns {Promise<boolean>}
 */
function enqueue(req) {
  return new Promise((resolve) => {
    queue.push({ req, resolve })
    pump()
  })
}

/**
 * Messaggio informativo (OK).
 * @param {string} message
 * @param {{ title?: string, okLabel?: string, variant?: 'info'|'success'|'danger' }} [opts]
 */
export function appAlert(message, opts = {}) {
  const text = message == null ? "" : String(message)
  const looksError = /errore|fallit|non riuscit|impossibile|negat/i.test(text)
  const looksOk = /salvat|complet|riuscito|confermato|ok\b/i.test(text)
  return enqueue({
    kind: "alert",
    message: text,
    title: opts.title || (looksError ? "Attenzione" : looksOk ? "Operazione riuscita" : "Messaggio"),
    okLabel: opts.okLabel || "OK",
    variant: opts.variant || (looksError ? "danger" : looksOk ? "success" : "info"),
  }).then(() => undefined)
}

/**
 * Conferma (OK / Annulla). Restituisce true se OK.
 * @param {string} message
 * @param {{ title?: string, okLabel?: string, cancelLabel?: string, variant?: 'info'|'success'|'danger' }} [opts]
 */
export function appConfirm(message, opts = {}) {
  return enqueue({
    kind: "confirm",
    message: message == null ? "" : String(message),
    title: opts.title || "Conferma",
    okLabel: opts.okLabel || "Conferma",
    cancelLabel: opts.cancelLabel || "Annulla",
    variant: opts.variant || "danger",
  })
}

/** Sostituisce window.alert con il dialogo centrato in-app. */
export function installAppDialogWindowBridge() {
  if (typeof window === "undefined") return
  if (window.__pmAppDialogBridge) return
  window.__pmAppDialogBridge = true
  window.alert = (message) => {
    void appAlert(message)
  }
}
