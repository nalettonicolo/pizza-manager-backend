import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const rpc = vi.fn()
const enqueuePendingAction = vi.fn()
const listPendingActions = vi.fn()
const removePendingAction = vi.fn()
const updatePendingAction = vi.fn()

vi.mock("@/lib/supabaseClient", () => ({
  supabase: { rpc: (...args) => rpc(...args) },
}))

vi.mock("@/offline/offlineDb", () => ({
  enqueuePendingAction: (...a) => enqueuePendingAction(...a),
  listPendingActions: (...a) => listPendingActions(...a),
  removePendingAction: (...a) => removePendingAction(...a),
  updatePendingAction: (...a) => updatePendingAction(...a),
}))

import {
  flushOfflineQueue,
  offlineRetryDelayMs,
  queueOfflineCheckout,
  scheduleOfflineFlush,
} from "@/offline/syncQueue"

function action(id, createdAt, extra = {}) {
  return {
    id,
    tenant_id: "t1",
    type: "create_order_with_items",
    idempotency_key: `k-${id}`,
    created_at: createdAt,
    attempts: 0,
    payload: { tenant_id: "t1", totale: "12.5", items: [{ id: "p1", qty: 2, prezzo: "6.25" }] },
    ...extra,
  }
}

/** Avanza i timer del backoff e restituisce il risultato del flush. */
async function flushWithTimers(tenantId = "t1") {
  const p = flushOfflineQueue(tenantId)
  await vi.runAllTimersAsync()
  return p
}

beforeEach(() => {
  vi.useFakeTimers()
  rpc.mockReset()
  enqueuePendingAction.mockReset()
  listPendingActions.mockReset()
  removePendingAction.mockReset().mockResolvedValue()
  updatePendingAction.mockReset().mockResolvedValue(true)
  enqueuePendingAction.mockImplementation(async (a) => ({ id: "row-1", ...a }))
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe("syncQueue: accodamento", () => {
  it("genera una chiave di idempotenza e la copia nel payload", async () => {
    await queueOfflineCheckout({ tenant_id: "t1", totale: 10, items: [] })
    const arg = enqueuePendingAction.mock.calls[0][0]
    expect(arg.type).toBe("create_order_with_items")
    expect(arg.tenant_id).toBe("t1")
    expect(arg.idempotency_key).toMatch(/^offline:t1:\d+:/)
    expect(arg.payload.idempotency_key).toBe(arg.idempotency_key)
  })

  it("mantiene la chiave già fornita (snake_case o camelCase)", async () => {
    await queueOfflineCheckout({ tenant_id: "t1", idempotency_key: "abc" })
    await queueOfflineCheckout({ tenant_id: "t1", idempotencyKey: "def" })
    expect(enqueuePendingAction.mock.calls[0][0].idempotency_key).toBe("abc")
    expect(enqueuePendingAction.mock.calls[1][0].idempotency_key).toBe("def")
  })

  it("due accodamenti senza chiave producono chiavi diverse", async () => {
    await queueOfflineCheckout({ tenant_id: "t1" })
    await queueOfflineCheckout({ tenant_id: "t1" })
    const [a, b] = enqueuePendingAction.mock.calls.map((c) => c[0].idempotency_key)
    expect(a).not.toBe(b)
  })
})

describe("syncQueue: invio al ritorno della rete", () => {
  it("offline: non chiama né la coda né il server", async () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false)
    const res = await flushOfflineQueue("t1")
    expect(res).toEqual({ flushed: 0, errors: ["offline"] })
    expect(listPendingActions).not.toHaveBeenCalled()
    expect(rpc).not.toHaveBeenCalled()
  })

  it("online: invia con i parametri RPC mappati e rimuove l'azione", async () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(true)
    listPendingActions.mockResolvedValue([action("a1", "2026-01-01T10:00:00Z")])
    rpc.mockResolvedValue({ data: "ordine-1", error: null })

    const res = await flushWithTimers()

    expect(res).toEqual({ flushed: 1, errors: [] })
    expect(rpc).toHaveBeenCalledTimes(1)
    const [fn, args] = rpc.mock.calls[0]
    expect(fn).toBe("create_order_with_items")
    expect(args.p_tenant_id).toBe("t1")
    expect(args.p_totale).toBe(12.5)
    expect(args.p_stato).toBe("IN_PREPARAZIONE")
    expect(args.p_items).toEqual([
      {
        prodotto_id: "p1",
        quantita: 2,
        prezzo: 6.25,
        formato_nome: null,
        ingredienti_cottura_summary: null,
      },
    ])
    expect(args.p_idempotency_key).toBe("k-a1")
    expect(args).not.toHaveProperty("p_web_cliente_user_id")
    expect(removePendingAction).toHaveBeenCalledWith("a1")
  })

  it("invia le azioni in ordine di creazione (dalla più vecchia)", async () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(true)
    listPendingActions.mockResolvedValue([
      action("nuova", "2026-01-01T12:00:00Z"),
      action("vecchia", "2026-01-01T09:00:00Z"),
    ])
    rpc.mockResolvedValue({ data: "x", error: null })

    await flushWithTimers()

    expect(removePendingAction.mock.calls.map((c) => c[0])).toEqual(["vecchia", "nuova"])
  })

  it("un'azione di tipo sconosciuto viene scartata senza chiamare il server", async () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(true)
    listPendingActions.mockResolvedValue([action("x", "2026-01-01T10:00:00Z", { type: "altro" })])

    const res = await flushWithTimers()

    expect(res.flushed).toBe(1)
    expect(rpc).not.toHaveBeenCalled()
    expect(removePendingAction).toHaveBeenCalledWith("x")
  })

  it("un errore temporaneo viene ritentato e poi l'ordine parte", async () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(true)
    listPendingActions.mockResolvedValue([action("a1", "2026-01-01T10:00:00Z")])
    rpc
      .mockResolvedValueOnce({ data: null, error: { message: "rete" } })
      .mockResolvedValueOnce({ data: "ok", error: null })

    const res = await flushWithTimers()

    expect(res).toEqual({ flushed: 1, errors: [] })
    expect(rpc).toHaveBeenCalledTimes(2)
    expect(updatePendingAction).toHaveBeenCalledWith("a1", { attempts: 1, last_error: "rete" })
    expect(removePendingAction).toHaveBeenCalledWith("a1")
  })

  it("scheduleOfflineFlush: parte subito, riparte su 'online' e si può disiscrivere", async () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(true)
    listPendingActions.mockResolvedValue([])
    const onResult = vi.fn()

    const stop = scheduleOfflineFlush("t1", onResult)
    await vi.runAllTimersAsync()
    expect(listPendingActions).toHaveBeenCalledTimes(1)

    window.dispatchEvent(new Event("online"))
    await vi.runAllTimersAsync()
    expect(listPendingActions).toHaveBeenCalledTimes(2)
    expect(onResult).toHaveBeenCalledWith({ flushed: 0, errors: [] })

    stop()
    window.dispatchEvent(new Event("online"))
    await vi.runAllTimersAsync()
    expect(listPendingActions).toHaveBeenCalledTimes(2)
  })

  it("scheduleOfflineFlush senza tenant non fa nulla", () => {
    const stop = scheduleOfflineFlush(null, vi.fn())
    expect(typeof stop).toBe("function")
    expect(listPendingActions).not.toHaveBeenCalled()
  })
})

describe("syncQueue: dopo 5 errori l'ordine resta fermo", () => {
  it("5 tentativi falliti: errore riportato, azione NON rimossa", async () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(true)
    listPendingActions.mockResolvedValue([action("a1", "2026-01-01T10:00:00Z")])
    rpc.mockResolvedValue({ data: null, error: { message: "boom" } })

    const res = await flushWithTimers()

    expect(rpc).toHaveBeenCalledTimes(5)
    expect(res).toEqual({ flushed: 0, errors: ["boom"] })
    expect(removePendingAction).not.toHaveBeenCalled()
    expect(updatePendingAction.mock.calls.map((c) => c[1].attempts)).toEqual([1, 2, 3, 4, 5])
  })

  it("al sesto passaggio l'azione con attempts=5 non viene più ritentata", async () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(true)
    listPendingActions.mockResolvedValue([action("a1", "2026-01-01T10:00:00Z", { attempts: 5 })])

    const res = await flushWithTimers()

    expect(rpc).not.toHaveBeenCalled()
    expect(removePendingAction).not.toHaveBeenCalled()
    // Comportamento attuale: l'azione ferma è silenziosa (nessun errore segnalato all'utente).
    expect(res).toEqual({ flushed: 0, errors: [] })
  })

  it("riparte dai tentativi già fatti (attempts=3 → altri 2 tentativi)", async () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(true)
    listPendingActions.mockResolvedValue([action("a1", "2026-01-01T10:00:00Z", { attempts: 3 })])
    rpc.mockResolvedValue({ data: null, error: { message: "boom" } })

    const res = await flushWithTimers()

    expect(rpc).toHaveBeenCalledTimes(2)
    expect(res.errors).toEqual(["boom"])
  })

  it("l'azione ferma non blocca quelle successive", async () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(true)
    listPendingActions.mockResolvedValue([
      action("rotta", "2026-01-01T09:00:00Z"),
      action("buona", "2026-01-01T10:00:00Z"),
    ])
    rpc.mockImplementation(async (_fn, args) =>
      args.p_idempotency_key === "k-rotta"
        ? { data: null, error: { message: "boom" } }
        : { data: "ok", error: null },
    )

    const res = await flushWithTimers()

    expect(res).toEqual({ flushed: 1, errors: ["boom"] })
    expect(removePendingAction.mock.calls.map((c) => c[0])).toEqual(["buona"])
  })

  it("backoff: 2s, 4s, 8s, 16s tra i 5 tentativi (nessuna attesa dopo l'ultimo)", async () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(true)
    listPendingActions.mockResolvedValue([action("a1", "2026-01-01T10:00:00Z")])
    rpc.mockResolvedValue({ data: null, error: { message: "boom" } })

    const p = flushOfflineQueue("t1")
    await vi.advanceTimersByTimeAsync(0)
    expect(rpc).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1999)
    expect(rpc).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1)
    expect(rpc).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(4000)
    expect(rpc).toHaveBeenCalledTimes(3)
    await vi.advanceTimersByTimeAsync(8000)
    expect(rpc).toHaveBeenCalledTimes(4)
    await vi.advanceTimersByTimeAsync(16000)
    expect(rpc).toHaveBeenCalledTimes(5)
    await p
    expect(vi.getTimerCount()).toBe(0)
  })

  it("offlineRetryDelayMs raddoppia e si ferma a 60s", () => {
    expect(offlineRetryDelayMs(0)).toBe(2000)
    expect(offlineRetryDelayMs(1)).toBe(4000)
    expect(offlineRetryDelayMs(4)).toBe(32000)
    expect(offlineRetryDelayMs(5)).toBe(60000)
    expect(offlineRetryDelayMs(20)).toBe(60000)
    expect(offlineRetryDelayMs()).toBe(2000)
  })
})
