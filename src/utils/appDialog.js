/**
 * Dialoghi in-app (alert / confirm) centrati — sostituiscono window.alert nativo.
 * Uso: await appAlert("Messaggio") · const ok = await appConfirm("Sei sicuro?")
 */

/** @typedef {{ kind: 'alert'|'confirm'|'prompt', title?: string, message: string, okLabel?: string, cancelLabel?: string, variant?: 'info'|'success'|'danger', placeholder?: string, defaultValue?: string }} AppDialogRequest */

/** @type {null | ((req: AppDialogRequest) => Promise<boolean|string|null>)} */
let presentFn = null
let busy = false

/** @type {{ req: AppDialogRequest, resolve: (v: boolean|string|null) => void }[]} */
const queue = []

/** @param {(req: AppDialogRequest) => Promise<boolean|string|null> | null} fn */
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
    .then((v) => item.resolve(item.req.kind === "prompt" ? v : Boolean(v)))
    .catch(() => item.resolve(item.req.kind === "prompt" ? null : false))
    .finally(() => {
      busy = false
      pump()
    })
}

/**
 * @param {AppDialogRequest} req
 * @returns {Promise<boolean|string|null>}
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

/**
 * Richiesta testuale (OK / Annulla) — sostituisce window.prompt nativo.
 * Restituisce il testo inserito (stringa, anche vuota) se confermato, `null` se annullato.
 * @param {string} message
 * @param {{ title?: string, okLabel?: string, cancelLabel?: string, placeholder?: string, defaultValue?: string, variant?: 'info'|'success'|'danger' }} [opts]
 * @returns {Promise<string|null>}
 */
export function appPrompt(message, opts = {}) {
  return enqueue({
    kind: "prompt",
    message: message == null ? "" : String(message),
    title: opts.title || "Richiesta",
    okLabel: opts.okLabel || "OK",
    cancelLabel: opts.cancelLabel || "Annulla",
    placeholder: opts.placeholder || "",
    defaultValue: opts.defaultValue || "",
    variant: opts.variant || "info",
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
