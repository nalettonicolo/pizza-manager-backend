import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

vi.mock("@/lib/supabaseClient", () => ({
  supabase: {
    rpc: vi.fn(),
  },
}))

import { supabase } from "@/lib/supabaseClient"
import {
  getStripeWebhookUrl,
  fetchTenantOnlinePaymentSetupStatus,
  saveTenantStripeWebhookSecret,
  STRIPE_EDGE_FUNCTIONS,
} from "@/features/admin/services/onlinePaymentsAdminService"

describe("onlinePaymentsAdminService", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://proj.supabase.co")
    supabase.rpc.mockReset()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("getStripeWebhookUrl punta a payment-stripe-webhook", () => {
    expect(getStripeWebhookUrl()).toBe(
      "https://proj.supabase.co/functions/v1/payment-stripe-webhook",
    )
  })

  it("STRIPE_EDGE_FUNCTIONS elenca le 4 funzioni", () => {
    expect(STRIPE_EDGE_FUNCTIONS).toContain("payment-stripe-create-intent")
    expect(STRIPE_EDGE_FUNCTIONS).toHaveLength(4)
  })

  it("fetchTenantOnlinePaymentSetupStatus legge RPC", async () => {
    supabase.rpc.mockResolvedValue({
      data: { ready: true, stripe_secret_configured: true },
      error: null,
    })
    const s = await fetchTenantOnlinePaymentSetupStatus("t1")
    expect(s.ready).toBe(true)
    expect(supabase.rpc).toHaveBeenCalledWith("tenant_online_payment_setup_status", {
      p_tenant_id: "t1",
    })
  })

  it("saveTenantStripeWebhookSecret chiama RPC", async () => {
    supabase.rpc.mockResolvedValue({ error: null })
    await saveTenantStripeWebhookSecret("t1", " whsec_x ")
    expect(supabase.rpc).toHaveBeenCalledWith("save_tenant_stripe_webhook_secret", {
      p_tenant_id: "t1",
      p_secret: "whsec_x",
    })
  })
})
