import { useState, useRef, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import { useTenant } from "@/app/contexts/TenantContext";
import { supabase } from "@/lib/supabaseClient";
import { updateTenantSettings } from "@/features/admin/services/adminService";
import { DEFAULT_MENU_THEME, resolveMenuTheme } from "@/utils/tenantMenuTheme";

const PALETTE_PRESETS = [
  { name: "Classico", primary: "#c0392b", accent: "#e67e22", background: "#fdf2e9", cardBackground: "#ffffff" },
  { name: "Scuro", primary: "#2c3e50", accent: "#3498db", background: "#1a1a2e", cardBackground: "#16213e" },
  { name: "Verde", primary: "#27ae60", accent: "#2ecc71", background: "#e8f5e9", cardBackground: "#ffffff" },
  { name: "Blu", primary: "#2980b9", accent: "#3498db", background: "#ebf5fb", cardBackground: "#ffffff" },
  { name: "Neutro", primary: "#374151", accent: "#6b7280", background: "#f3f4f6", cardBackground: "#ffffff" },
];

export default function LayoutSection() {
  const { settings, setSettings } = useOutletContext();
  const { tenantId, refreshTenant } = useTenant();
  const [saving, setSaving] = useState(false);
  const [logoPreview, setLogoPreview] = useState(settings?.logo_url ?? null);
  const [logoFile, setLogoFile] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!logoFile && settings?.logo_url) setLogoPreview(settings.logo_url);
    else if (!logoFile && !settings?.logo_url) setLogoPreview(null);
  }, [settings?.logo_url, logoFile]);

  const menuTheme = resolveMenuTheme(settings?.parametri_operativi) ?? { ...DEFAULT_MENU_THEME };
  const [themeColors, setThemeColors] = useState(menuTheme);

  useEffect(() => {
    const next = resolveMenuTheme(settings?.parametri_operativi) ?? { ...DEFAULT_MENU_THEME };
    setThemeColors(next);
  }, [settings?.parametri_operativi]);

  function handleLogoChange(e) {
    const file = e.target?.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    setLogoFile(file);
    const reader = new FileReader();
    reader.onload = () => setLogoPreview(reader.result);
    reader.readAsDataURL(file);
  }

  function clearLogo() {
    setLogoFile(null);
    setLogoPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setSettings((s) => (s ? { ...s, logo_url: null } : s));
  }

  function handleThemeChange(key, value) {
    setThemeColors((prev) => ({ ...prev, [key]: value || DEFAULT_MENU_THEME[key] }));
  }

  function applyPreset(preset) {
    setThemeColors({
      primary: preset.primary,
      accent: preset.accent,
      background: preset.background,
      cardBackground: preset.cardBackground,
    });
  }

  async function handleSave() {
    if (!tenantId || !settings) return;
    try {
      setSaving(true);
      let logoUrl = settings.logo_url ?? null;
      if (logoFile) {
        const ext = logoFile.name.split(".").pop() || "png";
        const path = `${tenantId}/logo.${ext}`;
        try {
          const { error: uploadError } = await supabase.storage.from("tenant-logos").upload(path, logoFile, { upsert: true });
          if (!uploadError) {
            const { data: urlData } = supabase.storage.from("tenant-logos").getPublicUrl(path);
            logoUrl = urlData?.publicUrl ?? logoUrl;
          }
        } catch {
          /* upload opzionale: errori già gestiti da logoUrl */
        }
        if (!logoUrl) {
          alert("Upload logo non riuscito. Crea il bucket Storage 'tenant-logos' in Supabase e riprova.");
          setSaving(false);
          return;
        }
        setLogoFile(null);
      }
      const parametri = { ...(settings.parametri_operativi || {}), menuTheme: themeColors };
      await updateTenantSettings(tenantId, { logo_url: logoUrl, parametri_operativi: parametri });
      setSettings((s) => (s ? { ...s, logo_url: logoUrl, parametri_operativi: parametri } : s));
      setLogoPreview(logoUrl ?? null);
      if (refreshTenant) await refreshTenant();
      alert("Layout salvato.");
    } catch (err) {
      console.error(err);
      alert("Errore durante il salvataggio. " + (err?.message || ""));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="dashboard-settings-page">
      <h1 className="dashboard-page-title">Layout e branding</h1>
      <section className="dashboard-box dashboard-settings-section">
        <p className="dashboard-settings-section-desc">
          Logo e colori si applicano a tutta l’interfaccia della pizzeria associata a questo dominio.
        </p>
        <div className="dashboard-settings-logo">
          <div className="dashboard-settings-logo-preview">
            {logoPreview ? (
              <img src={logoPreview} alt="Logo" />
            ) : (
              <span className="dashboard-settings-logo-placeholder">Nessun logo</span>
            )}
          </div>
          <div className="dashboard-settings-logo-actions">
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleLogoChange} style={{ display: "none" }} />
            <button type="button" className="btn-primary-dashboard" onClick={() => fileInputRef.current?.click()}>
              Carica logo
            </button>
            {logoPreview && (
              <button type="button" className="dashboard-settings-btn-secondary" onClick={clearLogo}>
                Rimuovi logo
              </button>
            )}
          </div>
        </div>

        <h3 className="dashboard-settings-section-title" style={{ marginTop: 24 }}>Colori view menu</h3>
        <p className="dashboard-settings-section-desc">
          Personalizza i colori delle pagine menu (navbar, pulsanti, sfondo, card). Puoi usare una palette preimpostata o modificare i singoli colori.
        </p>
        <div className="dashboard-settings-fields">
          <div className="menu-theme-presets">
            <span className="menu-theme-presets-label">Palette:</span>
            <div className="menu-theme-presets-buttons">
              {PALETTE_PRESETS.map((preset) => (
                <button
                  key={preset.name}
                  type="button"
                  className="menu-theme-preset-btn"
                  onClick={() => applyPreset(preset)}
                  title={preset.name}
                >
                  <span className="menu-theme-preset-swatch" style={{ background: preset.primary }} />
                  <span className="menu-theme-preset-swatch" style={{ background: preset.accent }} />
                  <span className="menu-theme-preset-swatch" style={{ background: preset.background }} />
                </button>
              ))}
            </div>
          </div>
          <div className="menu-theme-fields">
            <label className="menu-theme-field">
              <span>Colore primario (navbar, titoli, link)</span>
              <div className="menu-theme-input-row">
                <input type="color" value={themeColors.primary} onChange={(e) => handleThemeChange("primary", e.target.value)} className="menu-theme-color-input" />
                <input type="text" value={themeColors.primary} onChange={(e) => handleThemeChange("primary", e.target.value)} className="menu-theme-hex-input" placeholder="#c0392b" maxLength={7} />
              </div>
            </label>
            <label className="menu-theme-field">
              <span>Colore accento (pulsanti, evidenziazioni)</span>
              <div className="menu-theme-input-row">
                <input type="color" value={themeColors.accent} onChange={(e) => handleThemeChange("accent", e.target.value)} className="menu-theme-color-input" />
                <input type="text" value={themeColors.accent} onChange={(e) => handleThemeChange("accent", e.target.value)} className="menu-theme-hex-input" placeholder="#e67e22" maxLength={7} />
              </div>
            </label>
            <label className="menu-theme-field">
              <span>Sfondo pagina</span>
              <div className="menu-theme-input-row">
                <input type="color" value={themeColors.background} onChange={(e) => handleThemeChange("background", e.target.value)} className="menu-theme-color-input" />
                <input type="text" value={themeColors.background} onChange={(e) => handleThemeChange("background", e.target.value)} className="menu-theme-hex-input" placeholder="#fdf2e9" maxLength={7} />
              </div>
            </label>
            <label className="menu-theme-field">
              <span>Sfondo card prodotto</span>
              <div className="menu-theme-input-row">
                <input type="color" value={themeColors.cardBackground} onChange={(e) => handleThemeChange("cardBackground", e.target.value)} className="menu-theme-color-input" />
                <input type="text" value={themeColors.cardBackground} onChange={(e) => handleThemeChange("cardBackground", e.target.value)} className="menu-theme-hex-input" placeholder="#ffffff" maxLength={7} />
              </div>
            </label>
          </div>
        </div>
      </section>
      <div className="dashboard-settings-actions">
        <button type="button" className="btn-primary-dashboard" onClick={handleSave} disabled={saving}>
          {saving ? "Salvataggio..." : "Salva"}
        </button>
      </div>
    </div>
  );
}
