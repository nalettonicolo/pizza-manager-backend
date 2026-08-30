/**
 * Segnale stesso-browser tra schermate operative (Cassa, Pizzaioli, Cucina, Bancone, Delivery).
 * Complementa Realtime: in «Test 4 reparti» e tra schede dello stesso PC l'aggiornamento
 * parte subito, senza aspettare il canale live né il polling.
 */
export const OPERATIVE_ORDINI_BROADCAST = "pm-operative-ordini"

export function notifyOperativeOrdersChanged(detail = {}) {
  try {
    const ch = new BroadcastChannel(OPERATIVE_ORDINI_BROADCAST)
    ch.postMessage({ at: Date.now(), ...detail })
    ch.close()
  } catch {
    // Browser senza BroadcastChannel: restano Realtime e polling
  }
}

export function subscribeOperativeOrdersBroadcast(onEvent) {
  if (typeof onEvent !== "function") return () => {}
  let ch
  try {
    ch = new BroadcastChannel(OPERATIVE_ORDINI_BROADCAST)
  } catch {
    return () => {}
  }
  const handler = (ev) => {
    try {
      onEvent(ev?.data)
    } catch {
      // listener non deve far cadere il canale
    }
  }
  ch.addEventListener("message", handler)
  return () => {
    ch.removeEventListener("message", handler)
    try {
      ch.close()
    } catch {
      /* ignore */
    }
  }
}
