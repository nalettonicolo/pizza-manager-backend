import { supabase } from "@/lib/supabaseClient"
import {
  PAYMENT_LINK_PROVIDER_KEYS,
  paymentLinkProviderImplementationStatus,
} from "@/config/posIntegrationsRegistry"
import { createPaymentLinkIntent, updatePaymentLinkIntent } from "@/integrations/fiscal/paymentLinkIntents"
import { PAYMENT_LINK_STATUS } from "@/integrations/fiscal/fiscalConstants"

/**
 * Percorso B: crea riga `payment_link_intents` e, se possibile, invoca l’Edge Function del provider.
 *
 * @param {{
 *   tenantId: string,
 *   ordineId: string,
 *   importoCent: number,
 *   paymentLinkProviderKey: string | null | undefined,
 *   destinatarioTelefono?: string | null,
 * }} args
 * @returns {Promise<{ ok: boolean, intentId?: string, message?: string, error?: string, stripePaymentIntentId?: string }>}
 */
export async function runUnifiedPayByLinkSetup(args) {
  const {
    tenantId,
    ordineId,
    importoCent,
    paymentLinkProviderKey,
    destinatarioTelefono = null,
  } = args
  const provider = String(paymentLinkProviderKey || "").trim().toLowerCase()
  if (!tenantId || !ordineId || !Number.isFinite(importoCent) || importoCent < 1) {
    return { ok: false, error: "Parametri non validi" }
  }
  const impl = paymentLinkProviderImplementationStatus(provider)
  if (impl === "none") {
    return { ok: false, error: "Seleziona un provider pay-by-link nelle impostazioni cassa" }
  }

  const idempotencyKey = `pl_${ordineId}_${provider}`
  const { data: ins, error: insErr } = await createPaymentLinkIntent({
    tenantId,
    ordineId,
    importoCent,
    idempotencyKey,
    destinatarioTelefono,
    providerKey: provider || null,
  })
  if (insErr) {
    return { ok: false, error: insErr.message || "Inserimento intent fallito" }
  }
  const intentId = ins?.id
  if (!intentId) {
    return { ok: false, error: "Intent creato senza id" }
  }

  if (provider === PAYMENT_LINK_PROVIDER_KEYS.STRIPE) {
    const { data: sess } = await supabase.auth.getSession()
    const token = sess?.session?.access_token
    if (!token) {
      await updatePaymentLinkIntent(intentId, {
        last_error: "Sessione assente: impossibile chiamare Edge Stripe",
        status: PAYMENT_LINK_STATUS.FAILED,
      })
      return { ok: false, intentId, error: "Sessione non valida" }
    }
    const { data: fnData, error: fnErr } = await supabase.functions.invoke("payment-stripe-create-intent", {
      body: { ordine_id: ordineId },
      headers: { Authorization: `Bearer ${token}` },
    })
    if (fnErr || fnData?.error) {
      const msg = fnData?.error || fnErr?.message || "Edge Stripe fallita"
      await updatePaymentLinkIntent(intentId, {
        last_error: String(msg),
        status: PAYMENT_LINK_STATUS.FAILED,
        provider_payload: fnData && typeof fnData === "object" ? fnData : null,
      })
      return { ok: false, intentId, error: String(msg) }
    }
    const piId = fnData?.paymentIntentId
    await updatePaymentLinkIntent(intentId, {
      provider_intent_id: piId ?? null,
      provider_payload: {
        stripe_payment_intent_id: piId ?? null,
        /** Non persistiamo client_secret su DB */
        has_client_secret: Boolean(fnData?.clientSecret),
      },
      status: PAYMENT_LINK_STATUS.SENT,
    })
    return {
      ok: true,
      intentId,
      stripePaymentIntentId: piId,
      message:
        "PaymentIntent Stripe creato e collegato all’ordine. Link SMS/hosted page: in roadmap; per incasso immediato usare POS manuale o checkout vetrina se configurato.",
    }
  }

  await updatePaymentLinkIntent(intentId, {
    last_error: `Provider "${provider}" in predisposizione: nessuna Edge Function collegata`,
    status: PAYMENT_LINK_STATUS.PENDING,
  })
  return {
    ok: true,
    intentId,
    message: `Richiesta registrata per provider "${provider}". Attivazione con dati cliente e worker dedicato.`,
  }
}
