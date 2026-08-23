import { useState, useMemo } from "react";
import { useOutletContext } from "react-router-dom";
import { useTenant } from "@/app/contexts/TenantContext";
import { updateTenantSettings } from "@/features/admin/services/adminService";

const GIORNI = [
  { key: 0, nome: "Lunedì", short: "Lun" },
  { key: 1, nome: "Martedì", short: "Mar" },
  { key: 2, nome: "Mercoledì", short: "Mer" },
  { key: 3, nome: "Giovedì", short: "Gio" },
  { key: 4, nome: "Venerdì", short: "Ven" },
  { key: 5, nome: "Sabato", short: "Sab" },
  { key: 6, nome: "Domenica", short: "Dom" },
];

const defaultOrari = () =>
  GIORNI.map((g) => ({
    giorno: g.key,
    nome: g.nome,
    aperto: false,
    apertura: "11:00",
    chiusura: "15:00",
    consegnaDiversa: false,
    consegnaDa: "11:30",
    consegnaA: "14:30",
    pranzoAttivo: false,
    pranzoDa: "12:00",
    pranzoA: "14:30",
  }));

function parseOrari(val) {
  if (!val || !Array.isArray(val)) return defaultOrari();
  const map = new Map((val || []).map((o) => [o.giorno, o]));
  return GIORNI.map((g) => {
    const existing = map.get(g.key) || map.get(String(g.key));
    return {
      giorno: g.key,
      nome: g.nome,
      aperto: existing?.aperto ?? false,
      apertura: existing?.apertura ?? "11:00",
      chiusura: existing?.chiusura ?? "15:00",
      consegnaDiversa: existing?.consegnaDiversa ?? false,
      consegnaDa: existing?.consegnaDa ?? "11:30",
      consegnaA: existing?.consegnaA ?? "14:30",
      pranzoAttivo: existing?.pranzoAttivo ?? false,
      pranzoDa: existing?.pranzoDa ?? "12:00",
      pranzoA: existing?.pranzoA ?? "14:30",
    };
  });
}

export default function OrariSection() {
  const { settings, setSettings } = useOutletContext();
  const { tenantId } = useTenant();
  const [saving, setSaving] = useState(false);

  const orari = useMemo(() => parseOrari(settings?.orari_settimana), [settings?.orari_settimana]);

  const updateGiorno = (index, field, value) => {
    const next = orari.map((o, i) => (i === index ? { ...o, [field]: value } : o));
    setSettings({ ...settings, orari_settimana: next });
  };

  async function handleSave() {
    if (!tenantId || !settings) return;
    try {
      setSaving(true);
      await updateTenantSettings(tenantId, { orari_settimana: orari });
      alert("Giorni e orari salvati.");
    } catch (err) {
      console.error(err);
      alert("Errore durante il salvataggio. " + (err?.message || ""));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="dashboard-settings-page">
      <h1 className="dashboard-page-title">Giorni di apertura e orari</h1>
      <section className="dashboard-box dashboard-settings-section">
        <p className="dashboard-settings-section-desc">
          Seleziona i giorni di apertura e gli orari del locale. Puoi impostare un orario di consegna diverso dall’orario di esercizio.
          Se un giorno è aperto anche a pranzo (oltre alla sera), attiva “Aperto anche a pranzo”: cassa e checkout mostreranno
          entrambe le fasce, saltando il buco di chiusura pomeridiana tra pranzo e sera.
        </p>
        <div style={{ overflowX: "auto", marginTop: 16 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 900 }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #eee" }}>
                <th style={{ textAlign: "left", padding: "10px 8px" }}>Giorno</th>
                <th style={{ textAlign: "left", padding: "10px 8px" }}>Aperto</th>
                <th style={{ textAlign: "left", padding: "10px 8px" }}>Apertura</th>
                <th style={{ textAlign: "left", padding: "10px 8px" }}>Chiusura</th>
                <th style={{ textAlign: "left", padding: "10px 8px" }}>Aperto anche a pranzo</th>
                <th style={{ textAlign: "left", padding: "10px 8px" }}>Pranzo da</th>
                <th style={{ textAlign: "left", padding: "10px 8px" }}>Pranzo a</th>
                <th style={{ textAlign: "left", padding: "10px 8px" }}>Consegna diversa</th>
                <th style={{ textAlign: "left", padding: "10px 8px" }}>Consegna da</th>
                <th style={{ textAlign: "left", padding: "10px 8px" }}>Consegna a</th>
              </tr>
            </thead>
            <tbody>
              {orari.map((row, index) => (
                <tr key={row.giorno} style={{ borderBottom: "1px solid #eee" }}>
                  <td style={{ padding: "8px" }}>{row.nome}</td>
                  <td style={{ padding: "8px" }}>
                    <input
                      type="checkbox"
                      checked={row.aperto}
                      onChange={(e) => updateGiorno(index, "aperto", e.target.checked)}
                    />
                  </td>
                  <td style={{ padding: "8px" }}>
                    <input
                      type="time"
                      value={row.apertura}
                      onChange={(e) => updateGiorno(index, "apertura", e.target.value)}
                      disabled={!row.aperto}
                      style={{ padding: "6px 8px" }}
                    />
                  </td>
                  <td style={{ padding: "8px" }}>
                    <input
                      type="time"
                      value={row.chiusura}
                      onChange={(e) => updateGiorno(index, "chiusura", e.target.value)}
                      disabled={!row.aperto}
                      style={{ padding: "6px 8px" }}
                    />
                  </td>
                  <td style={{ padding: "8px" }}>
                    <input
                      type="checkbox"
                      checked={row.pranzoAttivo}
                      onChange={(e) => updateGiorno(index, "pranzoAttivo", e.target.checked)}
                      disabled={!row.aperto}
                    />
                  </td>
                  <td style={{ padding: "8px" }}>
                    <input
                      type="time"
                      value={row.pranzoDa}
                      onChange={(e) => updateGiorno(index, "pranzoDa", e.target.value)}
                      disabled={!row.aperto || !row.pranzoAttivo}
                      style={{ padding: "6px 8px" }}
                    />
                  </td>
                  <td style={{ padding: "8px" }}>
                    <input
                      type="time"
                      value={row.pranzoA}
                      onChange={(e) => updateGiorno(index, "pranzoA", e.target.value)}
                      disabled={!row.aperto || !row.pranzoAttivo}
                      style={{ padding: "6px 8px" }}
                    />
                  </td>
                  <td style={{ padding: "8px" }}>
                    <input
                      type="checkbox"
                      checked={row.consegnaDiversa}
                      onChange={(e) => updateGiorno(index, "consegnaDiversa", e.target.checked)}
                      disabled={!row.aperto}
                    />
                  </td>
                  <td style={{ padding: "8px" }}>
                    <input
                      type="time"
                      value={row.consegnaDa}
                      onChange={(e) => updateGiorno(index, "consegnaDa", e.target.value)}
                      disabled={!row.aperto || !row.consegnaDiversa}
                      style={{ padding: "6px 8px" }}
                    />
                  </td>
                  <td style={{ padding: "8px" }}>
                    <input
                      type="time"
                      value={row.consegnaA}
                      onChange={(e) => updateGiorno(index, "consegnaA", e.target.value)}
                      disabled={!row.aperto || !row.consegnaDiversa}
                      style={{ padding: "6px 8px" }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
