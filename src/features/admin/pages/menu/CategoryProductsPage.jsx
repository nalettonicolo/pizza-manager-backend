import { useCallback, useEffect, useMemo, useState } from "react";
import { useTenant } from "@/app/contexts/TenantContext";
import Loader from "@/components/feedback/Loader";
import ErrorState from "@/components/feedback/ErrorState";
import Modal from "@/components/dashboard/Modal";
import SearchBar from "@/components/dashboard/SearchBar";
import {
  getCategoryBySlug,
  createCategory,
  updateCategory,
  getProductsByCategoryId,
  createProduct,
  updateProduct,
  toggleProductActive,
} from "@/features/admin/services/adminService";
import { formatPrice } from "@/utils/format";
import { sortByOrdine } from "@/utils/sortByOrdine";
import { INGREDIENTE_CATEGORIA_OPTIONS } from "@/constants/ingredienteCategoria";
import {
  resolvePrepTaskBackgroundColor,
  mergeCucinaPrepColorsFromParametri,
} from "@/utils/cucinaPrepCategoryTheme";

export default function CategoryProductsPage({ slug, title, showPrepCucinaCheckbox = false }) {
  const { tenantId, tenantData } = useTenant();
  const prepCategoryColors = useMemo(
    () => mergeCucinaPrepColorsFromParametri(tenantData?.parametri_operativi),
    [tenantData?.parametri_operativi],
  );
  const [category, setCategory] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [newName, setNewName] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [newImageUrl, setNewImageUrl] = useState("");
  const [newPrepCucina, setNewPrepCucina] = useState(false);
  const [newPrepCategoria, setNewPrepCategoria] = useState("");
  const [newPrepColore, setNewPrepColore] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editProduct, setEditProduct] = useState(null);
  const [editName, setEditName] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editImageUrl, setEditImageUrl] = useState("");
  const [editPrepCucina, setEditPrepCucina] = useState(false);
  const [editPrepCategoria, setEditPrepCategoria] = useState("");
  const [editPrepColore, setEditPrepColore] = useState("");

  const ensureCategory = useCallback(async () => {
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
  }, [tenantId, slug, title]);

  const load = useCallback(async () => {
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
  }, [tenantId, ensureCategory]);

  useEffect(() => {
    void load();
  }, [load]);

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
        ...(showPrepCucinaCheckbox
          ? {
              prepCucina: newPrepCucina,
              prep_categoria: newPrepCategoria || null,
              prep_colore: newPrepColore.trim() || null,
            }
          : {}),
      });
      setNewName("");
      setNewPrice("");
      setNewImageUrl("");
      setNewPrepCucina(false);
      setNewPrepCategoria("");
      setNewPrepColore("");
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
    setEditPrepCucina(p.prep_cucina === true || p.prepCucina === true);
    setEditPrepCategoria(p.prep_categoria ?? p.prepCategoria ?? "");
    setEditPrepColore(p.prep_colore ?? p.prepColore ?? "");
  }

  async function handleSaveEdit() {
    if (!editProduct) return;
    try {
      await updateProduct(editProduct.id, {
        nome: editName.trim(),
        prezzo: Number(editPrice) || 0,
        immagine_url: editImageUrl.trim() || null,
        ...(showPrepCucinaCheckbox
          ? {
              prepCucina: editPrepCucina,
              prep_categoria: editPrepCategoria || null,
              prep_colore: editPrepColore.trim() || null,
            }
          : {}),
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
        {showPrepCucinaCheckbox ? (
          <>
            {" "}
            Opzione &quot;Prep. cucina&quot;: se attiva, ogni riga ordine con quel prodotto genera un task nella schermata Cucina (stessa logica
            degli ingredienti).
          </>
        ) : null}
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
          {showPrepCucinaCheckbox ? (
            <>
              <label style={{ display: "flex", alignItems: "center", gap: 8, whiteSpace: "nowrap" }}>
                <input
                  type="checkbox"
                  checked={newPrepCucina}
                  onChange={(e) => setNewPrepCucina(e.target.checked)}
                />
                Prep. cucina (slot in Cucina)
              </label>
              <select
                value={newPrepCategoria}
                onChange={(e) => setNewPrepCategoria(e.target.value)}
                title="Categoria colore (Cucina/Bancone/Pizzaiolo) per il task «prodotto intero»"
              >
                <option value="">Comune (default)</option>
                {INGREDIENTE_CATEGORIA_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <input
                type="color"
                value={/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(newPrepColore) ? newPrepColore : "#ffffff"}
                onChange={(e) => setNewPrepColore(e.target.value)}
                title="Colore diretto (opzionale, ha precedenza sulla categoria)"
                style={{ width: 36, height: 32, padding: 0, border: "1px solid #cbd5e1", borderRadius: 6, cursor: "pointer" }}
              />
            </>
          ) : null}
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
          {showPrepCucinaCheckbox ? (
            <>
              <label style={{ display: "flex", alignItems: "center", gap: 8, whiteSpace: "nowrap" }}>
                <input
                  type="checkbox"
                  checked={editPrepCucina}
                  onChange={(e) => setEditPrepCucina(e.target.checked)}
                />
                Prep. cucina (slot in Cucina)
              </label>
              <select
                value={editPrepCategoria}
                onChange={(e) => setEditPrepCategoria(e.target.value)}
                title="Categoria colore (Cucina/Bancone/Pizzaiolo) per il task «prodotto intero»"
              >
                <option value="">Comune (default)</option>
                {INGREDIENTE_CATEGORIA_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <input
                type="color"
                value={/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(editPrepColore) ? editPrepColore : "#ffffff"}
                onChange={(e) => setEditPrepColore(e.target.value)}
                title="Colore diretto (opzionale, ha precedenza sulla categoria)"
                style={{ width: 36, height: 32, padding: 0, border: "1px solid #cbd5e1", borderRadius: 6, cursor: "pointer" }}
              />
            </>
          ) : null}
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
            <span className="dashboard-list-item-meta">
              € {formatPrice(p.prezzo)}
              {showPrepCucinaCheckbox && (p.prep_cucina === true || p.prepCucina === true) ? (
                <>
                  <span style={{ marginLeft: 8, fontSize: 11, color: "#2e7d32", fontWeight: 600 }}>· Prep cucina</span>
                  <span
                    title="Colore categoria preparazione"
                    style={{
                      display: "inline-block",
                      marginLeft: 6,
                      width: 12,
                      height: 12,
                      borderRadius: "50%",
                      border: "1px solid #cbd5e1",
                      verticalAlign: "middle",
                      background: resolvePrepTaskBackgroundColor(
                        { ingredienteCategoria: p.prep_categoria ?? p.prepCategoria, ingredienteColore: p.prep_colore ?? p.prepColore },
                        prepCategoryColors,
                      ),
                    }}
                  />
                </>
              ) : null}
            </span>
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
