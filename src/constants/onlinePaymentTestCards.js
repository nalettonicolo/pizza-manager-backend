/**
 * Dati di test ufficiali per gestori pagamento online (solo UI di aiuto in Admin / checkout TEST).
 * Fonte: documentazione sandbox di ciascun provider.
 */

/** @typedef {{ id: string, label: string, number: string, expiry?: string, cvc?: string }} OnlinePayTestCard */

/** @typedef {{
 *   key: string,
 *   label: string,
 *   docsUrl?: string,
 *   lead: string,
 *   cards: OnlinePayTestCard[],
 *   meta?: string,
 *   notes?: string[],
 * }} OnlinePayTestProvider */

/** @type {OnlinePayTestProvider[]} */
export const ONLINE_PAYMENT_TEST_PROVIDERS = Object.freeze([
  {
    key: "stripe",
    label: "Stripe",
    docsUrl: "https://docs.stripe.com/testing#cards",
    lead: "Nessun addebito reale. Usa questi numeri nel form carta Stripe:",
    cards: [
      { id: "ok", label: "Pagamento riuscito", number: "4242 4242 4242 4242" },
      { id: "ko", label: "Carta rifiutata", number: "4000 0000 0000 0002" },
      { id: "3ds", label: "Richiede 3D Secure", number: "4000 0025 0000 3155" },
    ],
    meta: "Scadenza: qualsiasi data futura (es. 12/34) · CVC: qualsiasi (es. 123) · CAP: qualsiasi se richiesto",
  },
  {
    key: "sumup",
    label: "SumUp",
    docsUrl: "https://developer.sumup.com/online-payments/testing/",
    lead: "Nella pagina hosted SumUp (sandbox) usa queste carte:",
    cards: [
      { id: "ok", label: "Pagamento riuscito (Visa)", number: "4200 0000 0000 0091" },
      { id: "ok_mc", label: "Pagamento riuscito (Mastercard)", number: "5200 0000 0000 0007" },
      { id: "3ds", label: "Richiede 3D Secure (Visa)", number: "4200 0000 0000 0042" },
      { id: "fail", label: "Errore autenticazione", number: "4012 0010 3746 1114" },
    ],
    meta: "Scadenza: qualsiasi futura (es. 12/30) · CVV: qualsiasi a 3 cifre (es. 123) · nome titolare: qualsiasi",
    notes: [
      "L’importo 11 (qualsiasi valuta) fallisce di proposito in sandbox — utile per testare il rifiuto.",
    ],
  },
  {
    key: "nexi",
    label: "Nexi (XPay)",
    docsUrl: "https://developer.nexi.it/it/area-test/carte-di-pagamento",
    lead: "Carte ufficiali area test Nexi Payment Gateway (checkout in arrivo):",
    cards: [
      {
        id: "ok_visa",
        label: "OK Visa",
        number: "4999 3402 6197 7289",
        expiry: "12/30",
        cvc: "663",
      },
      {
        id: "ok_mc",
        label: "OK Mastercard",
        number: "5593 4979 4833 2903",
        expiry: "12/30",
        cvc: "399",
      },
      {
        id: "3ds",
        label: "OK con 3D Secure (Visa)",
        number: "4349 9401 9900 4549",
        expiry: "05/26",
        cvc: "396",
      },
      {
        id: "ko",
        label: "Rifiutata (Mastercard)",
        number: "5515 9318 5585 8729",
        expiry: "12/30",
        cvc: "015",
      },
    ],
    meta: "Usa scadenza e CVV indicati per ciascuna carta (documentazione Nexi).",
  },
  {
    key: "paypal",
    label: "PayPal",
    docsUrl: "https://developer.paypal.com/api/rest/sandbox/card-testing/",
    lead: "Sandbox PayPal — carte per pagamento con carta (checkout in arrivo):",
    cards: [
      { id: "visa", label: "Visa OK", number: "4012 8888 8888 1881" },
      { id: "visa2", label: "Visa OK (alt.)", number: "4111 1111 1111 1111" },
      { id: "mc", label: "Mastercard OK", number: "5555 5555 5555 4444" },
    ],
    meta: "Scadenza futura · CVC a 3 cifre (es. 123). Oppure accedi con un account buyer sandbox PayPal.",
  },
  {
    key: "satispay",
    label: "Satispay",
    docsUrl: "https://developers.satispay.com",
    lead: "Satispay non usa numeri di carta: i pagamenti test avvengono con account sandbox.",
    cards: [],
    notes: [
      "Crea Key ID + token sandbox su developers.satispay.com e salvali in Pagamenti online.",
      "Per lo smoke servirà l’app / ambiente sandbox Satispay (checkout vetrina in arrivo).",
    ],
  },
])

/** @deprecated alias — carte Stripe */
export const STRIPE_TEST_CARDS =
  ONLINE_PAYMENT_TEST_PROVIDERS.find((p) => p.key === "stripe")?.cards || []

/** @deprecated */
export const STRIPE_TEST_CARD_HINTS = Object.freeze({
  expiry: "qualsiasi data futura (es. 12/34)",
  cvc: "qualsiasi CVC a 3 cifre (es. 123)",
  postal: "qualsiasi CAP se richiesto",
})

export function getOnlinePaymentTestProvider(providerKey) {
  const k = String(providerKey || "").toLowerCase()
  return ONLINE_PAYMENT_TEST_PROVIDERS.find((p) => p.key === k) || null
}

export function isStripePublishableTestKey(key) {
  return String(key || "").trim().startsWith("pk_test_")
}
