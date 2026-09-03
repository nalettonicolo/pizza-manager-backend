import { useState } from "react"
import { Link, useOutletContext } from "react-router-dom"
import { useTenant } from "@/app/contexts/TenantContext"
import SettingsSectionHeader from "@/features/admin/components/SettingsSectionHeader"
import { updateTenantSettings } from "@/features/admin/services/adminService"
import { DEFAULT_COOKIE_TEMPLATE, DEFAULT_PRIVACY_TEMPLATE } from "@/features/admin/pages/settings/legalPolicyTemplates"

function readPolicyHtml(settings, key) {
  if (typeof settings?.[key] === "string" && settings[key].trim()) return settings[key]
  const po = settings?.parametri_operativi
  if (po && typeof po === "object" && typeof po[key] === "string") return po[key]
  return ""
}

export default function PrivacyCookieSection() {
  const { settings, setSettings } = useOutletContext()
  const { tenantId, refreshTenant } = useTenant()
  const [saving, setSaving] = useState(false)

  const privacy = readPolicyHtml(settings, "privacy_policy_html")
  const cookie = readPolicyHtml(settings, "cookie_policy_html")

  const setPolicy = (key, value) => {
    setSettings((prev) => ({
      ...prev,
      [key]: value,
      parametri_operativi: {
        ...(prev?.parametri_operativi && typeof prev.parametri_operativi === "object"
          ? prev.parametri_operativi
          : {}),
        [key]: value,
      },
    }))
  }

  async function handleSave() {
    if (!tenantId || !settings) return
    setSaving(true)
    try {
      const prevPo =
        settings.parametri_operativi && typeof settings.parametri_operativi === "object"
          ? { ...settings.parametri_operativi }
          : {}
      prevPo.privacy_policy_html = privacy.trim() || null
      prevPo.cookie_policy_html = cookie.trim() || null
      await updateTenantSettings(tenantId, { parametri_operativi: prevPo })
      if (refreshTenant) await refreshTenant()
      alert("Testi privacy e cookie salvati.")
    } catch (err) {
      console.error(err)
      alert("Errore durante il salvataggio. " + (err?.message || ""))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="admin-settings-page dashboard-settings-page">
      <SettingsSectionHeader
        title="Privacy e cookie"
        description="Testi mostrati sul sito della pizzeria. Se lasci i campi vuoti, restano le informative predefinite. I dati di titolare, indirizzo e P.IVA si compilano in Dati pizzeria."
      />

      <p className="dati-pizzeria-hint" style={{ marginBottom: 16, lineHeight: 1.55 }}>
        Puoi usare segnaposto come <code>{"{{nome_attivita}}"}</code>, <code>{"{{piva}}"}</code>,{" "}
        <code>{"{{pec}}"}</code>, <code>{"{{indirizzo}}"}</code>, <code>{"{{email}}"}</code>. Anagrafica e dati
        fiscali: <Link to="/admin/settings/dati-pizzeria">Dati pizzeria</Link>.
      </p>

      <section className="dashboard-box dashboard-settings-section">
        <div className="dashboard-settings-fields">
          <label>
            Privacy policy (HTML, opzionale)
            <div style={{ marginBottom: 8 }}>
              <button
                type="button"
                className="dashboard-settings-btn-secondary"
                onClick={() => setPolicy("privacy_policy_html", DEFAULT_PRIVACY_TEMPLATE)}
              >
                Usa modello professionale privacy
              </button>
            </div>
            <textarea
              rows={8}
              value={privacy}
              onChange={(e) => setPolicy("privacy_policy_html", e.target.value)}
              placeholder="<p>Informativa personalizzata… {{nome_attivita}}</p>"
            />
          </label>
          <label>
            Cookie policy (HTML, opzionale)
            <div style={{ marginBottom: 8 }}>
              <button
                type="button"
                className="dashboard-settings-btn-secondary"
                onClick={() => setPolicy("cookie_policy_html", DEFAULT_COOKIE_TEMPLATE)}
              >
                Usa modello professionale cookie
              </button>
            </div>
            <textarea
              rows={8}
              value={cookie}
              onChange={(e) => setPolicy("cookie_policy_html", e.target.value)}
            />
          </label>
        </div>
      </section>

      <div className="dashboard-settings-actions">
        <button type="button" className="btn-primary-dashboard" onClick={handleSave} disabled={saving}>
          {saving ? "Salvataggio..." : "Salva"}
        </button>
      </div>
    </div>
  )
}
