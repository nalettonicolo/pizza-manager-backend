import { useEffect, useState, useMemo } from "react";
import { useTenant } from "@/app/contexts/TenantContext";
import Loader from "@/components/feedback/Loader";
import ErrorState from "@/components/feedback/ErrorState";
import Modal from "@/components/dashboard/Modal";
import SearchBar from "@/components/dashboard/SearchBar";
import {
  getCategoryBySlug,
  getCategories,
  createCategory,
  updateCategory,
  getProductsByCategoryId,
  createProduct,
  updateProduct,
  toggleProductActive,
} from "@/features/admin/services/adminService";
import { formatPrice } from "@/utils/format";
import { sortByOrdine } from "@/utils/sortByOrdine";

export default function CategoryProductsPage({ slug, title }) {
  const { tenantId } = useTenant();
  const [category, setCategory] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [newName, setNewName] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [newImageUrl, setNewImageUrl] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editProduct, setEditProduct] = useState(null);
  const [editName, setEditName] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editImageUrl, setEditImageUrl] = useState("");

  async function ensureCategory() {
    if (!tenantId) return null;
    let cat = await getCategoryBySlug(tenantId, slug);
    if (!cat) {
      try {
        const nome = title;
        await createCategory({
          tenant_id: tenantId,
          nome,
          slug,
          ordine: 0,
          attivo: true,
        });
        cat = await getCategoryBySlug(tenantId, slug);
      } catch (err) {
        if (err?.code === "23505") {
          cat = await getCategoryBySlug(tenantId, slug);
        }
        if (!cat) throw err;
      }
    }
    return cat;
  }

  async function load() {
    if (!tenantId) return;
    try {
      setLoading(true);
      const cat = await ensureCategory();
      setCategory(cat);
      if (cat) {
        const data = await getProductsByCategoryId(tenantId, cat.id);
        setProducts(sortByOrdine(data || []));
      } else {
        setProducts([]);
      }
    } catch (err) {
      console.error(err);
      setError("Errore caricamento.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [tenantId, slug]);

  const filteredProducts = useMemo(() => {
    if (!searchTerm.trim()) return products;
    const q = searchTerm.trim().toLowerCase();
    return products.filter((p) => (p.nome || "").toLowerCase().includes(q));
  }, [products, searchTerm]);

  async function handleCategoryToggle() {
    if (!category) return;
    try {
      await updateCategory(category.id, { attivo: !category.attivo });
      setCategory((c) => ({ ...c, attivo: !c.attivo }));
    } catch (err) {
      console.error(err);
      alert("Errore aggiornamento categoria.");
    }
  }

  async function handleAdd() {
    if (!newName.trim() || !category) return;
    try {
      await createProduct({
        tenantId,
        categoriaId: category.id,
        nome: newName.trim(),
        prezzo: Number(newPrice) || 0,
        immagine_url: newImageUrl.trim() || null,
        attivo: true,
      });
      setNewName("");
      setNewPrice("");
      setNewImageUrl("");
      setModalOpen(false);
      load();
    } catch (err) {
      console.error(err);
      alert("Errore creazione prodotto.");
    }
  }

  async function handleProductToggle(id, current) {
    try {
      await toggleProductActive(id, !current);
      load();
    } catch (err) {
      console.error(err);
      alert("Errore aggiornamento.");
    }
  }

  function openEdit(p) {
    setEditProduct(p);
    setEditName(p.nome ?? "");
    setEditPrice(String(p.prezzo ?? ""));
    setEditImageUrl(p.immagine_url ?? p.imageUrl ?? "");
  }

  async function handleSaveEdit() {
    if (!editProduct) return;
    try {
      await updateProduct(editProduct.id, {
        nome: editName.trim(),
        prezzo: Number(editPrice) || 0,
        immagine_url: editImageUrl.trim() || null,
      });
      setEditProduct(null);
      load();
    } catch (err) {
      console.error(err);
      alert("Errore aggiornamento prodotto.");
    }
  }

  if (loading && !category) return <Loader />;
  if (error) return <ErrorState message={error} />;

  return (
    <div className="dashboard-menu-area">
      <div className="dashboard-title-row">
        <h1 className="dashboard-page-title">{title}</h1>
        <SearchBar value={searchTerm} onChange={setSearchTerm} placeholder={`Cerca ${title.toLowerCase()}...`} />
        <button type="button" className="btn-primary-dashboard" onClick={() => setModalOpen(true)} disabled={!category}>
          Inserisci
        </button>
      </div>
      <p className="dashboard-menu-intro">
        Nome, prezzo e immagine. Interruttore per attivare/disattivare la categoria o il singolo prodotto.
      </p>

      {category && (
        <div className="dashboard-box dashboard-category-switch">
          <span className="dashboard-category-switch-label">Categoria {title}</span>
          <button
            type="button"
            className={category.attivo !== false ? "dashboard-btn-active" : "dashboard-btn-inactive"}
            onClick={handleCategoryToggle}
          >
            {category.attivo !== false ? "Attiva" : "Disattiva"}
          </button>
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={`Nuovo prodotto - ${title}`}>
        <div className="dashboard-box dashboard-form-row">
          <input
            type="text"
            placeholder="Nome prodotto"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <input
            type="number"
            placeholder="Prezzo €"
            value={newPrice}
            onChange={(e) => setNewPrice(e.target.value)}
            step="0.01"
            style={{ width: 100 }}
          />
          <input
            type="text"
            placeholder="URL immagine"
            value={newImageUrl}
            onChange={(e) => setNewImageUrl(e.target.value)}
            style={{ minWidth: 180 }}
          />
          <button type="button" className="btn-primary-dashboard" onClick={handleAdd}>
            Aggiungi
          </button>
        </div>
      </Modal>

      <Modal open={!!editProduct} onClose={() => setEditProduct(null)} title={`Modifica - ${title}`}>
        <div className="dashboard-box dashboard-form-row">
          <input
            type="text"
            placeholder="Nome prodotto"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
          />
          <input
            type="number"
            placeholder="Prezzo €"
            value={editPrice}
            onChange={(e) => setEditPrice(e.target.value)}
            step="0.01"
            style={{ width: 100 }}
          />
          <input
            type="text"
            placeholder="URL immagine"
            value={editImageUrl}
            onChange={(e) => setEditImageUrl(e.target.value)}
            style={{ minWidth: 180 }}
          />
          <button type="button" className="btn-primary-dashboard" onClick={handleSaveEdit}>
            Salva modifiche
          </button>
        </div>
      </Modal>

      <ul className="dashboard-list">
        {filteredProducts.map((p) => (
          <li key={p.id} className="dashboard-list-item dashboard-list-item-with-img">
            {p.immagine_url ? (
              <img src={p.immagine_url} alt="" className="dashboard-list-item-img" />
            ) : (
              <span className="dashboard-list-item-img-placeholder">—</span>
            )}
            <span className="dashboard-list-item-name">{p.nome}</span>
            <span className="dashboard-list-item-meta">€ {formatPrice(p.prezzo)}</span>
            <button type="button" className="btn-primary-dashboard" onClick={() => openEdit(p)} style={{ marginRight: 8 }}>
              Modifica
            </button>
            <button
              type="button"
              className={p.attivo !== false ? "dashboard-btn-active" : "dashboard-btn-inactive"}
              onClick={() => handleProductToggle(p.id, p.attivo)}
            >
              {p.attivo !== false ? "Attivo" : "Disattivo"}
            </button>
          </li>
        ))}
      </ul>
      {filteredProducts.length === 0 && !loading && category && (
        <p className="dashboard-empty">
          {searchTerm.trim() ? "Nessun prodotto corrisponde alla ricerca." : "Nessun prodotto. Aggiungine uno sopra."}
        </p>
      )}
    </div>
  );
}
