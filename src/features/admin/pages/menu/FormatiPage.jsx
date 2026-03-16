import { useEffect, useState, useMemo } from "react";
import { useTenant } from "@/app/contexts/TenantContext";
import Loader from "@/components/feedback/Loader";
import ErrorState from "@/components/feedback/ErrorState";
import Modal from "@/components/dashboard/Modal";
import SearchBar from "@/components/dashboard/SearchBar";
import {
  getFormati,
  createFormato,
  updateFormato,
  getTenantSettings,
  updateTenantSettings,
} from "@/features/admin/services/adminService";
import { formatPrice } from "@/utils/format";
import { sortByOrdine } from "@/utils/sortByOrdine";

const DEFAULT_FAMIGLIA = {
  famiglia_attivo: false,
  famiglia_1_gusto_tipo: "fisso",
  famiglia_1_gusto_importo: "",
  famiglia_2_gusti_aggiunta: "",
  famiglia_3_gusti_aggiunta: "",
  famiglia_4_gusti_aggiunta: "",
};
const DEFAULT_METRO = { mezzo_metro_gusti_max: "", metro_gusti_max: "", mezzo_metro_prezzo: "", metro_prezzo: "" };

export default function FormatiPage() {
  const { tenantId } = useTenant();
  const [formati, setFormati] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [newName, setNewName] = useState("");
  const [newPrezzo, setNewPrezzo] = useState("");
  const [newOrdine, setNewOrdine] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editFormato, setEditFormato] = useState(null);
  const [editNome, setEditNome] = useState("");
  const [editPrezzo, setEditPrezzo] = useState("");
  const [editOrdine, setEditOrdine] = useState(0);
  const [editAttivo, setEditAttivo] = useState(true);
  const [tenantSettings, setTenantSettings] = useState(null);
  const [famiglia, setFamiglia] = useState(DEFAULT_FAMIGLIA);
  const [metro, setMetro] = useState(DEFAULT_METRO);
  const [savingSpecial, setSavingSpecial] = useState(false);

  async function load() {
    if (!tenantId) return;
    try {
      setLoading(true);
      setError(null);
      const [data, settings] = await Promise.all([
        getFormati(tenantId),
        getTenantSettings(tenantId).catch(() => null),
      ]);
      setFormati(sortByOrdine(data || []));
      const po = settings?.parametri_operativi && typeof settings.parametri_operativi === "object" ? settings.parametri_operativi : {};
      setTenantSettings(settings || {});
      setFamiglia({
        ...DEFAULT_FAMIGLIA,
        famiglia_attivo: !!po.famiglia_attivo,
        famiglia_1_gusto_tipo: po.famiglia_1_gusto_tipo === "doppio" ? "doppio" : "fisso",
        famiglia_1_gusto_importo: po.famiglia_1_gusto_importo !== undefined && po.famiglia_1_gusto_importo !== "" ? String(po.famiglia_1_gusto_importo) : "",
        famiglia_2_gusti_aggiunta: po.famiglia_2_gusti_aggiunta !== undefined && po.famiglia_2_gusti_aggiunta !== "" ? String(po.famiglia_2_gusti_aggiunta) : "",
        famiglia_3_gusti_aggiunta: po.famiglia_3_gusti_aggiunta !== undefined && po.famiglia_3_gusti_aggiunta !== "" ? String(po.famiglia_3_gusti_aggiunta) : "",
        famiglia_4_gusti_aggiunta: po.famiglia_4_gusti_aggiunta !== undefined && po.famiglia_4_gusti_aggiunta !== "" ? String(po.famiglia_4_gusti_aggiunta) : "",
      });
      setMetro({
        mezzo_metro_gusti_max: po.mezzo_metro_gusti_max !== undefined && po.mezzo_metro_gusti_max !== "" ? String(po.mezzo_metro_gusti_max) : "",
        metro_gusti_max: po.metro_gusti_max !== undefined && po.metro_gusti_max !== "" ? String(po.metro_gusti_max) : "",
        mezzo_metro_prezzo: po.mezzo_metro_prezzo !== undefined && po.mezzo_metro_prezzo !== "" ? String(po.mezzo_metro_prezzo) : "",
        metro_prezzo: po.metro_prezzo !== undefined && po.metro_prezzo !== "" ? String(po.metro_prezzo) : "",
      });
    } catch (err) {
      console.error(err);
      setError("Errore caricamento formati. Esegui in Supabase il file server/pizzeria-backend/prisma/schema_formati_cottura.sql");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [tenantId]);

  const filteredFormati = useMemo(() => {
    if (!searchTerm.trim()) return sortByOrdine(formati);
    const q = searchTerm.trim().toLowerCase();
    return sortByOrdine(formati.filter((f) => (f.nome || "").toLowerCase().includes(q)));
  }, [formati, searchTerm]);

  if (loading) return <Loader />;
  if (error) return <ErrorState message={error} />;

  async function handleAdd() {
    if (!newName.trim()) return;
    try {
      await createFormato({
        tenant_id: tenantId,
        nome: newName.trim(),
        prezzo: Number(String(newPrezzo).replace(",", ".")) || 0,
        ordine: Number(newOrdine) || 0,
        attivo: true,
      });
      setNewName("");
      setNewPrezzo("");
      setNewOrdine(formati.length);
      setModalOpen(false);
      load();
    } catch (err) {
      console.error(err);
      alert("Errore creazione formato.");
    }
  }

  async function handleToggle(f) {
    try {
      await updateFormato(f.id, { attivo: !f.attivo });
      load();
    } catch (err) {
      console.error(err);
      alert("Errore aggiornamento.");
    }
  }

  function openEdit(f) {
    setEditFormato(f);
    setEditNome(f.nome ?? "");
    setEditPrezzo(f.prezzo != null ? String(f.prezzo) : "");
    setEditOrdine(f.ordine ?? 0);
    setEditAttivo(f.attivo !== false);
  }

  async function handleSaveEdit() {
    if (!editFormato || !editNome.trim()) return;
    try {
      await updateFormato(editFormato.id, {
        nome: editNome.trim(),
        prezzo: Number(String(editPrezzo).replace(",", ".")) || 0,
        ordine: Number(editOrdine) || 0,
        attivo: editAttivo,
      });
      setEditFormato(null);
      load();
    } catch (err) {
      console.error(err);
      alert("Errore aggiornamento formato.");
    }
  }

  async function handleSaveFormatiSpeciali() {
    if (!tenantId || !tenantSettings) return;
    setSavingSpecial(true);
    try {
      const po = tenantSettings.parametri_operativi && typeof tenantSettings.parametri_operativi === "object" ? { ...tenantSettings.parametri_operativi } : {};
      po.famiglia_attivo = famiglia.famiglia_attivo;
      po.famiglia_1_gusto_tipo = famiglia.famiglia_1_gusto_tipo;
      po.famiglia_1_gusto_importo = famiglia.famiglia_1_gusto_importo === "" ? 0 : Number(String(famiglia.famiglia_1_gusto_importo).replace(",", "."));
      po.famiglia_2_gusti_aggiunta = famiglia.famiglia_2_gusti_aggiunta === "" ? 0 : Number(String(famiglia.famiglia_2_gusti_aggiunta).replace(",", "."));
      po.famiglia_3_gusti_aggiunta = famiglia.famiglia_3_gusti_aggiunta === "" ? 0 : Number(String(famiglia.famiglia_3_gusti_aggiunta).replace(",", "."));
      po.famiglia_4_gusti_aggiunta = famiglia.famiglia_4_gusti_aggiunta === "" ? 0 : Number(String(famiglia.famiglia_4_gusti_aggiunta).replace(",", "."));
      po.mezzo_metro_gusti_max = metro.mezzo_metro_gusti_max === "" ? 0 : Math.max(0, parseInt(metro.mezzo_metro_gusti_max, 10));
      po.metro_gusti_max = metro.metro_gusti_max === "" ? 0 : Math.max(0, parseInt(metro.metro_gusti_max, 10));
      po.mezzo_metro_prezzo = metro.mezzo_metro_prezzo === "" ? 0 : Number(String(metro.mezzo_metro_prezzo).replace(",", "."));
      po.metro_prezzo = metro.metro_prezzo === "" ? 0 : Number(String(metro.metro_prezzo).replace(",", "."));
      await updateTenantSettings(tenantId, { parametri_operativi: po });
      setTenantSettings({ ...tenantSettings, parametri_operativi: po });
      alert("Formati speciali salvati. Ordinabili solo in negozio.");
    } catch (err) {
      console.error(err);
      alert("Errore salvataggio. " + (err?.message || ""));
    } finally {
      setSavingSpecial(false);
    }
  }

  function setFamigliaKey(key, value) {
    setFamiglia((prev) => ({ ...prev, [key]: value }));
  }
  function setMetroKey(key, value) {
    setMetro((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <div className="dashboard-menu-area">
      <div className="dashboard-title-row">
        <h1 className="dashboard-page-title">Formati</h1>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, alignItems: "start" }}>
        {/* Colonna sinistra: Formati standard */}
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
            <h2 style={{ margin: 0, fontSize: 18 }}>Formati standard</h2>
            <SearchBar value={searchTerm} onChange={setSearchTerm} placeholder="Cerca formati..." />
            <button type="button" className="btn-primary-dashboard" onClick={() => setModalOpen(true)}>
              Inserisci
            </button>
          </div>
          <p className="dashboard-menu-intro" style={{ marginBottom: 16 }}>
            Dimensioni della pizza (es. Normale, Grande, Maxi). Ogni formato può avere una <strong>variazione di prezzo</strong> (€). Ordine indica la sequenza di visualizzazione.
          </p>

          <ul className="dashboard-list">
            {filteredFormati.map((f) => (
              <li key={f.id} className="dashboard-list-item">
                <span className="dashboard-list-item-name">{f.nome}</span>
                <span className="dashboard-list-item-meta">
                  € {formatPrice(f.prezzo)} · Ordine: {f.ordine ?? 0}
                </span>
                <button type="button" className="btn-primary-dashboard" onClick={() => openEdit(f)} style={{ marginRight: 8 }}>
                  Modifica
                </button>
                <button
                  type="button"
                  className={f.attivo !== false ? "dashboard-btn-active" : "dashboard-btn-inactive"}
                  onClick={() => handleToggle(f)}
                >
                  {f.attivo !== false ? "Attiva" : "Disattiva"}
                </button>
              </li>
            ))}
          </ul>
          {filteredFormati.length === 0 && (
            <p className="dashboard-empty">
              {searchTerm.trim() ? "Nessun formato corrisponde alla ricerca." : "Nessun formato. Aggiungine uno per iniziare (es. Normale, Grande)."}
            </p>
          )}
        </div>

        {/* Colonna destra: Formati speciali */}
        <div className="dashboard-box">
          <h2 style={{ margin: "0 0 16px", fontSize: 18 }}>Formati speciali (solo ritiro in negozio)</h2>

        <div style={{ marginBottom: 20 }}>
          <label className="dashboard-checkbox-label" style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <input
              type="checkbox"
              checked={famiglia.famiglia_attivo}
              onChange={(e) => setFamigliaKey("famiglia_attivo", e.target.checked)}
            />
            <strong>Pizza Famiglia</strong> – attiva formato famiglia
          </label>
          {famiglia.famiglia_attivo && (
            <div style={{ paddingLeft: 24, display: "flex", flexDirection: "column", gap: 12 }}>
              <p style={{ margin: 0, fontSize: 13, color: "#555" }}>1 gusto:</p>
              <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <input
                    type="radio"
                    name="famiglia_1_tipo"
                    checked={famiglia.famiglia_1_gusto_tipo === "fisso"}
                    onChange={() => setFamigliaKey("famiglia_1_gusto_tipo", "fisso")}
                  />
                  Prezzo fisso (€)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={famiglia.famiglia_1_gusto_importo}
                  onChange={(e) => setFamigliaKey("famiglia_1_gusto_importo", e.target.value)}
                  style={{ width: 90 }}
                  disabled={famiglia.famiglia_1_gusto_tipo !== "fisso"}
                />
                <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <input
                    type="radio"
                    name="famiglia_1_tipo"
                    checked={famiglia.famiglia_1_gusto_tipo === "doppio"}
                    onChange={() => setFamigliaKey("famiglia_1_gusto_tipo", "doppio")}
                  />
                  Doppio prezzo pizza
                </label>
              </div>
              <p style={{ margin: 0, fontSize: 13, color: "#555" }}>2 gusti: somma prezzi delle 2 pizze + aggiunta (€)</p>
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={famiglia.famiglia_2_gusti_aggiunta}
                onChange={(e) => setFamigliaKey("famiglia_2_gusti_aggiunta", e.target.value)}
                style={{ width: 100 }}
              />
              <p style={{ margin: 0, fontSize: 13, color: "#555" }}>3 gusti: aggiunta (€)</p>
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={famiglia.famiglia_3_gusti_aggiunta}
                onChange={(e) => setFamigliaKey("famiglia_3_gusti_aggiunta", e.target.value)}
                style={{ width: 100 }}
              />
              <p style={{ margin: 0, fontSize: 13, color: "#555" }}>4 gusti: aggiunta (€)</p>
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={famiglia.famiglia_4_gusti_aggiunta}
                onChange={(e) => setFamigliaKey("famiglia_4_gusti_aggiunta", e.target.value)}
                style={{ width: 100 }}
              />
            </div>
          )}
        </div>

        <div style={{ borderTop: "1px solid #eee", paddingTop: 16 }}>
          <strong>Mezzo metro / Metro</strong>
          <p style={{ margin: "4px 0 12px", fontSize: 13, color: "#555" }}>Gusti massimi selezionabili. 0 = formato disattivato. Prezzi (€) per mezzo metro e metro.</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
              <label>
                <span style={{ marginRight: 6 }}>Gusti max mezzo metro:</span>
                <input
                  type="number"
                  min={0}
                  max={10}
                  placeholder="0"
                  value={metro.mezzo_metro_gusti_max}
                  onChange={(e) => setMetroKey("mezzo_metro_gusti_max", e.target.value)}
                  style={{ width: 70 }}
                />
              </label>
              <label>
                <span style={{ marginRight: 6 }}>Prezzo mezzo metro (€):</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={metro.mezzo_metro_prezzo}
                  onChange={(e) => setMetroKey("mezzo_metro_prezzo", e.target.value)}
                  style={{ width: 90 }}
                />
              </label>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
              <label>
                <span style={{ marginRight: 6 }}>Gusti max metro:</span>
                <input
                  type="number"
                  min={0}
                  max={10}
                  placeholder="0"
                  value={metro.metro_gusti_max}
                  onChange={(e) => setMetroKey("metro_gusti_max", e.target.value)}
                  style={{ width: 70 }}
                />
              </label>
              <label>
                <span style={{ marginRight: 6 }}>Prezzo metro (€):</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={metro.metro_prezzo}
                  onChange={(e) => setMetroKey("metro_prezzo", e.target.value)}
                  style={{ width: 90 }}
                />
              </label>
            </div>
          </div>
        </div>

        <button
          type="button"
          className="btn-primary-dashboard"
          onClick={handleSaveFormatiSpeciali}
          disabled={savingSpecial}
          style={{ marginTop: 16 }}
        >
          {savingSpecial ? "Salvataggio..." : "Salva formati speciali"}
        </button>
        </div>
      </div>

      <Modal open={!!editFormato} onClose={() => setEditFormato(null)} title="Modifica formato">
        <div className="dashboard-box dashboard-form-row" style={{ flexDirection: "column", gap: 12 }}>
          <input
            type="text"
            placeholder="Nome formato"
            value={editNome}
            onChange={(e) => setEditNome(e.target.value)}
          />
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <label>
              <span style={{ marginRight: 6 }}>Prezzo (€):</span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={editPrezzo}
                onChange={(e) => setEditPrezzo(e.target.value)}
                style={{ width: 90 }}
              />
            </label>
            <label>
              <span style={{ marginRight: 6 }}>Ordine:</span>
              <input
                type="number"
                min={0}
                value={editOrdine}
                onChange={(e) => setEditOrdine(e.target.value)}
                style={{ width: 80 }}
              />
            </label>
            <label className="dashboard-checkbox-label" style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <input
                type="checkbox"
                checked={editAttivo}
                onChange={(e) => setEditAttivo(e.target.checked)}
              />
              Attivo
            </label>
          </div>
          <button type="button" className="btn-primary-dashboard" onClick={handleSaveEdit}>
            Salva modifiche
          </button>
        </div>
      </Modal>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Nuovo formato">
        <div className="dashboard-box dashboard-form-row">
          <input
            type="text"
            placeholder="Nome (es. Normale, Grande)"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          />
          <input
            type="number"
            step="0.01"
            min="0"
            placeholder="Prezzo €"
            value={newPrezzo}
            onChange={(e) => setNewPrezzo(e.target.value)}
            style={{ width: 90 }}
          />
          <input
            type="number"
            placeholder="Ordine"
            value={newOrdine}
            onChange={(e) => setNewOrdine(e.target.value)}
            style={{ width: 80 }}
          />
          <button type="button" className="btn-primary-dashboard" onClick={handleAdd}>
            Aggiungi formato
          </button>
        </div>
      </Modal>
    </div>
  );
}
