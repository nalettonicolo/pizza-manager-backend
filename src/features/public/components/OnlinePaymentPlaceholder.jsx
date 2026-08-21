import {
  ONLINE_PAYMENT_PROVIDER_BY_KEY,
  detectProviderMode,
  getCheckoutLiveProviders,
} from "@/constants/onlinePaymentProviders"
import { isStripePublishableTestKey } from "@/constants/onlinePaymentTestCards"
import OnlinePaymentTestCardsHint from "@/features/public/components/OnlinePaymentTestCardsHint"

/**
 * Selettore gestore pagamento in checkout vetrina.
 */
export function OnlinePaymentProviderPicker({ tenant, selectedKey, onChange, totalEuro }) {
  const providers = getCheckoutLiveProviders(tenant)
  if (providers.length === 0) {
    return (
      <p className="online-pay-picker-empty">
        Nessun gestore online attivo. Scegli pagamento alla consegna o riprova più tardi.
      </p>
    )
  }

  if (providers.length === 1) {
    const key = providers[0].provider_key
    const def = ONLINE_PAYMENT_PROVIDER_BY_KEY[key]
    return (
      <p className="online-pay-picker-single">
        Pagamento con <strong>{def?.label || key}</strong> · totale{" "}
        <strong>€ {Number(totalEuro).toFixed(2)}</strong>
      </p>
    )
  }

  return (
    <div className="online-pay-picker">
      <p className="online-pay-picker-label">Scegli come pagare</p>
      <div className="online-pay-picker-options">
        {providers.map((row) => {
          const key = row.provider_key
          const def = ONLINE_PAYMENT_PROVIDER_BY_KEY[key]
          const sel = selectedKey === key
          return (
            <button
              key={key}
              type="button"
              className={`online-pay-picker-option${sel ? " online-pay-picker-option--selected" : ""}`}
              style={{ "--online-pay-accent": def?.accent || "#64748b" }}
              onClick={() => onChange(key)}
            >
              <span className="online-pay-picker-option-dot" aria-hidden />
              <span className="online-pay-picker-option-text">
                <strong>{def?.label || key}</strong>
                <span>{def?.description}</span>
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function OnlinePaymentPlaceholder({ tenant, totalEuro, selectedProviderKey }) {
  const providers = getCheckoutLiveProviders(tenant)
  const key = selectedProviderKey || (providers.length === 1 ? providers[0].provider_key : "")
  const def = ONLINE_PAYMENT_PROVIDER_BY_KEY[key]
  const row = providers.find((p) => p.provider_key === key)
  const cfg = row?.public_config || {}
  const stripePk = cfg.stripe_publishable_key || tenant?.stripe_publishable_key
  const stripeTest =
    key === "stripe" &&
    (isStripePublishableTestKey(stripePk) ||
      detectProviderMode("stripe", { ...cfg, stripe_publishable_key: stripePk }, Boolean(row?.secret_configured)) ===
        "test")
  const showTestCards =
    (key === "stripe" && stripeTest) ||
    key === "sumup" ||
    key === "nexi" ||
    key === "paypal" ||
    key === "satispay"

  return (
    <div className="online-pay-checkout-box">
      <strong className="online-pay-checkout-box-title">Pagamento online</strong>
      {!key ? (
        <p className="online-pay-checkout-box-hint">Seleziona un gestore di pagamento sopra.</p>
      ) : (
        <p className="online-pay-checkout-box-body">
          {def?.label || key}
          {key === "stripe" && stripePk ? <> · form carta dopo «Conferma ordine»</> : null}
          {key === "sumup" && (cfg.sumup_merchant_public_id || tenant?.sumup_merchant_public_id) ? (
            <> · redirect pagina sicura SumUp</>
          ) : null}
          {" · "}
          Totale <strong>€ {Number(totalEuro).toFixed(2)}</strong>
        </p>
      )}
      {showTestCards && key ? (
        <OnlinePaymentTestCardsHint providerKey={key} compact title={`Carte di pagamento test (${def?.label || key})`} />
      ) : null}
    </div>
  )
}

/** @deprecated import from @/constants/onlinePaymentProviders */
export { describePaymentProvider, getCheckoutLiveProviders } from "@/constants/onlinePaymentProviders"
