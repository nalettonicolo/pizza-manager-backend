import { FISCAL_MODES, FISCAL_PARAM_KEYS } from "@/integrations/fiscal/fiscalConstants"
import {
  mergePosPaymentPredispositions,
  POS_INTEGRATION_CATALOG,
  PAYMENT_LINK_PROVIDER_KEYS,
  TERMINAL_PROVIDER_KEYS,
} from "@/config/posIntegrationsRegistry"
import { downloadPosManualReconciliationTemplate } from "@/utils/posManualExportTemplate"
import { requestTerminalCollection } from "@/integrations/payments/terminalAdapter"
import { useTenant } from "@/app/contexts/TenantContext"

function trackLabel(track) {
  if (track === "manual_only") return "Solo cassa"
  if (track === "checkout_web") return "Checkout web"
  if (track === "pay_by_link") return "Pay-by-link"
  if (track === "pos_terminal") return "Terminale POS"
  return track
}

function implLabel(impl) {
  if (impl === "live") return "Operativo"
  if (impl === "partial") return "Parziale"
  return "Scheletro"
}

export default function PosPaymentIntegrationsPanel({ p, setParam }) {
  const { tenantId } = useTenant()
  const predis = mergePosPaymentPredispositions(p[FISCAL_PARAM_KEYS.pos_payment_predispositions])

  const setPredProvider = (id, patch) => {
    const next = mergePosPaymentPredispositions(p[FISCAL_PARAM_KEYS.pos_payment_predispositions])
    next.providers[id] = { ...next.providers[id], ...patch }
    setParam(FISCAL_PARAM_KEYS.pos_payment_predispositions, next)
  }

  const inputStyle = { marginTop: 6, padding: "8px 10px", width: "100%", boxSizing: "border-box" }

  return (
    <section
      style={{
        border: "1px solid #b3e5fc",
        borderRadius: 10,
        padding: "16px 18px",
        marginBottom: 20,
        background: "#f5fcff",
      }}
    >
      <h3 style={{ margin: "0 0 8px", fontSize: 17 }}>POS, PSP e pagamenti — predisposizioni</h3>
      <p style={{ margin: "0 0 14px", fontSize: 13, color: "#37474f", lineHeight: 1.5 }}>
        Catalogo integrazioni già predisposto a livello piattaforma. Con <strong>Attivato</strong> segni che il locale ha
        chiesto l’abilitazione e i dati mancanti (contratti, chiavi, Edge) sono stati o saranno collegati dalla
        piattaforma.
      </p>

      <fieldset
        style={{ border: "1px solid #90caf9", borderRadius: 8, padding: "12px 14px", margin: "0 0 16px", background: "#fff" }}
      >
        <legend style={{ fontSize: 13, fontWeight: 700, padding: "0 6px" }}>A — Registrazione manuale ed export</legend>
        <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={Boolean(p[FISCAL_PARAM_KEYS.pos_manual_export_enabled])}
            onChange={(e) => setParam(FISCAL_PARAM_KEYS.pos_manual_export_enabled, e.target.checked)}
            style={{ marginTop: 3 }}
          />
          <span style={{ fontSize: 14 }}>
            <strong>Abilita export riconciliazione POS manuale</strong>
            <span style={{ display: "block", fontSize: 12, color: "#546e7a", marginTop: 4 }}>
              Scarica un CSV modello per allineare ordini cassa con estratti POS esterni (SumUp, Nexi, banca, ecc.).
            </span>
          </span>
        </label>
        <button
          type="button"
          className="dashboard-settings-btn-secondary"
          style={{ marginTop: 10 }}
          onClick={() => downloadPosManualReconciliationTemplate()}
        >
          Scarica modello CSV riconciliazione
        </button>
      </fieldset>

      <fieldset
        style={{ border: "1px solid #81c784", borderRadius: 8, padding: "12px 14px", margin: "0 0 16px", background: "#fff" }}
      >
        <legend style={{ fontSize: 13, fontWeight: 700, padding: "0 6px" }}>B — Pay-by-link (cassa)</legend>
        <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={Boolean(p[FISCAL_PARAM_KEYS.payment_link_enabled])}
            onChange={(e) => setParam(FISCAL_PARAM_KEYS.payment_link_enabled, e.target.checked)}
            style={{ marginTop: 3 }}
          />
          <span style={{ fontSize: 14 }}>
            <strong>Abilita flusso pay-by-link dopo conferma ordine</strong>
            <span style={{ display: "block", fontSize: 12, color: "#546e7a", marginTop: 4 }}>
              Stripe: crea PaymentIntent via Edge (stesso progetto degli ordini online). Altri PSP: solo intent su DB fino a
              worker dedicato.
            </span>
          </span>
        </label>
        <label style={{ display: "block", marginTop: 12 }}>
          <span style={{ fontWeight: 600 }}>Provider pay-by-link</span>
          <select
            value={p[FISCAL_PARAM_KEYS.payment_link_provider_key] || ""}
            onChange={(e) => setParam(FISCAL_PARAM_KEYS.payment_link_provider_key, e.target.value || null)}
            style={inputStyle}
          >
            <option value="">— Seleziona —</option>
            <option value={PAYMENT_LINK_PROVIDER_KEYS.STRIPE}>Stripe (PaymentIntent — parziale)</option>
            <option value={PAYMENT_LINK_PROVIDER_KEYS.SUMUP}>SumUp (predisposizione)</option>
            <option value={PAYMENT_LINK_PROVIDER_KEYS.NEXI}>Nexi (predisposizione)</option>
            <option value={PAYMENT_LINK_PROVIDER_KEYS.PAYPAL}>PayPal (predisposizione)</option>
            <option value={PAYMENT_LINK_PROVIDER_KEYS.SATISPAY}>Satispay (predisposizione)</option>
          </select>
        </label>
      </fieldset>

      <fieldset
        style={{ border: "1px solid #ffcc80", borderRadius: 8, padding: "12px 14px", margin: "0 0 16px", background: "#fff" }}
      >
        <legend style={{ fontSize: 13, fontWeight: 700, padding: "0 6px" }}>C — Terminale integrato (cloud / lettore)</legend>
        <label style={{ display: "block" }}>
          <span style={{ fontWeight: 600 }}>Adapter terminale preferito</span>
          <select
            value={p[FISCAL_PARAM_KEYS.pos_terminal_provider_key] || ""}
            onChange={(e) => setParam(FISCAL_PARAM_KEYS.pos_terminal_provider_key, e.target.value || null)}
            style={inputStyle}
          >
            <option value={TERMINAL_PROVIDER_KEYS.NONE}>Nessuno (solo manuale)</option>
            <option value={TERMINAL_PROVIDER_KEYS.STRIPE_TERMINAL}>Stripe Terminal</option>
            <option value={TERMINAL_PROVIDER_KEYS.SUMUP_READER}>SumUp lettori</option>
            <option value={TERMINAL_PROVIDER_KEYS.NEXI_SMARTPOS}>Nexi Smart POS</option>
            <option value={TERMINAL_PROVIDER_KEYS.INGENICO}>Ingenico / Worldline</option>
            <option value={TERMINAL_PROVIDER_KEYS.PAX}>PAX</option>
            <option value={TERMINAL_PROVIDER_KEYS.GENERIC_CLOUD}>Generico cloud (API)</option>
          </select>
        </label>
        <button
          type="button"
          className="dashboard-settings-btn-secondary"
          style={{ marginTop: 10 }}
          disabled={!tenantId}
          onClick={async () => {
            const r = await requestTerminalCollection({
              tenantId,
              providerKey: p[FISCAL_PARAM_KEYS.pos_terminal_provider_key],
              importoCent: 100,
            })
            window.alert(r.ok ? "OK" : `${r.code}: ${r.detail || ""}`)
          }}
        >
          Verifica stato adapter (test)
        </button>
      </fieldset>

      <fieldset style={{ border: "1px solid #e0e0e0", borderRadius: 8, padding: "12px 14px", margin: 0, background: "#fff" }}>
        <legend style={{ fontSize: 13, fontWeight: 700, padding: "0 6px" }}>Fiscal / outbox (registratore)</legend>
        <label style={{ display: "block", marginBottom: 10 }}>
          <span style={{ fontWeight: 600 }}>Modalità fiscal</span>
          <select
            value={p[FISCAL_PARAM_KEYS.fiscal_mode] || FISCAL_MODES.NONE}
            onChange={(e) => setParam(FISCAL_PARAM_KEYS.fiscal_mode, e.target.value)}
            style={inputStyle}
          >
            <option value={FISCAL_MODES.NONE}>Nessuna (solo gestionale)</option>
            <option value={FISCAL_MODES.EXPORT_FILE}>Export file</option>
            <option value={FISCAL_MODES.RT_MIDDLEWARE}>Middleware RT</option>
            <option value={FISCAL_MODES.SDI_BRIDGE}>Bridge SDI</option>
          </select>
        </label>
        <label style={{ display: "block" }}>
          <span style={{ fontWeight: 600 }}>Chiave provider fiscal (opzionale)</span>
          <input
            type="text"
            value={p[FISCAL_PARAM_KEYS.fiscal_provider_key] || ""}
            onChange={(e) => setParam(FISCAL_PARAM_KEYS.fiscal_provider_key, e.target.value.trim() || null)}
            placeholder="es. rtmiddleware_fornitore_x"
            style={inputStyle}
          />
        </label>
      </fieldset>

      <div style={{ marginTop: 18 }}>
        <p style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 700 }}>Catalogo sistemi (predisposto / attivato)</p>
        <div style={{ overflowX: "auto", border: "1px solid #e0e0e0", borderRadius: 8, background: "#fff" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ background: "#eceff1", textAlign: "left" }}>
                <th style={{ padding: 8 }}>Sistema</th>
                <th style={{ padding: 8 }}>Percorso</th>
                <th style={{ padding: 8 }}>Prodotto</th>
                <th style={{ padding: 8 }}>Predisp.</th>
                <th style={{ padding: 8 }}>Attivo</th>
                <th style={{ padding: 8 }}>Note interne</th>
              </tr>
            </thead>
            <tbody>
              {POS_INTEGRATION_CATALOG.map((row) => {
                const st = predis.providers[row.id] || { predisposed: true, activated: false, notes: "" }
                return (
                  <tr key={row.id} style={{ borderTop: "1px solid #eee" }}>
                    <td style={{ padding: 8, fontWeight: 600 }}>{row.label}</td>
                    <td style={{ padding: 8 }}>{trackLabel(row.track)}</td>
                    <td style={{ padding: 8 }}>{implLabel(row.implementation)}</td>
                    <td style={{ padding: 8 }}>
                      <input
                        type="checkbox"
                        checked={st.predisposed !== false}
                        onChange={(e) => setPredProvider(row.id, { predisposed: e.target.checked })}
                      />
                    </td>
                    <td style={{ padding: 8 }}>
                      <input
                        type="checkbox"
                        checked={st.activated === true}
                        onChange={(e) => setPredProvider(row.id, { activated: e.target.checked })}
                      />
                    </td>
                    <td style={{ padding: 8 }}>
                      <input
                        type="text"
                        value={st.notes}
                        onChange={(e) => setPredProvider(row.id, { notes: e.target.value })}
                        placeholder="Contratto, ticket, riferimenti"
                        style={{ width: "100%", padding: "4px 6px", boxSizing: "border-box" }}
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}
