import { describe, it, expect, beforeEach } from "vitest"
import {
  OPERATIVE_ORDINI_BROADCAST,
  notifyOperativeOrdersChanged,
  subscribeOperativeOrdersBroadcast,
} from "@/utils/operativeOrderBroadcast"

class MockBroadcastChannel {
  static registry = new Map()

  constructor(name) {
    this.name = name
    this.handlers = []
    if (!MockBroadcastChannel.registry.has(name)) {
      MockBroadcastChannel.registry.set(name, new Set())
    }
    MockBroadcastChannel.registry.get(name).add(this)
  }

  addEventListener(type, fn) {
    if (type === "message") this.handlers.push(fn)
  }

  removeEventListener(type, fn) {
    this.handlers = this.handlers.filter((h) => h !== fn)
  }

  postMessage(data) {
    for (const ch of MockBroadcastChannel.registry.get(this.name) || []) {
      if (ch === this) continue
      for (const h of ch.handlers) h({ data })
    }
  }

  close() {
    MockBroadcastChannel.registry.get(this.name)?.delete(this)
  }
}

describe("operativeOrderBroadcast", () => {
  beforeEach(() => {
    MockBroadcastChannel.registry.clear()
    globalThis.BroadcastChannel = MockBroadcastChannel
  })

  it("consegna il messaggio agli altri ascoltatori, non al mittente", () => {
    const received = []
    const stop = subscribeOperativeOrdersBroadcast((d) => received.push(d))
    notifyOperativeOrdersChanged({ kind: "stato", stato: "PRONTO" })
    expect(received).toHaveLength(1)
    expect(received[0].kind).toBe("stato")
    expect(received[0].stato).toBe("PRONTO")
    expect(received[0].at).toEqual(expect.any(Number))
    stop()
  })

  it("usa il nome canale condiviso", () => {
    expect(OPERATIVE_ORDINI_BROADCAST).toBe("pm-operative-ordini")
  })
})
