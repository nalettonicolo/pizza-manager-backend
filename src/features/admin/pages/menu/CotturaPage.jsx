import { useEffect, useState, useMemo } from "react";
import { useTenant } from "@/app/contexts/TenantContext";
import Loader from "@/components/feedback/Loader";
import ErrorState from "@/components/feedback/ErrorState";
import Modal from "@/components/dashboard/Modal";
import SearchBar from "@/components/dashboard/SearchBar";
import {
  getCottura,
  createCottura,
  updateCottura,
} from "@/features/admin/services/adminService";

import { sortByOrdine } from "@/utils/sortByOrdine";

export default function CotturaPage() {
  const { tenantId } = useTenant();
  const [cottura, setCottura] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [newName, setNewName] = useState("");
  const [newOrdine, setNewOrdine] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [editNome, setEditNome] = useState("");
  const [editOrdine, setEditOrdine] = useState(0);
  const [editAttivo, setEditAttivo] = useState(true);

  async function load() {
    if (!tenantId) return;
    try {
      setLoading(true);
      setError(null);
      const data = await getCottura(tenantId);
      setCottura(sortByOrdine(data || []));
    } catch (err) {
      console.error(err);
      setError("Errore caricamento cottura. Esegui in Supabase il file server/pizzeria-backend/prisma/schema_formati_cottura.sql");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [tenantId]);

  const filteredCottura = useMemo(() => {
    if (!searchTerm.trim()) return sortByOrdine(cottura);
    const q = searchTerm.trim().toLowerCase();
    return sortByOrdine(cottura.filter((c) => (c.nome || "").toLowerCase().includes(q)));
  }, [cottura, searchTerm]);

  if (loading) return <Loader />;
  if (error) return <ErrorState message={error} />;

  async function handleAdd() {
    if (!newName.trim()) return;
    try {
      await createCottura({
        tenant_id: tenantId,
        nome: newName.trim(),
        ordine: Number(newOrdine) || 0,
        attivo: true,
      });
      setNewName("");
      setNewOrdine(cottura.length);
      setModalOpen(false);
      load();
    } catch (err) {
      console.error(err);
      alert("Errore creazione cottura.");
    }
  }

  async function handleToggle(c) {
    try {
      await updateCottura(c.id, { attivo: !c.attivo });
      load();
    } catch (err) {
      console.error(err);
      alert("Errore aggiornamento.");
    }
  }

  function openEdit(c) {
    setEditItem(c);
    setEditNome(c.nome ?? "");
    setEditOrdine(c.ordine ?? 0);
    setEditAttivo(c.attivo !== false);
  }

  async function handleSaveEdit() {
    if (!editItem || !editNome.trim()) return;
    try {
      await updateCottura(editItem.id, {
        nome: editNome.trim(),
        ordine: Number(editOrdine) || 0,
        attivo: editAttivo,
      });
      setEditItem(null);
      load();
    } catch (err) {
      console.error(err);
      alert("Errore aggiornamento cottura.");
    }
  }

  return (
    <div className="dashboard-menu-area">
      <div className="dashboard-title-row">
        <h1 className="dashboard-page-title">Cottura</h1>
        <SearchBar value={searchTerm} onChange={setSearchTerm} placeholder="Cerca cottura..." />
        <button type="button" className="btn-primary-dashboard" onClick={() => setModalOpen(true)}>
          Inserisci
        </button>
      </div>
      <p className="dashboard-menu-intro">
        Grado di cottura della pizza (es. Al forno, Ben cotta, Croccante). <strong>Ordine</strong> indica la sequenza di visualizzazione. Serviranno per la creazione delle pizze.
      </p>

      <Modal open={!!editItem} onClose={() => setEditItem(null)} title="Modifica cottura">
        <div className="dashboard-box dashboard-form-row" style={{ flexDirection: "column", gap: 12 }}>
          <input
            type="text"
            placeholder="Nome cottura"
            value={editNome}
            onChange={(e) => setEditNome(e.target.value)}
          />
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
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

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Nuova cottura">
        <div className="dashboard-box dashboard-form-row">
          <input
            type="text"
            placeholder="Nome (es. Al forno, Ben cotta)"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          />
          <input
            type="number"
            placeholder="Ordine"
            value={newOrdine}
            onChange={(e) => setNewOrdine(e.target.value)}
            style={{ width: 80 }}
          />
          <button type="button" className="btn-primary-dashboard" onClick={handleAdd}>
            Aggiungi cottura
          </button>
        </div>
      </Modal>

      <ul className="dashboard-list">
        {filteredCottura.map((c) => (
          <li key={c.id} className="dashboard-list-item">
            <span className="dashboard-list-item-name">{c.nome}</span>
            <span className="dashboard-list-item-meta">Ordine: {c.ordine ?? 0}</span>
            <button type="button" className="btn-primary-dashboard" onClick={() => openEdit(c)} style={{ marginRight: 8 }}>
              Modifica
            </button>
            <button
              type="button"
              className={c.attivo !== false ? "dashboard-btn-active" : "dashboard-btn-inactive"}
              onClick={() => handleToggle(c)}
            >
              {c.attivo !== false ? "Attiva" : "Disattiva"}
            </button>
          </li>
        ))}
      </ul>
      {filteredCottura.length === 0 && (
        <p className="dashboard-empty">
          {searchTerm.trim() ? "Nessuna cottura corrisponde alla ricerca." : "Nessuna cottura. Aggiungine una per iniziare (es. Al forno, Ben cotta)."}
        </p>
      )}
    </div>
  );
}
