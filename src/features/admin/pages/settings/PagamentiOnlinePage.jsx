import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useOutletContext } from "react-router-dom";
import { useTenant } from "@/app/contexts/TenantContext";
import { useTenantServizi } from "@/app/hooks/useTenantServizi";
import {
  fetchTenantOnlinePaymentSetupStatus,
  getStripeWebhookUrl,
  saveTenantStripeWebhookSecret,
  updateTenantSettings,
} from "@/features/admin/services/adminService";

function CheckRow({ ok, label, hint }) {
  return (
    <li style={{ marginBottom: 10, lineHeight: 1.5 }}>
      <span style={{ color: ok ? "#166534" : "#b45309", fontWeight: 700, marginRight: 8 }}>{ok ? "✓" : "○"}</span>
      <strong>{label}</strong>
      {hint ? <span style={{ display: "block", fontSize: 13, color: "#64748b", marginLeft: 22 }}>{hint}</span> : null}
    </li>
  );
}

export default function PagamentiOnlinePage() {
  const { settings, setSettings } = useOutletContext();
  const { tenantId, refreshTenant } = useTenant();
  const { hasServizio } = useTenantServizi();
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [whInput, setWhInput] = useState("");
  const [whSaving, setWhSaving] = useState(false);
  const [providerSaving, setProviderSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  const webhookUrl = getStripeWebhookUrl();
  const ordiniOnlineLicenza = hasServizio("ordini_online");

  const loadStatus = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const s = await fetchTenantOnlinePaymentSetupStatus(tenantId);
      setStatus(s);
    } catch (e) {
      setStatus({ error: e?.message || "Stato non disponibile (applica SQL modulo 17)" });
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  async function setProvider(value) {
    if (!tenantId) return;
    setProviderSaving(true);
    try {
      await updateTenantSettings(tenantId, { pagamento_online_provider: value || null });
      setSettings((prev) => ({ ...prev, pagamento_online_provider: value || null }));
      await refreshTenant();
      await loadStatus();
    } catch (e) {
      alert(e?.message || "Salvataggio non riuscito");
    } finally {
      setProviderSaving(false);
    }
  }

  async function saveWebhookSecret() {
    if (!tenantId || !whInput.trim().startsWith("whsec_")) return;
    setWhSaving(true);
    try {
      await saveTenantStripeWebhookSecret(tenantId, whInput.trim());
      setWhInput("");
      await loadStatus();
      alert("Webhook secret salvato per questo locale.");
    } catch (e) {
      alert(e?.message || "Salvataggio webhook non riuscito");
    } finally {
      setWhSaving(false);
    }
  }

  function copyWebhookUrl() {
    if (!webhookUrl) return;
    void navigator.clipboard.writeText(webhookUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const ready = status?.ready === true;
  const provider = status?.provider || settings?.pagamento_online_provider || "";

  return (
    <div className="dashboard-settings-section">
      <h2 className="dashboard-settings-section-title">Pagamenti online (Stripe)</h2>
      <p className="dati-pizzeria-hint" style={{ marginBottom: 16, lineHeight: 1.55 }}>
        Configura qui l’incasso con carta sulla vetrina cliente. Dopo il pagamento l’ordine passa in preparazione anche senza
        attendere il webhook (conferma server attiva). Per i dettagli chiavi pk/sk vedi anche{" "}
        <Link to="/admin/settings/dati-pizzeria">Dati pizzeria</Link>.
      </p>

      {!ordiniOnlineLicenza ? (
        <p
          style={{
            padding: 12,
            background: "#fffbeb",
            border: "1px solid #fcd34d",
            borderRadius: 8,
            color: "#92400e",
            marginBottom: 16,
          }}
        >
          Il servizio <strong>Ordini online</strong> non risulta attivo su questo tenant. Abilitalo in Super Admin → Clienti /
          Piani prima che i clienti possano ordinare e pagare online.
        </p>
      ) : null}

      <div
        style={{
          padding: 16,
          borderRadius: 10,
          border: `1px solid ${ready ? "#86efac" : "#fcd34d"}`,
          background: ready ? "#f0fdf4" : "#fffbeb",
          marginBottom: 20,
        }}
      >
        <p style={{ margin: "0 0 12px", fontWeight: 700, color: ready ? "#166534" : "#92400e" }}>
          {ready ? "Pronto per accettare pagamenti Stripe" : "Configurazione incompleta"}
        </p>
        {loading ? (
          <p style={{ margin: 0, color: "#64748b" }}>Verifica in corso…</p>
        ) : status?.error ? (
          <p style={{ margin: 0, color: "#991b1b" }}>{status.error}</p>
        ) : (
          <ul style={{ margin: 0, paddingLeft: 0, listStyle: "none" }}>
            <CheckRow
              ok={ordiniOnlineLicenza}
              label="Licenza ordini online"
              hint="Servizio ordini_online nel piano tenant"
            />
            <CheckRow ok={provider === "stripe"} label="Provider = Stripe" />
            <CheckRow
              ok={status?.stripe_publishable_configured}
              label="Chiave pubblica Stripe (pk_…)"
              hint="In Dati pizzeria"
            />
            <CheckRow
              ok={status?.stripe_secret_configured}
              label="Chiave segreta Stripe (sk_…)"
              hint="Salvata in modo riservato — Dati pizzeria"
            />
            <CheckRow
              ok={status?.stripe_webhook_configured}
              label="Webhook secret (whsec_…) — consigliato"
              hint="Notifiche automatiche da Stripe; opzionale se usi solo conferma al checkout"
            />
          </ul>
        )}
        <button type="button" className="dashboard-settings-btn-secondary" style={{ marginTop: 12 }} onClick={() => void loadStatus()}>
          Aggiorna stato
        </button>
      </div>

      <div className="dashboard-settings-fields" style={{ marginBottom: 20 }}>
        <label>
          Provider pagamento online
          <select
            value={provider}
            disabled={providerSaving}
            onChange={(e) => void setProvider(e.target.value)}
          >
            <option value="">Non configurato</option>
            <option value="stripe">Stripe</option>
            <option value="sumup">SumUp (non ancora attivo)</option>
          </select>
        </label>
      </div>

      <div style={{ marginBottom: 20 }}>
        <h3 style={{ fontSize: 15, marginBottom: 8 }}>Webhook Stripe (Dashboard)</h3>
        <p className="dati-pizzeria-hint" style={{ marginBottom: 8 }}>
          In Stripe → Developers → Webhooks → Add endpoint, incolla questo URL ed eventi{" "}
          <code>payment_intent.succeeded</code>, <code>payment_intent.payment_failed</code>.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginBottom: 12 }}>
          <code
            style={{
              flex: "1 1 280px",
              padding: 8,
              background: "#f1f5f9",
              borderRadius: 6,
              fontSize: 12,
              wordBreak: "break-all",
            }}
          >
            {webhookUrl || "VITE_SUPABASE_URL non configurato"}
          </code>
          <button type="button" className="dashboard-settings-btn-secondary" onClick={copyWebhookUrl} disabled={!webhookUrl}>
            {copied ? "Copiato" : "Copia URL"}
          </button>
        </div>
        <label>
          Signing secret del webhook (whsec_…) — per questo locale
          <input
            type="password"
            value={whInput}
            onChange={(e) => setWhInput(e.target.value)}
            placeholder={
              status?.stripe_webhook_configured ? "•••• già configurato — incolla per sostituire" : "whsec_..."
            }
            autoComplete="off"
          />
        </label>
        <button
          type="button"
          className="dashboard-settings-btn-secondary"
          style={{ marginTop: 8 }}
          disabled={whSaving || !whInput.trim().startsWith("whsec_")}
          onClick={() => void saveWebhookSecret()}
        >
          {whSaving ? "Salvataggio…" : "Salva webhook secret"}
        </button>
        <p className="dati-pizzeria-hint" style={{ marginTop: 8 }}>
          In alternativa puoi impostare un secret globale con{" "}
          <code>supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_…</code> (vale per tutti i tenant che usano lo stesso account
          Stripe).
        </p>
      </div>

      <div style={{ padding: 14, background: "#f8fafc", borderRadius: 8, border: "1px solid #e2e8f0" }}>
        <h3 style={{ fontSize: 15, margin: "0 0 8px" }}>Test rapido</h3>
        <ol style={{ margin: 0, paddingLeft: 20, fontSize: 14, lineHeight: 1.6, color: "#334155" }}>
          <li>Parametri → attiva ordini vetrina / consegna se necessario.</li>
          <li>Cliente registrato → carrello → checkout → «Pagamento online».</li>
          <li>Carta test Stripe <code>4242 4242 4242 4242</code> (modalità test).</li>
          <li>Ordine deve passare da «in attesa pagamento» a «in preparazione».</li>
        </ol>
      </div>
    </div>
  );
}
