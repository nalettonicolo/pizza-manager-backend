import {
  getOnlinePaymentTestProvider,
  ONLINE_PAYMENT_TEST_PROVIDERS,
} from "@/constants/onlinePaymentTestCards"

/**
 * Riquadro carte / istruzioni di test per uno o più gestori pagamento.
 * @param {{
 *   providerKey?: string,
 *   providers?: string[],
 *   compact?: boolean,
 *   title?: string,
 * }} props
 */
export default function OnlinePaymentTestCardsHint({
  providerKey,
  providers,
  compact = false,
  title,
}) {
  const list = (() => {
    if (providerKey) {
      const one = getOnlinePaymentTestProvider(providerKey)
      return one ? [one] : []
    }
    if (Array.isArray(providers) && providers.length) {
      return providers.map(getOnlinePaymentTestProvider).filter(Boolean)
    }
    return ONLINE_PAYMENT_TEST_PROVIDERS
  })()

  if (!list.length) return null

  const heading =
    title ||
    (list.length === 1
      ? `Carte di pagamento test (${list[0].label})`
      : "Carte di pagamento test (tutti i gestori)")

  return (
    <aside
      className={`stripe-test-cards online-pay-test-cards${compact ? " stripe-test-cards--compact" : ""}`}
      aria-label={heading}
    >
      <p className="stripe-test-cards-title">
        <span className="stripe-test-cards-badge">TEST</span>
        {heading}
      </p>

      {list.map((provider) => (
        <div key={provider.key} className="online-pay-test-provider">
          {list.length > 1 ? (
            <h3 className="online-pay-test-provider-title">{provider.label}</h3>
          ) : null}
          <p className="stripe-test-cards-lead">{provider.lead}</p>
          {provider.cards?.length ? (
            <ul className="stripe-test-cards-list">
              {provider.cards.map((card) => (
                <li key={card.id}>
                  <span className="stripe-test-cards-label">{card.label}</span>
                  <code className="stripe-test-cards-number">{card.number}</code>
                  {card.expiry || card.cvc ? (
                    <span className="online-pay-test-card-extra">
                      {card.expiry ? `scad. ${card.expiry}` : null}
                      {card.expiry && card.cvc ? " · " : null}
                      {card.cvc ? `CVC ${card.cvc}` : null}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
          {provider.meta ? <p className="stripe-test-cards-meta">{provider.meta}</p> : null}
          {provider.notes?.length
            ? provider.notes.map((note) => (
                <p key={note} className="online-pay-test-note">
                  {note}
                </p>
              ))
            : null}
          {!compact && provider.docsUrl ? (
            <p className="online-pay-test-docs">
              <a href={provider.docsUrl} target="_blank" rel="noreferrer">
                Documentazione test {provider.label}
              </a>
            </p>
          ) : null}
        </div>
      ))}
    </aside>
  )
}
