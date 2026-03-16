import { useEffect, useState, useMemo } from "react";
import { useTenant } from "@/app/contexts/TenantContext";
import Loader from "@/components/feedback/Loader";
import ErrorState from "@/components/feedback/ErrorState";
import Modal from "@/components/dashboard/Modal";
import SearchBar from "@/components/dashboard/SearchBar";
import {
  getAllergeni,
  createAllergene,
  updateAllergene,
} from "@/features/admin/services/adminService";
import { sortByOrdine } from "@/utils/sortByOrdine";

const ALLERGENI_PREDEFINITI = [
  { nome: "Glutine", icona: "🌾" },
  { nome: "Crostacei", icona: "🦐" },
  { nome: "Uova", icona: "🥚" },
  { nome: "Pesce", icona: "🐟" },
  { nome: "Soia", icona: "🫘" },
  { nome: "Latte", icona: "🥛" },
  { nome: "Frutta a guscio", icona: "🥜" },
  { nome: "Sedano", icona: "🥬" },
  { nome: "Senape", icona: "🟡" },
  { nome: "Sesamo", icona: "⚪" },
  { nome: "Solfiti", icona: "🍷" },
  { nome: "Lupini", icona: "🫘" },
  { nome: "Molluschi", icona: "🦪" },
];

export default function AllergeniPage() {
  const { tenantId } = useTenant();
  const [allergeni, setAllergeni] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [newNome, setNewNome] = useState("");
  const [newIcona, setNewIcona] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [modalOpen, setModalOpen] = useState(false);

  async function load() {
    if (!tenantId) return;
    try {
      setLoading(true);
      const data = await getAllergeni(tenantId);
      setAllergeni(sortByOrdine(data || []));
    } catch (err) {
      console.error(err);
      setError("Errore caricamento allergeni.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [tenantId]);

  const filteredAllergeni = useMemo(() => {
    if (!searchTerm.trim()) return allergeni;
    const q = searchTerm.trim().toLowerCase();
    return allergeni.filter((a) => (a.nome || "").toLowerCase().includes(q));
  }, [allergeni, searchTerm]);

  async function handleSeed() {
    if (!tenantId) return;
    try {
      for (let i = 0; i < ALLERGENI_PREDEFINITI.length; i++) {
        const { nome, icona } = ALLERGENI_PREDEFINITI[i];
        await createAllergene({
          tenant_id: tenantId,
          nome,
          icona,
          ordine: i + 1,
          attivo: true,
        });
      }
      load();
    } catch (err) {
      console.error(err);
      alert("Errore inserimento allergeni.");
    }
  }

  async function handleAdd() {
    if (!newNome.trim()) return;
    try {
      await createAllergene({
        tenant_id: tenantId,
        nome: newNome.trim(),
        icona: newIcona.trim() || "⚠️",
        ordine: allergeni.length + 1,
        attivo: true,
      });
      setNewNome("");
      setNewIcona("");
      setModalOpen(false);
      load();
    } catch (err) {
      console.error(err);
      alert("Errore creazione allergene.");
    }
  }

  async function handleToggle(allergene) {
    try {
      await updateAllergene(allergene.id, { attivo: !allergene.attivo });
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
        <h1 className="dashboard-page-title">Allergeni</h1>
        <SearchBar value={searchTerm} onChange={setSearchTerm} placeholder="Cerca allergeni..." />
        <button type="button" className="btn-primary-dashboard" onClick={() => setModalOpen(true)}>
          Inserisci
        </button>
      </div>
      <p className="dashboard-menu-intro">
        Lista allergeni con icona. Inserisci quelli predefiniti o aggiungine di nuovi. Interruttore per attivare/disattivare.
      </p>

      {allergeni.length === 0 && (
        <div className="dashboard-box">
          <p className="dashboard-empty" style={{ marginBottom: 12 }}>
            Nessun allergene. Clicca per inserire la lista predefinita (14 allergeni con icone).
          </p>
          <button type="button" className="btn-primary-dashboard" onClick={handleSeed}>
            Inserisci allergeni predefiniti
          </button>
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Nuovo allergene">
        <div className="dashboard-box dashboard-form-row">
          <input
            type="text"
            placeholder="Nome allergene"
            value={newNome}
            onChange={(e) => setNewNome(e.target.value)}
          />
          <input
            type="text"
            placeholder="Icona (emoji es. 🌾)"
            value={newIcona}
            onChange={(e) => setNewIcona(e.target.value)}
            style={{ width: 100 }}
          />
          <button type="button" className="btn-primary-dashboard" onClick={handleAdd}>
            Aggiungi allergene
          </button>
        </div>
      </Modal>

      <ul className="dashboard-list dashboard-list-allergeni">
        {filteredAllergeni.map((a) => (
          <li key={a.id} className="dashboard-list-item">
            <span className="dashboard-allergene-icon" title={a.nome}>
              {a.icona || "⚠️"}
            </span>
            <span className="dashboard-list-item-name">{a.nome}</span>
            <button
              type="button"
              className={a.attivo !== false ? "dashboard-btn-active" : "dashboard-btn-inactive"}
              onClick={() => handleToggle(a)}
            >
              {a.attivo !== false ? "Attivo" : "Disattivo"}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
