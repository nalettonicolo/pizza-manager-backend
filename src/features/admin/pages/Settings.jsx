import { useEffect, useState, useRef } from "react";

import { useTenant } from "@/app/contexts/TenantContext";
import Loader from "@/components/feedback/Loader";
import ErrorState from "@/components/feedback/ErrorState";
import { supabase } from "@/lib/supabaseClient";

import {
  getTenantSettings,
  updateTenantSettings,
} from "@/features/admin/services/adminService";

export default function Settings() {
  const { tenantId, refreshTenant } = useTenant();
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [logoFile, setLogoFile] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!tenantId) return;

    async function load() {
      try {
        setLoading(true);
        const data = await getTenantSettings(tenantId);
        setSettings(data || {});
        if (data?.logo_url) setLogoPreview(data.logo_url);
      } catch (err) {
        console.error(err);
        setError("Errore durante il caricamento delle impostazioni.");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [tenantId]);

  async function handleLogoChange(e) {
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
    if (settings) setSettings({ ...settings, logo_url: null });
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
          const { error: uploadError } = await supabase.storage
            .from("tenant-logos")
            .upload(path, logoFile, { upsert: true });
          if (!uploadError) {
            const { data: urlData } = supabase.storage.from("tenant-logos").getPublicUrl(path);
            logoUrl = urlData?.publicUrl ?? logoUrl;
          } else {
            console.warn("Upload logo fallito:", uploadError);
          }
        } catch (e) {
          console.warn("Upload logo fallito (bucket tenant-logos?):", e);
        }
        if (logoFile && !logoUrl) {
          alert("Upload logo non riuscito. Crea il bucket Storage 'tenant-logos' in Supabase (Storage) e riprova.");
          setSaving(false);
          return;
        }
      }

      const payload = {
        nome: settings.nome ?? "",
        telefono: settings.telefono ?? "",
        indirizzo: settings.indirizzo ?? "",
      };
      if (logoUrl !== undefined) payload.logo_url = logoUrl;

      try {
        await updateTenantSettings(tenantId, payload);
      } catch (updateErr) {
        if (payload.logo_url !== undefined) {
          delete payload.logo_url;
          await updateTenantSettings(tenantId, payload);
          setLogoFile(null);
          alert("Dati pizzeria salvati. Per salvare anche il logo esegui la migrazione add_tenant_logo_url.sql e crea il bucket Storage 'tenant-logos'.");
          return;
        }
        throw updateErr;
      }
      if (refreshTenant) await refreshTenant();
      setLogoFile(null);
      setLogoPreview(logoUrl ?? null);
      setSettings((s) => (s ? { ...s, logo_url: logoUrl ?? null } : s));
      alert("Impostazioni salvate correttamente.");
    } catch (err) {
      console.error(err);
      alert("Errore durante il salvataggio. " + (err.message || ""));
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Loader />;
  if (error) return <ErrorState message={error} />;
  if (!settings) return null;

  return (
    <div className="dashboard-settings-page">
      <h1 className="dashboard-page-title">Impostazioni Pizzeria</h1>

      <section className="dashboard-box dashboard-settings-section">
        <h2 className="dashboard-settings-section-title">Dati pizzeria</h2>
        <div className="dashboard-settings-fields">
          <label>
            Nome pizzeria
            <input
              type="text"
              value={settings.nome || ""}
              onChange={(e) => setSettings({ ...settings, nome: e.target.value })}
              placeholder="Es. Pizzeria Da Mario"
            />
          </label>
          <label>
            Telefono
            <input
              type="text"
              value={settings.telefono || ""}
              onChange={(e) => setSettings({ ...settings, telefono: e.target.value })}
              placeholder="Es. 06 1234567"
            />
          </label>
          <label>
            Indirizzo
            <input
              type="text"
              value={settings.indirizzo || ""}
              onChange={(e) => setSettings({ ...settings, indirizzo: e.target.value })}
              placeholder="Es. Via Roma 1, Roma"
            />
          </label>
        </div>
      </section>

      <section className="dashboard-box dashboard-settings-section">
        <h2 className="dashboard-settings-section-title">Stile e branding</h2>
        <p className="dashboard-settings-section-desc">
          Personalizza l’aspetto dell’area gestione: carica il tuo logo e in seguito potrai definire colori e stile.
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
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleLogoChange}
              style={{ display: "none" }}
            />
            <button
              type="button"
              className="btn-primary-dashboard"
              onClick={() => fileInputRef.current?.click()}
            >
              Carica logo
            </button>
            {logoPreview && (
              <button type="button" className="dashboard-settings-btn-secondary" onClick={clearLogo}>
                Rimuovi logo
              </button>
            )}
          </div>
        </div>
      </section>

      <div className="dashboard-settings-actions">
        <button
          type="button"
          className="btn-primary-dashboard"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? "Salvataggio..." : "Salva impostazioni"}
        </button>
      </div>
    </div>
  );
}
