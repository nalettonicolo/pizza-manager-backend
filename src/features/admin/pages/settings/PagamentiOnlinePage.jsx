import { useCallback, useEffect, useMemo, useState } from "react"
import { useOutletContext } from "react-router-dom"
import { useTenant } from "@/app/contexts/TenantContext"
import { useTenantServizi } from "@/app/hooks/useTenantServizi"
import SettingsSectionHeader from "@/features/admin/components/SettingsSectionHeader"
import OnlinePaymentProviderCard from "@/features/admin/components/OnlinePaymentProviderCard"
import PosPaymentIntegrationsPanel from "@/features/operative/cassa/components/PosPaymentIntegrationsPanel"
import { ONLINE_PAYMENT_PROVIDERS } from "@/constants/onlinePaymentProviders"
import {
  fetchTenantOnlinePaymentSetupStatus,
  getStripeWebhookUrl,
  listTenantOnlinePaymentProviders,
  patchTenantParametriOperativi,
  saveTenantPaymentProviderSecret,
  saveTenantStripeWebhookSecret,
  updateTenantSettings,
  upsertTenantOnlinePaymentProvider,
} from "@/features/admin/services/adminService"
import { readOrdiniOnlineAttivi } from "@/utils/ordiniOnlineAttivi"
import OnlinePaymentTestCardsHint from "@/features/public/components/OnlinePaymentTestCardsHint"

function CheckRow({ ok, label, hint }) {
  return (
    <li className="online-pay-check-row">
      <span className={`online-pay-check-icon${ok ? " online-pay-check-icon--ok" : ""}`}>{ok ? "✓" : "○"}</span>
      <div>
        <strong>{label}</strong>
        {hint ? <span className="online-pay-check-hint">{hint}</span> : null}
      </div>
    </li>
  )
}

export default function PagamentiOnlinePage() {
  const { settings, setSettings } = useOutletContext()
  const { tenantId, refreshTenant } = useTenant()
  const { hasServizio } = useTenantServizi()
  const [status, setStatus] = useState(null)
  const [providers, setProviders] = useState([])
  const [loading, setLoading] = useState(true)
  const [whInput, setWhInput] = useState("")
  const [whSaving, setWhSaving] = useState(false)
  const [vetrinaSaving, setVetrinaSaving] = useState(false)
  const [posSaving, setPosSaving] = useState(false)
  const [copied, setCopied] = useState(false)

  const webhookUrl = getStripeWebhookUrl()
  const ordiniOnlineLicenza = hasServizio("ordini_online")
  const ordiniOnlineVetrinaAttivi = readOrdiniOnlineAttivi(settings?.parametri_operativi)
  const posParams = settings?.parametri_operativi && typeof settings.parametri_operativi === "object"
    ? settings.parametri_operativi
    : {}

  const setPosParam = (key, value) => {
    setSettings((prev) => ({
      ...prev,
      parametri_operativi: { ...(prev?.parametri_operativi || {}), [key]: value },
    }))
  }

  async function savePosPredispositions() {
    if (!tenantId || !settings) return
    setPosSaving(true)
    try {
      await updateTenantSettings(tenantId, {
        parametri_operativi: settings.parametri_operativi || {},
      })
      await refreshTenant()
      alert("Predisposizioni POS / catalogo sistemi salvate.")
    } catch (e) {
      alert(e?.message || "Salvataggio non riuscito")
    } finally {
      setPosSaving(false)
    }
  }

  const providerRows = useMemo(() => {
    const byKey = Object.fromEntries((providers || []).map((p) => [p.provider_key, p]))
    return ONLINE_PAYMENT_PROVIDERS.map((def) => ({
      def,
      row: byKey[def.key] || {
        provider_key: def.key,
        enabled: false,
        public_config: {},
        ready: false,
        secret_configured: false,
      },
    }))
  }, [providers])

  const enabledReadyCount = useMemo(
    () => providerRows.filter(({ row, def }) => row.enabled && row.ready && def.implementation === "live").length,
    [providerRows],
  )

  const loadStatus = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    try {
      const [s, list] = await Promise.all([
        fetchTenantOnlinePaymentSetupStatus(tenantId),
        listTenantOnlinePaymentProviders(tenantId),
      ])
      setStatus(s)
      setProviders(Array.isArray(list) ? list : s?.providers || [])
    } catch (e) {
      setStatus({ error: e?.message || "Stato non disponibile (applica SQL modulo 43)" })
      setProviders([])
    } finally {
      setLoading(false)
    }
  }, [tenantId])

  useEffect(() => {
    void loadStatus()
  }, [loadStatus])

  async function setOrdiniOnlineVetrina(attivo) {
    if (!tenantId) return
    setVetrinaSaving(true)
    try {
      await patchTenantParametriOperativi(tenantId, { ordini_online_attivi: attivo === true })
      setSettings((prev) => ({
        ...prev,
        parametri_operativi: { ...(prev?.parametri_operativi || {}), ordini_online_attivi: attivo === true },
      }))
      await refreshTenant()
    } catch (e) {
      alert(e?.message || "Salvataggio non riuscito")
    } finally {
      setVetrinaSaving(false)
    }
  }

  async function handleToggleEnabled(providerKey, enabled) {
    if (!tenantId) return
    try {
      const list = await upsertTenantOnlinePaymentProvider(tenantId, providerKey, { enabled })
      setProviders(Array.isArray(list) ? list : [])
      await refreshTenant()
      await loadStatus()
    } catch (e) {
      alert(e?.message || "Salvataggio non riuscito")
    }
  }

  async function handleSavePublic(providerKey, publicConfig) {
    if (!tenantId) return
    const list = await upsertTenantOnlinePaymentProvider(tenantId, providerKey, {
      enabled: true,
      publicConfig,
    })
    setProviders(Array.isArray(list) ? list : [])
    await refreshTenant()
    await loadStatus()
  }

  async function handleSaveSecret(providerKey, secret) {
    if (!tenantId) return
    await saveTenantPaymentProviderSecret(tenantId, providerKey, secret)
    await loadStatus()
  }

  async function saveWebhookSecret() {
    if (!tenantId || !whInput.trim().startsWith("whsec_")) return
    setWhSaving(true)
    try {
      await saveTenantStripeWebhookSecret(tenantId, whInput.trim())
      setWhInput("")
      await loadStatus()
    } catch (e) {
      alert(e?.message || "Salvataggio webhook non riuscito")
    } finally {
      setWhSaving(false)
    }
  }

  function copyWebhookUrl() {
    if (!webhookUrl) return
    void navigator.clipboard.writeText(webhookUrl).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="admin-settings-page online-pay-page">
      <SettingsSectionHeader
        title="Pagamenti online"
        description="Configura uno o più gestori di pagamento. In vetrina il cliente sceglie come pagare tra quelli attivi e pronti."
      />

      <section className="dashboard-box online-pay-overview">
        <h2 className="dashboard-box-title">Panoramica vetrina</h2>
        {loading ? <p className="dati-pizzeria-hint">Caricamento stato…</p> : null}
        {status?.error ? (
          <p style={{ color: "#b91c1c", fontSize: 14 }}>{status.error}</p>
        ) : (
          <ul className="online-pay-checklist">
            <CheckRow
              ok={ordiniOnlineLicenza}
              label="Licenza ordini online"
              hint={ordiniOnlineLicenza ? "Attiva sul piano" : "Richiedi attivazione ordini online"}
            />
            <CheckRow
              ok={ordiniOnlineVetrinaAttivi}
              label="Ordini vetrina attivi"
              hint="Toggle sotto — necessario per checkout pubblico"
            />
            <CheckRow
              ok={enabledReadyCount > 0}
              label={`Gestori pronti in vetrina (${enabledReadyCount})`}
              hint="Almeno un gestore live attivo e configurato (Stripe o SumUp)"
            />
          </ul>
        )}
        <label className="online-pay-vetrina-toggle">
          <input
            type="checkbox"
            checked={ordiniOnlineVetrinaAttivi}
            disabled={vetrinaSaving || !tenantId}
            onChange={(e) => void setOrdiniOnlineVetrina(e.target.checked)}
          />
          <span>
            <strong>Attiva ordini e pagamento online in vetrina</strong>
            <span className="online-pay-vetrina-toggle-hint">
              Se disattivo, i clienti vedono solo il menù. Serve anche la licenza ordini online.
            </span>
          </span>
        </label>
        <button type="button" className="dashboard-settings-btn-secondary" onClick={() => void loadStatus()}>
          Aggiorna stato
        </button>
      </section>

      <section className="online-pay-providers-section">
        <h2 className="online-pay-section-title">Gestori di pagamento</h2>
        <p className="dati-pizzeria-hint online-pay-section-desc">
          Attiva «In vetrina» per ogni gestore che vuoi offrire. Stripe e SumUp sono già collegati al checkout; Satispay,
          Nexi e PayPal si possono preconfigurare per i test.
        </p>
        <div className="online-pay-provider-grid">
          {providerRows.map(({ def, row }) => (
            <OnlinePaymentProviderCard
              key={def.key}
              definition={def}
              row={row}
              disabled={loading || !tenantId}
              onToggleEnabled={handleToggleEnabled}
              onSavePublic={handleSavePublic}
              onSaveSecret={handleSaveSecret}
            >
              {def.key === "stripe" ? (
                <div className="online-pay-stripe-webhook-inline">
                  <h4 className="online-pay-card-subtitle">Webhook (opzionale)</h4>
                  <p className="dati-pizzeria-hint">
                    Eventi: <code>payment_intent.succeeded</code>, <code>payment_intent.payment_failed</code>.
                  </p>
                  <div className="online-pay-webhook-row">
                    <code className="online-pay-webhook-url">
                      {webhookUrl || "VITE_SUPABASE_URL non configurato"}
                    </code>
                    <button
                      type="button"
                      className="dashboard-settings-btn-secondary"
                      onClick={copyWebhookUrl}
                      disabled={!webhookUrl}
                    >
                      {copied ? "Copiato" : "Copia URL"}
                    </button>
                  </div>
                  <label className="online-pay-field">
                    <span className="online-pay-field-label">Signing secret (whsec_…)</span>
                    <input
                      type="password"
                      value={whInput}
                      onChange={(e) => setWhInput(e.target.value)}
                      placeholder={status?.stripe_webhook_configured ? "•••• già configurato" : "whsec_…"}
                      autoComplete="off"
                    />
                  </label>
                  <button
                    type="button"
                    className="dashboard-settings-btn-secondary"
                    disabled={whSaving || !whInput.trim().startsWith("whsec_")}
                    onClick={() => void saveWebhookSecret()}
                  >
                    {whSaving ? "Salvataggio…" : "Salva webhook secret"}
                  </button>
                </div>
              ) : null}
            </OnlinePaymentProviderCard>
          ))}
        </div>
      </section>

      <section className="dashboard-box online-pay-smoke">
        <h2 className="dashboard-box-title">Area test — pagamento online</h2>
        <ol className="online-pay-smoke-list">
          <li>Attiva almeno un gestore (Stripe o SumUp) e spunta «In vetrina».</li>
          <li>Attiva ordini vetrina (toggle sopra).</li>
          <li>Checkout vetrina → scegli pagamento online → seleziona il gestore se ne hai più di uno.</li>
          <li>Usa le carte di test sotto (solo sandbox / modalità TEST) → ordine in preparazione.</li>
        </ol>
        <OnlinePaymentTestCardsHint title="Carte di pagamento test per gestore" />
      </section>

      <div style={{ marginTop: 24 }}>
        <PosPaymentIntegrationsPanel p={posParams} setParam={setPosParam} />
        <button
          type="button"
          className="dashboard-settings-btn-secondary"
          style={{ marginTop: 8 }}
          disabled={posSaving || !tenantId}
          onClick={() => void savePosPredispositions()}
        >
          {posSaving ? "Salvataggio catalogo…" : "Salva catalogo sistemi / predisposizioni"}
        </button>
      </div>
    </div>
  )
}
