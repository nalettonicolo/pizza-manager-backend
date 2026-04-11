import { useCallback, useEffect, useMemo, useState } from "react";
import { useTenant } from "@/app/contexts/TenantContext";
import Loader from "@/components/feedback/Loader";
import ErrorState from "@/components/feedback/ErrorState";
import Modal from "@/components/dashboard/Modal";
import SearchBar from "@/components/dashboard/SearchBar";
import {
  getConfigurazioneCosti,
  upsertConfigurazioneCosti,
  getImpasti,
  createImpasto,
  updateImpasto,
  recalculateAllPizzaPrices,
} from "@/features/admin/services/adminService";
import { formatPrice } from "@/utils/format";
import { sortByOrdine } from "@/utils/sortByOrdine";

export default function ImpastiPage() {
  const { tenantId } = useTenant();
  const [impasti, setImpasti] = useState([]);
  const [config, setConfig] = useState(null);
  const [costoBase, setCostoBase] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [newNome, setNewNome] = useState("");
  const [newCostoBase, setNewCostoBase] = useState("");
  const [savingBase, setSavingBase] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [modalOpen, setModalOpen] = useState(false);

  const loadConfig = useCallback(async () => {
    if (!tenantId) return;
    const data = await getConfigurazioneCosti(tenantId);
    setConfig(data);
    if (data?.costo_impasto != null) setCostoBase(String(data.costo_impasto));
  }, [tenantId]);

  const load = useCallback(async () => {
    if (!tenantId) return;
    try {
      setLoading(true);
      setError(null);
      await loadConfig();
      const data = await getImpasti(tenantId);
      setImpasti(sortByOrdine(data || []));
    } catch (err) {
      console.error(err);
      setError("Errore caricamento impasti. Verifica che la tabella impasti esista (esegui schema_categorie_prodotti_allergeni.sql).");
    } finally {
      setLoading(false);
    }
  }, [tenantId, loadConfig]);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredImpasti = useMemo(() => {
    if (!searchTerm.trim()) return sortByOrdine(impasti);
    const q = searchTerm.trim().toLowerCase();
    return sortByOrdine(impasti.filter((imp) => (imp.nome || "").toLowerCase().includes(q)));
  }, [impasti, searchTerm]);

  async function handleSaveCostoBase() {
    if (!tenantId) return;
    const val = Number(costoBase);
    if (Number.isNaN(val) || val < 0) return;
    try {
      setSavingBase(true);
      await upsertConfigurazioneCosti(tenantId, {
        costo_impasto: val,
        costo_energia: config?.costo_energia ?? 0,
      });
      await loadConfig();
      try {
        await recalculateAllPizzaPrices(tenantId);
      } catch (e) {
        console.warn("Ricalcolo prezzi pizze:", e);
      }
    } catch (err) {
      console.error(err);
      alert("Errore salvataggio costo base. Verifica che configurazione_costi sia esposta (vista public).");
    } finally {
      setSavingBase(false);
    }
  }

  async function handleAdd() {
    if (!newNome.trim()) return;
    try {
      await createImpasto({
        tenant_id: tenantId,
        nome: newNome.trim(),
        costo_base: Number(newCostoBase) || 0,
        ordine: impasti.length,
        attivo: true,
      });
      setNewNome("");
      setNewCostoBase("");
      setModalOpen(false);
      load();
    } catch (err) {
      console.error(err);
      alert("Errore creazione impasto.");
    }
  }

  async function handleToggle(impasto) {
    try {
      await updateImpasto(impasto.id, { attivo: !impasto.attivo });
      load();
    } catch (err) {
      console.error(err);
      alert("Errore aggiornamento.");
    }
  }

  if (loading) return <Loader />;
  if (error) return <ErrorState message={error} />;

  return (
    <div className="dashboard-menu-area">
      <div className="dashboard-title-row">
        <h1 className="dashboard-page-title">Impasti</h1>
        <SearchBar value={searchTerm} onChange={setSearchTerm} placeholder="Cerca impasti..." />
        <button type="button" className="btn-primary-dashboard" onClick={() => setModalOpen(true)}>
          Inserisci
        </button>
      </div>
      <p className="dashboard-menu-intro">
        Costo base pizza (usato per il calcolo prezzo) e tipi di impasto. Attiva o disattiva ogni impasto.
      </p>

      <div className="dashboard-box dashboard-category-switch dashboard-costo-base">
        <label className="dashboard-category-switch-label">
          Costo base pizza (€)
          <input
            type="number"
            step="0.01"
            min="0"
            value={costoBase}
            onChange={(e) => setCostoBase(e.target.value)}
            onBlur={handleSaveCostoBase}
            style={{ width: 80, marginLeft: 8 }}
          />
        </label>
        <button
          type="button"
          className="btn-primary-dashboard"
          onClick={handleSaveCostoBase}
          disabled={savingBase}
        >
          {savingBase ? "Salvo..." : "Salva"}
        </button>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Nuovo impasto">
        <div className="dashboard-box dashboard-form-row">
          <input
            type="text"
            placeholder="Nome impasto (es. Normale, Integrale)"
            value={newNome}
            onChange={(e) => setNewNome(e.target.value)}
          />
          <input
            type="number"
            placeholder="Costo base €"
            value={newCostoBase}
            onChange={(e) => setNewCostoBase(e.target.value)}
            step="0.01"
            min="0"
            style={{ width: 100 }}
          />
          <button type="button" className="btn-primary-dashboard" onClick={handleAdd}>
            Aggiungi impasto
          </button>
        </div>
      </Modal>

      <ul className="dashboard-list">
        {filteredImpasti.map((imp) => (
          <li key={imp.id} className="dashboard-list-item">
            <span className="dashboard-list-item-name">{imp.nome}</span>
            <span className="dashboard-list-item-meta">€ {formatPrice(imp.costo_base)}</span>
            <button
              type="button"
              className={imp.attivo !== false ? "dashboard-btn-active" : "dashboard-btn-inactive"}
              onClick={() => handleToggle(imp)}
            >
              {imp.attivo !== false ? "Attivo" : "Disattivo"}
            </button>
          </li>
        ))}
      </ul>
      {filteredImpasti.length === 0 && (
        <p className="dashboard-empty">
          {searchTerm.trim() ? "Nessun impasto corrisponde alla ricerca." : "Nessun impasto. Usa \"Inserisci\" per aggiungere il primo."}
        </p>
      )}
    </div>
  );
}
