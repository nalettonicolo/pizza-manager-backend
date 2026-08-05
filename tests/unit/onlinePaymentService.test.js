import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

vi.mock("@/lib/supabaseClient", () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
    },
  },
}))

import { supabase } from "@/lib/supabaseClient"
import {
  createStripePaymentIntentForOrdine,
  requestStripeRefundForOrdine,
  confirmStripePaymentForOrdine,
} from "@/features/public/services/onlinePaymentService"

describe("onlinePaymentService", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://example.supabase.co")
    supabase.auth.getSession.mockResolvedValue({
      data: { session: { access_token: "tok-test" } },
    })
    global.fetch = vi.fn()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it("createStripePaymentIntentForOrdine ritorna clientSecret", async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ clientSecret: "cs_test", paymentIntentId: "pi_1" }),
    })
    const r = await createStripePaymentIntentForOrdine("ord-1")
    expect(r.clientSecret).toBe("cs_test")
    expect(r.paymentIntentId).toBe("pi_1")
    expect(global.fetch).toHaveBeenCalledWith(
      "https://example.supabase.co/functions/v1/payment-stripe-create-intent",
      expect.objectContaining({ method: "POST" }),
    )
  })

  it("createStripePaymentIntentForOrdine fallisce senza sessione", async () => {
    supabase.auth.getSession.mockResolvedValue({ data: { session: null } })
    await expect(createStripePaymentIntentForOrdine("ord-1")).rejects.toThrow(/Sessione/)
  })

  it("requestStripeRefundForOrdine propaga errore HTTP", async () => {
    global.fetch.mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: "already_refunded" }),
    })
    await expect(requestStripeRefundForOrdine("ord-1")).rejects.toThrow(/already_refunded/)
  })

  it("confirmStripePaymentForOrdine chiama edge confirm", async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
    })
    await confirmStripePaymentForOrdine("ord-2")
    expect(String(global.fetch.mock.calls[0][0])).toContain("payment-stripe-confirm")
  })
})
