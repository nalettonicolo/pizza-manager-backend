import { useState } from "react";
import { useOutletContext } from "react-router-dom";
import { useTenant } from "@/app/contexts/TenantContext";
import { updateTenantSettings } from "@/features/admin/services/adminService";

const defaultParametri = () => ({
  pony_lun_gio: "",
  pony_ven_dom: "",
  pizze_ogni_15_min: "",
  consegne_ogni_min: "",
  ritiro_ogni_min: "",
  tempo_preparazione_pizza: "",
  velocita_pony_kmh: "",
  soglia_giallo_pizze: "10",
  comanda_copie: "1",
  comanda_font_size: "13",
  comanda_stampanti: "",
});

export default function ParametriSection() {
  const { settings, setSettings } = useOutletContext();
  const { tenantId } = useTenant();
  const [saving, setSaving] = useState(false);

  const raw = settings?.parametri_operativi && typeof settings.parametri_operativi === "object"
    ? settings.parametri_operativi
    : {};
  const p = {
    ...defaultParametri(),
    ...raw,
    // retrocompatibilità: vecchio pony_consegna → pony_lun_gio se non impostati
    pony_lun_gio: raw.pony_lun_gio !== undefined && raw.pony_lun_gio !== "" ? raw.pony_lun_gio : (raw.pony_consegna ?? ""),
    pony_ven_dom: raw.pony_ven_dom !== undefined && raw.pony_ven_dom !== "" ? raw.pony_ven_dom : "",
    pizze_ogni_15_min: raw.pizze_ogni_15_min !== undefined && raw.pizze_ogni_15_min !== "" ? raw.pizze_ogni_15_min : (raw.pizze_ogni_min ?? ""),
    comanda_stampanti: Array.isArray(raw.comanda_stampanti) ? raw.comanda_stampanti.join(", ") : (raw.comanda_stampanti ?? ""),
  };

  const setParam = (key, value) => {
    setSettings({
      ...settings,
      parametri_operativi: { ...(settings?.parametri_operativi || {}), [key]: value },
    });
  };

  async function handleSave() {
    if (!tenantId || !settings) return;
    try {
      setSaving(true);
      const payload = {
        ...(settings?.parametri_operativi || {}),
        pony_lun_gio: p.pony_lun_gio === "" ? 0 : Number(p.pony_lun_gio) || 0,
        pony_ven_dom: p.pony_ven_dom === "" ? 0 : Number(p.pony_ven_dom) || 0,
        pizze_ogni_15_min: p.pizze_ogni_15_min === "" ? 0 : Number(p.pizze_ogni_15_min) || 0,
        consegne_ogni_min: p.consegne_ogni_min === "" ? 0 : Number(p.consegne_ogni_min) || 0,
        ritiro_ogni_min: p.ritiro_ogni_min === "" ? 0 : Number(p.ritiro_ogni_min) || 0,
        tempo_preparazione_pizza: p.tempo_preparazione_pizza === "" ? 0 : Number(p.tempo_preparazione_pizza) || 0,
        velocita_pony_kmh: p.velocita_pony_kmh === "" ? 0 : Number(p.velocita_pony_kmh) || 0,
        soglia_giallo_pizze: p.soglia_giallo_pizze === "" ? 10 : Number(p.soglia_giallo_pizze) || 10,
        comanda_copie: p.comanda_copie === "" ? 1 : Math.max(1, Number(p.comanda_copie) || 1),
        comanda_font_size: p.comanda_font_size === "" ? 13 : Math.max(9, Number(p.comanda_font_size) || 13),
        comanda_stampanti: String(p.comanda_stampanti || "")
          .split(/\r?\n|,/)
          .map((v) => v.trim())
          .filter(Boolean),
      };
      await updateTenantSettings(tenantId, { parametri_operativi: payload });
      setSettings({ ...settings, parametri_operativi: payload });
      alert("Parametri salvati.");
    } catch (err) {
      console.error(err);
      alert("Errore durante il salvataggio. " + (err?.message || ""));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="dashboard-settings-page">
      <h1 className="dashboard-page-title">Parametri operativi</h1>
      <section className="dashboard-box dashboard-settings-section">
        <div className="dashboard-settings-fields" style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 420 }}>
          <label>
            Pony disponibili per consegna da lunedì a giovedì 
            <input
              type="number"
              min={0}
              placeholder="es. 2"
              value={p.pony_lun_gio === "" ? "" : p.pony_lun_gio}
              onChange={(e) => setParam("pony_lun_gio", e.target.value === "" ? "" : e.target.value)}
              style={{ marginTop: 6, padding: "8px 10px", width: "100%", boxSizing: "border-box" }}
            />
          </label>
          <label>
            Pony disponibili per consegna da venerdì a domenica 
            <input
              type="number"
              min={0}
              placeholder="es. 3"
              value={p.pony_ven_dom === "" ? "" : p.pony_ven_dom}
              onChange={(e) => setParam("pony_ven_dom", e.target.value === "" ? "" : e.target.value)}
              style={{ marginTop: 6, padding: "8px 10px", width: "100%", boxSizing: "border-box" }}
            />
          </label>
          <label>
            Pizze ogni 15 minuti - capacità forno 
            <input
              type="number"
              min={1}
              placeholder="es. 8"
              value={p.pizze_ogni_15_min === "" ? "" : p.pizze_ogni_15_min}
              onChange={(e) => setParam("pizze_ogni_15_min", e.target.value === "" ? "" : e.target.value)}
              style={{ marginTop: 6, padding: "8px 10px", width: "100%", boxSizing: "border-box" }}
            />
          </label>
          <label>
            Consegne programmate ogni tot. di minuti 
            <input
              type="number"
              min={1}
              placeholder="es. 15"
              value={p.consegne_ogni_min === "" ? "" : p.consegne_ogni_min}
              onChange={(e) => setParam("consegne_ogni_min", e.target.value === "" ? "" : e.target.value)}
              style={{ marginTop: 6, padding: "8px 10px", width: "100%", boxSizing: "border-box" }}
            />
          </label>
          <label>
            Ritiro in negozio ogni tot. di minuti 
            <input
              type="number"
              min={1}
              placeholder="es. 15 (quarti d’ora)"
              value={p.ritiro_ogni_min === "" ? "" : p.ritiro_ogni_min}
              onChange={(e) => setParam("ritiro_ogni_min", e.target.value === "" ? "" : e.target.value)}
              style={{ marginTop: 6, padding: "8px 10px", width: "100%", boxSizing: "border-box" }}
            />
          </label>
          <label>
            Tempo di preparazione pizza in minuti 
            <input
              type="number"
              min={1}
              placeholder="es. 5"
              value={p.tempo_preparazione_pizza === "" ? "" : p.tempo_preparazione_pizza}
              onChange={(e) => setParam("tempo_preparazione_pizza", e.target.value === "" ? "" : e.target.value)}
              style={{ marginTop: 6, padding: "8px 10px", width: "100%", boxSizing: "border-box" }}
            />
          </label>
          <label>
            Velocità pony in km/h 
            <input
              type="number"
              min={1}
              step={0.5}
              placeholder="es. 25"
              value={p.velocita_pony_kmh === "" ? "" : p.velocita_pony_kmh}
              onChange={(e) => setParam("velocita_pony_kmh", e.target.value === "" ? "" : e.target.value)}
              style={{ marginTop: 6, padding: "8px 10px", width: "100%", boxSizing: "border-box" }}
            />
          </label>
          <label>
            Soglia giallo (pizze sotto il max per mostrare slot in giallo)
            <input
              type="number"
              min={0}
              placeholder="es. 10"
              value={p.soglia_giallo_pizze === "" ? "" : p.soglia_giallo_pizze}
              onChange={(e) => setParam("soglia_giallo_pizze", e.target.value === "" ? "" : e.target.value)}
              style={{ marginTop: 6, padding: "8px 10px", width: "100%", boxSizing: "border-box" }}
            />
          </label>
          <p style={{ fontSize: 13, color: "#888", marginTop: 8 }}>
            Distanza/area di consegna (delimitazione su mappa) verrà sviluppata in seguito.
          </p>
          <h3 style={{ margin: "8px 0 0", fontSize: 16 }}>Comanda</h3>
          <label>
            Numero copie comanda
            <input
              type="number"
              min={1}
              placeholder="es. 1"
              value={p.comanda_copie === "" ? "" : p.comanda_copie}
              onChange={(e) => setParam("comanda_copie", e.target.value === "" ? "" : e.target.value)}
              style={{ marginTop: 6, padding: "8px 10px", width: "100%", boxSizing: "border-box" }}
            />
          </label>
          <label>
            Dimensione carattere comanda
            <input
              type="number"
              min={9}
              max={24}
              placeholder="es. 13"
              value={p.comanda_font_size === "" ? "" : p.comanda_font_size}
              onChange={(e) => setParam("comanda_font_size", e.target.value === "" ? "" : e.target.value)}
              style={{ marginTop: 6, padding: "8px 10px", width: "100%", boxSizing: "border-box" }}
            />
          </label>
          <label>
            Stampanti comanda (una per riga o separate da virgola)
            <textarea
              rows={3}
              placeholder="es. Cucina, Bancone"
              value={p.comanda_stampanti || ""}
              onChange={(e) => setParam("comanda_stampanti", e.target.value)}
              style={{ marginTop: 6, padding: "8px 10px", width: "100%", boxSizing: "border-box", resize: "vertical" }}
            />
          </label>
        </div>
      </section>
      <div className="dashboard-settings-actions" style={{ marginTop: 16 }}>
        <button type="button" className="btn-primary-dashboard" onClick={handleSave} disabled={saving}>
          {saving ? "Salvataggio..." : "Salva"}
        </button>
      </div>
    </div>
  );
}
