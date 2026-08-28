/**
 * Sync istantaneo tra schermate operative nello stesso browser (test 4 reparti, tab duplicati).
 * Realtime/polling restano il fallback tra tablet diversi.
 */

const listeners = new Set()
const CHANNEL_NAME = "pm-operative-order-sync-v1"

let broadcast = null
if (typeof BroadcastChannel !== "undefined") {
  try {
    broadcast = new BroadcastChannel(CHANNEL_NAME)
    broadcast.onmessage = (ev) => {
      notifyLocal(ev?.data, { fromBroadcast: true })
    }
  } catch {
    broadcast = null
  }
}

function notifyLocal(payload, { fromBroadcast = false } = {}) {
  if (!payload || typeof payload !== "object") return
  for (const fn of listeners) {
    try {
      fn(payload)
    } catch {
      /* ignore listener errors */
    }
  }
  if (!fromBroadcast && broadcast) {
    try {
      broadcast.postMessage(payload)
    } catch {
      /* ignore */
    }
  }
}

/** @param {(payload: object) => void} fn */
export function subscribeOperativeOrderSync(fn) {
  if (typeof fn !== "function") return () => {}
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

export function emitOperativeOrderSync(payload) {
  notifyLocal(payload, { fromBroadcast: false })
}
