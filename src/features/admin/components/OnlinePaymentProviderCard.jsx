import { useMemo, useState } from "react"
import { detectProviderMode, providerStatusLabel } from "@/constants/onlinePaymentProviders"

function StatusBadge({ tone, text }) {
  const cls =
    tone === "ok"
      ? "online-pay-card-badge online-pay-card-badge--ok"
      : tone === "warn"
        ? "online-pay-card-badge online-pay-card-badge--warn"
        : tone === "info"
          ? "online-pay-card-badge online-pay-card-badge--info"
          : "online-pay-card-badge online-pay-card-badge--muted"
  return <span className={cls}>{text}</span>
}

function Field({ label, children, hint }) {
  return (
    <label className="online-pay-field">
      <span className="online-pay-field-label">{label}</span>
      {children}
      {hint ? <span className="online-pay-field-hint">{hint}</span> : null}
    </label>
  )
}

export default function OnlinePaymentProviderCard({
  definition,
  row,
  disabled,
  onToggleEnabled,
  onSavePublic,
  onSaveSecret,
  children,
}) {
  const [expanded, setExpanded] = useState(Boolean(row?.enabled))
  const [publicDraft, setPublicDraft] = useState({})
  const [secretDraft, setSecretDraft] = useState("")
  const [savingPublic, setSavingPublic] = useState(false)
  const [savingSecret, setSavingSecret] = useState(false)
  const [publicFeedback, setPublicFeedback] = useState(null) // { tone: "ok" | "error", text }
  const [secretFeedback, setSecretFeedback] = useState(null)

  const cfg = useMemo(
    () => ({ ...(row?.public_config || {}), ...(publicDraft || {}) }),
    [row?.public_config, publicDraft],
  )

  const status = providerStatusLabel(definition.key, row)
  const mode = detectProviderMode(definition.key, { ...cfg, _secret_hint: secretDraft }, row?.secret_configured)

  async function handleSavePublic(e) {
    e.preventDefault()
    if (!onSavePublic) return
    setSavingPublic(true)
    setPublicFeedback(null)
    try {
      await onSavePublic(definition.key, cfg)
      setPublicDraft({})
      setPublicFeedback({ tone: "ok", text: "Configurazione salvata." })
    } catch (err) {
      setPublicFeedback({
        tone: "error",
        text: `Salvataggio non riuscito: ${err?.message || "errore sconosciuto"}. Riprova o contatta il supporto.`,
      })
    } finally {
      setSavingPublic(false)
    }
  }

  async function handleSaveSecret(e) {
    e.preventDefault()
    if (!onSaveSecret || !secretDraft.trim()) return
    setSavingSecret(true)
    setSecretFeedback(null)
    try {
      await onSaveSecret(definition.key, secretDraft.trim())
      setSecretDraft("")
      setSecretFeedback({ tone: "ok", text: "Segreto salvato." })
    } catch (err) {
      setSecretFeedback({
        tone: "error",
        text: `Salvataggio non riuscito: ${err?.message || "errore sconosciuto"}. Riprova o contatta il supporto.`,
      })
    } finally {
      setSavingSecret(false)
    }
  }

  function renderFields() {
    switch (definition.key) {
      case "stripe":
        return (
          <>
            <Field label="Chiave pubblica (pk_test_… / pk_live_…)">
              <input
                type="text"
                value={cfg.stripe_publishable_key ?? ""}
                onChange={(e) => setPublicDraft((d) => ({ ...d, stripe_publishable_key: e.target.value }))}
                placeholder="pk_test_…"
                autoComplete="off"
              />
            </Field>
            <Field label="Chiave segreta (sk_…) — solo server">
              <input
                type="password"
                value={secretDraft}
                onChange={(e) => setSecretDraft(e.target.value)}
                placeholder={row?.secret_configured ? "•••• già configurata — incolla per sostituire" : "sk_test_…"}
                autoComplete="off"
              />
            </Field>
          </>
        )
      case "sumup":
        return (
          <>
            <Field label="Merchant code">
              <input
                type="text"
                value={cfg.sumup_merchant_public_id ?? ""}
                onChange={(e) =>
                  setPublicDraft((d) => ({ ...d, sumup_merchant_public_id: e.target.value.toUpperCase() }))
                }
                placeholder="MH4H92C7"
                autoComplete="off"
              />
            </Field>
            <Field label="API key (sup_sk_… / sk_test_…)">
              <input
                type="password"
                value={secretDraft}
                onChange={(e) => setSecretDraft(e.target.value)}
                placeholder={row?.secret_configured ? "•••• già configurata" : "sup_sk_…"}
                autoComplete="off"
              />
            </Field>
          </>
        )
      case "satispay":
        return (
          <>
            <Field label="Key ID (sandbox)">
              <input
                type="text"
                value={cfg.satispay_key_id ?? ""}
                onChange={(e) => setPublicDraft((d) => ({ ...d, satispay_key_id: e.target.value }))}
                placeholder="Key ID Satispay"
                autoComplete="off"
              />
            </Field>
            <Field label="Token segreto (sandbox)">
              <input
                type="password"
                value={secretDraft}
                onChange={(e) => setSecretDraft(e.target.value)}
                placeholder={row?.secret_configured ? "•••• già configurato" : "Token test"}
                autoComplete="off"
              />
            </Field>
          </>
        )
      case "nexi":
        return (
          <>
            <Field label="Alias commerciante (XPay)">
              <input
                type="text"
                value={cfg.nexi_alias ?? ""}
                onChange={(e) => setPublicDraft((d) => ({ ...d, nexi_alias: e.target.value }))}
                placeholder="Alias Nexi"
                autoComplete="off"
              />
            </Field>
            <Field label="Chiave API / MAC (segreta)">
              <input
                type="password"
                value={secretDraft}
                onChange={(e) => setSecretDraft(e.target.value)}
                placeholder={row?.secret_configured ? "•••• già configurata" : "Chiave test Nexi"}
                autoComplete="off"
              />
            </Field>
          </>
        )
      case "paypal":
        return (
          <>
            <Field label="Client ID (sandbox)">
              <input
                type="text"
                value={cfg.paypal_client_id ?? ""}
                onChange={(e) => setPublicDraft((d) => ({ ...d, paypal_client_id: e.target.value }))}
                placeholder="Client ID PayPal"
                autoComplete="off"
              />
            </Field>
            <Field label="Secret (sandbox)">
              <input
                type="password"
                value={secretDraft}
                onChange={(e) => setSecretDraft(e.target.value)}
                placeholder={row?.secret_configured ? "•••• già configurato" : "Secret test PayPal"}
                autoComplete="off"
              />
            </Field>
          </>
        )
      default:
        return null
    }
  }

  return (
    <article
      className={`online-pay-card${row?.enabled ? " online-pay-card--enabled" : ""}`}
      style={{ "--online-pay-accent": definition.accent || "#64748b" }}
    >
      <div className="online-pay-card-head">
        <div className="online-pay-card-head-main">
          <span className="online-pay-card-dot" aria-hidden />
          <div>
            <h3 className="online-pay-card-title">{definition.label}</h3>
            <p className="online-pay-card-desc">{definition.description}</p>
          </div>
        </div>
        <div className="online-pay-card-head-actions">
          <StatusBadge tone={status.tone} text={status.text} />
          {mode ? (
            <span className={`online-pay-mode-chip online-pay-mode-chip--${mode}`}>
              {mode === "test" ? "TEST" : "LIVE"}
            </span>
          ) : null}
          <label className="online-pay-toggle" title={row?.enabled ? "Disattiva in vetrina" : "Abilita in vetrina"}>
            <input
              type="checkbox"
              checked={Boolean(row?.enabled)}
              disabled={disabled}
              onChange={(e) => void onToggleEnabled(definition.key, e.target.checked)}
            />
            <span>In vetrina</span>
          </label>
          <button
            type="button"
            className="online-pay-expand-btn"
            aria-expanded={expanded}
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? "Chiudi" : "Configura"}
          </button>
        </div>
      </div>

      {expanded ? (
        <div className="online-pay-card-body">
          {definition.docsUrl ? (
            <p className="online-pay-card-docs">
              Documentazione:{" "}
              <a href={definition.docsUrl} target="_blank" rel="noreferrer">
                {definition.docsUrl.replace(/^https?:\/\//, "")}
              </a>
            </p>
          ) : null}
          {definition.implementation === "config_only" ? (
            <p className="online-pay-card-scaffold-note">
              Puoi salvare le credenziali di test ora. Il checkout cliente sarà abilitato appena l’integrazione Edge
              sarà completata.
            </p>
          ) : null}
          <form className="online-pay-card-form" onSubmit={(e) => void handleSavePublic(e)}>
            {renderFields()}
            <div className="online-pay-card-form-actions">
              <button type="submit" className="dashboard-settings-btn-secondary" disabled={savingPublic || disabled}>
                {savingPublic ? "Salvataggio…" : "Salva configurazione"}
              </button>
              {secretDraft.trim() ? (
                <button
                  type="button"
                  className="dashboard-settings-btn-secondary"
                  disabled={savingSecret || disabled}
                  onClick={(e) => void handleSaveSecret(e)}
                >
                  {savingSecret ? "Salvataggio…" : "Salva segreto"}
                </button>
              ) : null}
            </div>
            {publicFeedback ? (
              <p className={`online-pay-card-feedback online-pay-card-feedback--${publicFeedback.tone}`}>
                {publicFeedback.text}
              </p>
            ) : null}
            {secretFeedback ? (
              <p className={`online-pay-card-feedback online-pay-card-feedback--${secretFeedback.tone}`}>
                {secretFeedback.text}
              </p>
            ) : null}
          </form>
          {children ? <div className="online-pay-card-extra">{children}</div> : null}
        </div>
      ) : null}
    </article>
  )
}
