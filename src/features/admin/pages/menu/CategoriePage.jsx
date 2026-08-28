import { useCallback, useEffect, useMemo, useState } from "react";
import { useTenant } from "@/app/contexts/TenantContext";
import Loader from "@/components/feedback/Loader";
import ErrorState from "@/components/feedback/ErrorState";
import Modal from "@/components/dashboard/Modal";
import SearchBar from "@/components/dashboard/SearchBar";
import {
  getCategories,
  createCategory,
  updateCategory,
} from "@/features/admin/services/adminService";
import { seedMenuBase } from "@/features/admin/services/menuBaseSeed";

import { sortByOrdine } from "@/utils/sortByOrdine";

export default function CategoriePage() {
  const { tenantId } = useTenant();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [newName, setNewName] = useState("");
  const [newOrdine, setNewOrdine] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editCategory, setEditCategory] = useState(null);
  const [editNome, setEditNome] = useState("");
  const [editOrdine, setEditOrdine] = useState(0);
  const [editAttivo, setEditAttivo] = useState(true);
  const [seedBusy, setSeedBusy] = useState(false);

  const load = useCallback(async () => {
    if (!tenantId) return;
    try {
      setLoading(true);
      const data = await getCategories(tenantId);
      setCategories(sortByOrdine(data || []));
    } catch (err) {
      console.error(err);
      setError("Errore caricamento categorie.");
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredCategories = useMemo(() => {
    const fixedMenuSlugs = ["fritti", "bibite", "dolci"];
    const list = categories.filter((c) => !fixedMenuSlugs.includes((c.slug || "").toLowerCase()));
    if (!searchTerm.trim()) return sortByOrdine(list);
    const q = searchTerm.trim().toLowerCase();
    return sortByOrdine(list.filter((c) => (c.nome || "").toLowerCase().includes(q)));
  }, [categories, searchTerm]);

  if (loading) return <Loader />;
  if (error) return <ErrorState message={error} />;

  async function handleAdd() {
    if (!newName.trim()) return;
    const slug = newName.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    try {
      await createCategory({
        tenant_id: tenantId,
        nome: newName.trim(),
        slug: slug || "categoria",
        ordine: Number(newOrdine) || 0,
        attivo: true,
      });
      setNewName("");
      setNewOrdine(categories.length);
      setModalOpen(false);
      load();
    } catch (err) {
      console.error(err);
      alert("Errore creazione categoria.");
    }
  }

  async function handleCaricaMenuBase() {
    if (!tenantId) return;
    setSeedBusy(true);
    try {
      const esito = await seedMenuBase(tenantId);
      await load();
      if (esito.errori.length) {
        alert(
          `Menu base caricato parzialmente: ${esito.categorie} categorie, ${esito.ingredienti} ingredienti, ${esito.pizze} pizze. ` +
            `${esito.errori.length} elemento/i non creato/i (dettaglio in console).`,
        );
        console.warn("[CategoriePage] seedMenuBase con errori parziali:", esito.errori);
      } else {
        alert(`Menu base caricato: ${esito.categorie} categorie, ${esito.ingredienti} ingredienti, ${esito.pizze} pizze.`);
      }
    } catch (err) {
      console.error(err);
      alert(err?.message || "Caricamento menu base non riuscito.");
    } finally {
      setSeedBusy(false);
    }
  }

  async function handleToggle(cat) {
    try {
      await updateCategory(cat.id, { attivo: !cat.attivo });
      load();
    } catch (err) {
      console.error(err);
      alert("Errore aggiornamento.");
    }
  }

  function openEdit(cat) {
    setEditCategory(cat);
    setEditNome(cat.nome ?? "");
    setEditOrdine(cat.ordine ?? 0);
    setEditAttivo(cat.attivo !== false);
  }

  async function handleSaveEdit() {
    if (!editCategory || !editNome.trim()) return;
    try {
      await updateCategory(editCategory.id, {
        nome: editNome.trim(),
        ordine: Number(editOrdine) || 0,
        attivo: editAttivo,
      });
      setEditCategory(null);
      load();
    } catch (err) {
      console.error(err);
      alert("Errore aggiornamento categoria.");
    }
  }

  return (
    <div className="dashboard-menu-area">
      <div className="dashboard-title-row">
        <h1 className="dashboard-page-title">Categorie</h1>
        <SearchBar value={searchTerm} onChange={setSearchTerm} placeholder="Cerca categorie..." />
        <button type="button" className="btn-primary-dashboard" onClick={() => setModalOpen(true)}>
          Inserisci
        </button>
      </div>
      <p className="dashboard-menu-intro">
        Macro aree del menu (es. Pizze, Bibite, Dolci). <strong>Ordine</strong> indica la sequenza di visualizzazione: numero minore = la categoria compare prima nel menu. Puoi abilitare o disabilitare tutta l’area.
      </p>

      <Modal open={!!editCategory} onClose={() => setEditCategory(null)} title="Modifica categoria">
        <div className="dashboard-box dashboard-form-row" style={{ flexDirection: "column", gap: 12 }}>
          <input
            type="text"
            placeholder="Nome categoria"
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
              Attiva
            </label>
          </div>
          <button type="button" className="btn-primary-dashboard" onClick={handleSaveEdit}>
            Salva modifiche
          </button>
        </div>
      </Modal>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Nuova categoria">
        <div className="dashboard-box dashboard-form-row">
          <input
            type="text"
            placeholder="Nome categoria (es. Pizze)"
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
            Aggiungi categoria
          </button>
        </div>
      </Modal>

      <ul className="dashboard-list">
        {filteredCategories.map((cat) => (
          <li key={cat.id} className="dashboard-list-item">
            <span className="dashboard-list-item-name">{cat.nome}</span>
            <span className="dashboard-list-item-meta">Ordine: {cat.ordine ?? 0}</span>
            <button type="button" className="btn-primary-dashboard" onClick={() => openEdit(cat)} style={{ marginRight: 8 }}>
              Modifica
            </button>
            <button
              type="button"
              className={cat.attivo !== false ? "dashboard-btn-active" : "dashboard-btn-inactive"}
              onClick={() => handleToggle(cat)}
            >
              {cat.attivo !== false ? "Attiva" : "Disattiva"}
            </button>
          </li>
        ))}
      </ul>
      {filteredCategories.length === 0 && (
        <p className="dashboard-empty">
          {searchTerm.trim() ? "Nessuna categoria corrisponde alla ricerca." : "Nessuna categoria. Aggiungine una per iniziare."}
        </p>
      )}
      {categories.length === 0 && !searchTerm.trim() ? (
        <div className="dashboard-box" style={{ padding: 16, marginTop: 12, maxWidth: 480 }}>
          <p style={{ margin: "0 0 10px", fontSize: 13, color: "#475569", lineHeight: 1.5 }}>
            Menu completamente vuoto: invece di creare tutto a mano, puoi partire da un piccolo kit già pronto (4
            pizze classiche, ingredienti, categorie, formati) e poi modificarlo.
          </p>
          <button type="button" className="dashboard-settings-btn-secondary" onClick={handleCaricaMenuBase} disabled={seedBusy}>
            {seedBusy ? "Caricamento…" : "Carica menu base"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
