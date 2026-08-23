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
 * @returns {Promise<{ ok: boolean, intentId?: string, paymentUrl?: string, message?: string, error?: string }>}
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

  const paymentUrl = `${window.location.origin}/paga/${intentId}`

  if (provider === PAYMENT_LINK_PROVIDER_KEYS.STRIPE) {
    // Il PaymentIntent Stripe viene creato più tardi, quando il link viene davvero aperto
    // (Edge Function `payment-link-checkout`, chiamata dalla pagina di pagamento ospitata senza
    // richiedere login) — non qui: qui chi chiama è cassa (staff), non il cliente proprietario
    // dell'ordine, e l'unica altra Edge Function disponibile (payment-stripe-create-intent)
    // richiede che l'ordine sia collegato all'utente che chiama, cosa mai vera per un ordine
    // preso a telefono da cassa. Creare il PaymentIntent solo all'apertura del link evita anche
    // di generarne di orfani per link mai aperti dal cliente.
    await updatePaymentLinkIntent(intentId, {
      payment_url: paymentUrl,
      status: PAYMENT_LINK_STATUS.PENDING,
    })
    return {
      ok: true,
      intentId,
      paymentUrl,
      message: "Link di pagamento pronto: invialo al cliente (SMS/WhatsApp) o condividilo da qui.",
    }
  }

  await updatePaymentLinkIntent(intentId, {
    payment_url: paymentUrl,
    last_error: `Provider "${provider}" in predisposizione: nessuna Edge Function collegata`,
    status: PAYMENT_LINK_STATUS.PENDING,
  })
  return {
    ok: true,
    intentId,
    paymentUrl,
    message: `Richiesta registrata per provider "${provider}". Attivazione con dati cliente e worker dedicato.`,
  }
}
