import { useCallback, useEffect, useMemo, useState } from "react";
import { useTenant } from "@/app/contexts/TenantContext";
import Loader from "@/components/feedback/Loader";
import ErrorState from "@/components/feedback/ErrorState";
import Modal from "@/components/dashboard/Modal";
import SearchBar from "@/components/dashboard/SearchBar";
import {
  getCategories,
  getProductsByCategoryId,
  getProducts,
  getFormati,
  getIngredients,
  getConfigurazioneCosti,
  getProductIngredienti,
  getProductIngredientiMap,
  getAllergeni,
  getIngredienteAllergeniMap,
  createProduct,
  updateProduct,
  toggleProductActive,
  setProdottoIngredienti,
} from "@/features/admin/services/adminService";
import { formatPrice, parsePrice } from "@/utils/format";
import { sortByOrdine } from "@/utils/sortByOrdine";
import { productMatchesMenuSearch } from "@/utils/menuProductSearch";

export default function PizzePage() {
  const { tenantId } = useTenant();
  const [categories, setCategories] = useState([]);
  const [pizze, setPizze] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editPizza, setEditPizza] = useState(null);
  const [pizzeIngredienti, setPizzeIngredienti] = useState({});

  // Dati per modale nuova pizza
  const [newName, setNewName] = useState("");
  const [newCategoryId, setNewCategoryId] = useState("");
  const [newFormatoId, setNewFormatoId] = useState("");
  const [formati, setFormati] = useState([]);
  const [allIngredients, setAllIngredients] = useState([]);
  const [selectedIngredients, setSelectedIngredients] = useState([]);
  const [selectedVariants, setSelectedVariants] = useState({});
  const [ingredientSearch, setIngredientSearch] = useState("");
  const [configCosti, setConfigCosti] = useState(null);
  const [modalDataLoading, setModalDataLoading] = useState(false);
  const [allergeni, setAllergeni] = useState([]);
  const [allergeniMap, setAllergeniMap] = useState({});
  const [customizingIngredient, setCustomizingIngredient] = useState(null);
  const [selectedPosizioneCottura, setSelectedPosizioneCottura] = useState({});

  // Modifica
  const [editName, setEditName] = useState("");
  const [editCategoryId, setEditCategoryId] = useState("");
  const [editFormatoId, setEditFormatoId] = useState("");
  const [editSelectedIngredients, setEditSelectedIngredients] = useState([]);
  const [editSelectedVariants, setEditSelectedVariants] = useState({});
  const [editIngredientSearch, setEditIngredientSearch] = useState("");
  const [editCustomizingIngredient, setEditCustomizingIngredient] = useState(null);
  const [editSelectedPosizioneCottura, setEditSelectedPosizioneCottura] = useState({});

  const loadCategories = useCallback(async () => {
    if (!tenantId) return [];
    try {
      const data = await getCategories(tenantId);
      return data || [];
    } catch {
      return [];
    }
  }, [tenantId]);

  const loadPizze = useCallback(async () => {
    if (!tenantId) return;
    try {
      setLoading(true);
      const cats = await loadCategories();
      setCategories(sortByOrdine(cats || []));
      const excludeSlugs = new Set(["fritti", "dolci", "bibite"]);
      const allowedCategoryIds = new Set(
        (cats || []).filter((c) => !excludeSlugs.has((c.slug || "").toLowerCase())).map((c) => c.id)
      );
      const pizzeCat = cats.find((c) => c.nome?.toLowerCase().includes("pizz") || c.slug === "pizze");
      const catId = selectedCategoryId ?? pizzeCat?.id;
      let data;
      if (catId) {
        data = await getProductsByCategoryId(tenantId, catId);
      } else {
        data = await getProducts(tenantId);
      }
      const onlyPizze = (data || []).filter((p) => {
        const cid = p.categoria_id ?? p.categoriaId;
        return !cid || allowedCategoryIds.has(cid);
      });
      setPizze(sortByOrdine(onlyPizze));
      const ids = onlyPizze.map((p) => p.id).filter(Boolean);
      if (ids.length > 0) {
        try {
          const map = await getProductIngredientiMap(tenantId, ids);
          setPizzeIngredienti(map);
        } catch (e) {
          console.warn("Caricamento descrizione ingredienti pizze:", e);
          setPizzeIngredienti({});
        }
      } else {
        setPizzeIngredienti({});
      }
    } catch (err) {
      console.error(err);
      setError("Errore caricamento pizze.");
    } finally {
      setLoading(false);
    }
  }, [tenantId, selectedCategoryId, loadCategories]);

  useEffect(() => {
    void loadPizze();
  }, [loadPizze]);

  const filteredPizze = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return pizze;
    return pizze.filter((p) => productMatchesMenuSearch(p, q, pizzeIngredienti[p.id]));
  }, [pizze, searchTerm, pizzeIngredienti]);

  /** Categorie da mostrare per le pizze: escluse Fritti, Bibite, Dolci */
  const categoriesForPizza = useMemo(() => {
    const exclude = new Set(["fritti", "bibite", "dolci"]);
    return categories.filter((c) => !exclude.has((c.slug || "").toLowerCase()));
  }, [categories]);

  const loadModalData = useCallback(async () => {
    if (!tenantId) return;
    setModalDataLoading(true);
    try {
      const [cats, fmt, ings, config, allergeniList, allergeniMapData] = await Promise.all([
        getCategories(tenantId),
        getFormati(tenantId),
        getIngredients(tenantId),
        getConfigurazioneCosti(tenantId),
        getAllergeni(tenantId),
        getIngredienteAllergeniMap(tenantId),
      ]);
      setFormati(sortByOrdine(fmt || []).filter((f) => f.attivo !== false));
      setAllIngredients(sortByOrdine(ings || []).filter((i) => i.attivo !== false));
      setConfigCosti(config);
      setAllergeni(allergeniList || []);
      setAllergeniMap(allergeniMapData || {});
      const sortedCats = sortByOrdine(cats || []);
      setCategories(sortedCats);
      const pizzeCat = sortedCats.find((c) => c.nome?.toLowerCase().includes("pizz") || c.slug === "pizze");
      if (!newCategoryId && pizzeCat) setNewCategoryId(pizzeCat.id);
    } catch (err) {
      console.error(err);
    } finally {
      setModalDataLoading(false);
    }
  }, [tenantId, newCategoryId]);

  useEffect(() => {
    if (modalOpen) void loadModalData();
  }, [modalOpen, loadModalData]);

  const VARIANTS = [
    { id: "normale", label: "Normale" },
    { id: "abbondante", label: "Abbondante" },
    { id: "senza", label: "Senza" },
    { id: "poco", label: "Poco" },
  ];

  const POSIZIONI_COTTURA = [
    { id: "in_cottura", label: "In cottura" },
    { id: "fuori_cottura", label: "Fuori cottura" },
    { id: "a_parte", label: "A parte" },
  ];

  function labelPosizioneCottura(posId) {
    return POSIZIONI_COTTURA.find((p) => p.id === posId)?.label ?? "In cottura";
  }

  function getIngredientLinePrice(ing, variant) {
    const base = parsePrice(ing.costo) || parsePrice(ing.costoUnitario) || parsePrice(ing.costo_unitario) || 0;
    if (variant === "abbondante") return base + (parsePrice(ing.costoAbbondante) || parsePrice(ing.costo_abbondante) || 0);
    if (variant === "senza") return base + (parsePrice(ing.costoSenza) || parsePrice(ing.costo_senza) || 0);
    if (variant === "poco") return base + (parsePrice(ing.costoPoco) || parsePrice(ing.costo_poco) || 0);
    return base;
  }

  const costoBase = Number(configCosti?.costo_impasto ?? configCosti?.costoImpasto) || 0;
  const formatoSelected = formati.find((f) => f.id === newFormatoId);
  const formatoPrezzo = Number(formatoSelected?.prezzo) || 0;
  const ingredientiTotal = selectedIngredients.reduce(
    (sum, ing) => sum + getIngredientLinePrice(ing, selectedVariants[ing.id] || "normale"),
    0
  );
  const prezzoCalcolato = costoBase + formatoPrezzo + ingredientiTotal;

  const availableIngredients = useMemo(() => {
    const selectedIds = new Set(selectedIngredients.map((i) => i.id));
    const q = ingredientSearch.trim().toLowerCase();
    return allIngredients
      .filter((ing) => !selectedIds.has(ing.id) && (!q || (ing.nome || "").toLowerCase().includes(q)))
      .sort((a, b) => (a.nome || "").localeCompare(b.nome || ""));
  }, [allIngredients, selectedIngredients, ingredientSearch]);

  function addIngredient(ing) {
    setSelectedIngredients((prev) => [...prev, ing]);
    setSelectedVariants((prev) => ({ ...prev, [ing.id]: "normale" }));
    setSelectedPosizioneCottura((prev) => ({ ...prev, [ing.id]: "in_cottura" }));
    setIngredientSearch("");
  }

  function removeIngredient(id) {
    setSelectedIngredients((prev) => prev.filter((i) => i.id !== id));
    setSelectedVariants((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setSelectedPosizioneCottura((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  function addEditIngredient(ing) {
    setEditSelectedIngredients((prev) => [...prev, ing]);
    setEditSelectedVariants((prev) => ({ ...prev, [ing.id]: "normale" }));
    setEditSelectedPosizioneCottura((prev) => ({ ...prev, [ing.id]: "in_cottura" }));
    setEditIngredientSearch("");
  }

  function removeEditIngredient(id) {
    setEditSelectedIngredients((prev) => prev.filter((i) => i.id !== id));
    setEditSelectedVariants((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setEditSelectedPosizioneCottura((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  function openAddModal() {
    setNewName("");
    setNewCategoryId(categories.find((c) => c.slug === "pizze" || c.nome?.toLowerCase().includes("pizz"))?.id || "");
    setNewFormatoId(formati[0]?.id || "");
    setSelectedIngredients([]);
    setSelectedVariants({});
    setSelectedPosizioneCottura({});
    setIngredientSearch("");
    setCustomizingIngredient(null);
    setModalOpen(true);
  }

  async function handleAdd() {
    if (!newName.trim()) return;
    const catId = newCategoryId || categories.find((c) => c.slug === "pizze")?.id;
    try {
      const product = await createProduct({
        tenantId,
        categoriaId: catId || undefined,
        nome: newName.trim(),
        prezzo: prezzoCalcolato,
        attivo: true,
      });
      if (product?.id && selectedIngredients.length > 0) {
        try {
          await setProdottoIngredienti(
            tenantId,
            product.id,
            selectedIngredients.map((i) => ({
              ingrediente_id: i.id,
              posizione_cottura: selectedPosizioneCottura[i.id] || "in_cottura",
            })),
          );
        } catch (e) {
          console.warn("Ingredienti non salvati:", e);
        }
      }
      setModalOpen(false);
      loadPizze();
    } catch (err) {
      console.error(err);
      alert("Errore creazione pizza.");
    }
  }

  async function handleToggle(id, current) {
    try {
      await toggleProductActive(id, !current);
      loadPizze();
    } catch (err) {
      console.error(err);
      alert("Errore aggiornamento.");
    }
  }

  async function openEdit(p) {
    setEditPizza(p);
    setEditName(p.nome ?? "");
    setEditCategoryId(p.categoria_id || p.categoriaId || "");
    setEditFormatoId("");
    setEditIngredientSearch("");
    setEditCustomizingIngredient(null);
    if (!tenantId || !p?.id) return;
    try {
      await loadModalData();
      const ingList = await getProductIngredienti(tenantId, p.id);
      const ids = ingList.map((i) => i.id);
      const full = await getIngredients(tenantId);
      const map = new Map((full || []).map((i) => [i.id, i]));
      const ings = ids.map((id) => map.get(id)).filter(Boolean);
      setEditSelectedIngredients(ings);
      setEditSelectedVariants(ings.reduce((acc, ing) => ({ ...acc, [ing.id]: "normale" }), {}));
      setEditSelectedPosizioneCottura(
        ingList.reduce((acc, row) => {
          const id = row.id;
          if (!id) return acc;
          acc[id] = row.posizione_cottura || "in_cottura";
          return acc;
        }, {}),
      );
    } catch (err) {
      console.error("Errore caricamento ingredienti pizza:", err);
      setEditSelectedIngredients([]);
      setEditSelectedVariants({});
      setEditSelectedPosizioneCottura({});
    }
  }

  const editCostoBase = costoBase;
  const editFormatoSel = formati.find((f) => f.id === editFormatoId);
  const editFormatoPrezzo = Number(editFormatoSel?.prezzo) || 0;
  const editIngredientiTotal = editSelectedIngredients.reduce(
    (sum, ing) => sum + getIngredientLinePrice(ing, editSelectedVariants[ing.id] || "normale"),
    0
  );
  const editPrezzoCalcolato = editCostoBase + editFormatoPrezzo + editIngredientiTotal;

  const editAvailableIngredients = useMemo(() => {
    const selectedIds = new Set(editSelectedIngredients.map((i) => i.id));
    const q = editIngredientSearch.trim().toLowerCase();
    return allIngredients
      .filter((ing) => !selectedIds.has(ing.id) && (!q || (ing.nome || "").toLowerCase().includes(q)))
      .sort((a, b) => (a.nome || "").localeCompare(b.nome || ""));
  }, [allIngredients, editSelectedIngredients, editIngredientSearch]);

  function getAllergeniIcons(ingredienteId) {
    const ids = allergeniMap[ingredienteId] || [];
    return ids
      .map((id) => allergeni.find((a) => a.id === id))
      .filter((a) => a && (a.icona || a.nome));
  }

  async function handleSaveEdit() {
    if (!editPizza) return;
    try {
      // Salva prima gli ingredienti: se fallisce non chiudere il modale
      try {
        await setProdottoIngredienti(
          tenantId,
          editPizza.id,
          editSelectedIngredients.map((i) => ({
            ingrediente_id: i.id,
            posizione_cottura: editSelectedPosizioneCottura[i.id] || "in_cottura",
          })),
        );
      } catch (e) {
        console.error("Ingredienti non aggiornati:", e);
        const msg = e?.message || "";
        const hint = msg.includes("42501") || msg.includes("permission denied")
          ? " Esegui in Supabase SQL Editor: GRANT SELECT, INSERT, DELETE ON public.prodotto_ingrediente TO authenticated;"
          : "";
        alert("Impossibile salvare gli ingredienti." + hint);
        return;
      }
      await updateProduct(editPizza.id, {
        nome: editName.trim(),
        prezzo: editPrezzoCalcolato,
        categoria_id: editCategoryId || undefined,
      });
      setEditPizza(null);
      loadPizze();
    } catch (err) {
      console.error(err);
      alert("Errore aggiornamento pizza.");
    }
  }

  if (loading && pizze.length === 0) return <Loader />;
  if (error) return <ErrorState message={error} />;

  return (
    <div className="dashboard-menu-area">
      <div className="dashboard-title-row">
        <h1 className="dashboard-page-title">Pizze</h1>
        <SearchBar value={searchTerm} onChange={setSearchTerm} placeholder="Cerca pizze..." />
        <button type="button" className="btn-primary-dashboard" onClick={openAddModal}>
          Inserisci
        </button>
      </div>
      <p className="dashboard-menu-intro">
        Nome, categoria, formato e ingredienti. Il prezzo si calcola in automatico: <strong>costo base</strong> (Impasti) + <strong>formato</strong> + <strong>ingredienti</strong>.
      </p>

      {categoriesForPizza.length > 0 && (
        <div className="dashboard-box dashboard-form-row">
          <label>
            Categoria:
            <select
              value={selectedCategoryId ?? ""}
              onChange={(e) => setSelectedCategoryId(e.target.value || null)}
            >
              <option value="">Tutte</option>
              {categoriesForPizza.map((c) => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </select>
          </label>
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Nuova pizza" wide tall>
        <div className="pizza-modal-shell">
          {modalDataLoading ? (
            <p>Caricamento...</p>
          ) : (
            <>
              <div className="pizza-modal-fields-grid">
                <div>
                  <label htmlFor="pizza-new-name">Nome pizza</label>
                  <input
                    id="pizza-new-name"
                    type="text"
                    placeholder="Es. Margherita"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                  />
                </div>
                <div>
                  <label htmlFor="pizza-new-cat">Categoria</label>
                  <select
                    id="pizza-new-cat"
                    value={newCategoryId}
                    onChange={(e) => setNewCategoryId(e.target.value)}
                  >
                    <option value="">Seleziona categoria</option>
                    {categoriesForPizza.map((c) => (
                      <option key={c.id} value={c.id}>{c.nome}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="pizza-new-fmt">Formato</label>
                  <select
                    id="pizza-new-fmt"
                    value={newFormatoId}
                    onChange={(e) => setNewFormatoId(e.target.value)}
                  >
                    <option value="">Nessun formato</option>
                    {formati.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.nome} {f.prezzo != null && Number(f.prezzo) !== 0 ? `(+ € ${formatPrice(f.prezzo)})` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <p className="pizza-modal-ingredients-heading">Ingredienti</p>
              <div className="pizza-modal-ingredients">
                <div className="pizza-modal-ing-col">
                  <div className="pizza-modal-ing-col-title">Disponibili</div>
                  <input
                    type="text"
                    className="pizza-modal-ing-search"
                    placeholder="Cerca ingrediente..."
                    value={ingredientSearch}
                    onChange={(e) => setIngredientSearch(e.target.value)}
                    aria-label="Cerca tra gli ingredienti disponibili"
                  />
                  <ul className="pizza-modal-ing-list">
                    {availableIngredients.map((ing) => (
                      <li key={ing.id} onClick={() => addIngredient(ing)} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); addIngredient(ing); } }}>
                        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          {ing.nome}
                          {getAllergeniIcons(ing.id).map((a) => (
                            <span key={a.id} title={a.nome || ""} style={{ fontSize: "0.95em" }}>{a.icona || "⚠️"}</span>
                          ))}
                        </span>
                        <span>€ {formatPrice(ing.costo ?? ing.costoUnitario ?? ing.costo_unitario)}</span>
                      </li>
                    ))}
                    {availableIngredients.length === 0 && (
                      <li style={{ padding: 8, color: "#666", cursor: "default" }}>Nessun ingrediente o tutti già aggiunti</li>
                    )}
                  </ul>
                </div>
                <div className="pizza-modal-ing-col">
                  <div className="pizza-modal-ing-col-title">In pizza (clicca per personalizzare)</div>
                  <ul className="pizza-modal-ing-list">
                    {selectedIngredients.map((ing) => {
                      const variant = selectedVariants[ing.id] || "normale";
                      const linePrice = getIngredientLinePrice(ing, variant);
                      const pos = selectedPosizioneCottura[ing.id] || "in_cottura";
                      const posExtra = pos !== "in_cottura" ? ` · ${labelPosizioneCottura(pos)}` : "";
                      return (
                        <li
                          key={ing.id}
                          className="pizza-modal-ing-list__in-pizza"
                          style={{ display: "flex", alignItems: "center", gap: 8 }}
                        >
                          <span
                            style={{ flex: 1, display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}
                            onClick={() => setCustomizingIngredient(ing)}
                            title="Clicca per personalizzare variante prezzo e posizione in cottura"
                          >
                            {ing.nome}
                            {getAllergeniIcons(ing.id).map((a) => (
                              <span key={a.id} title={a.nome || ""} style={{ fontSize: "0.95em" }}>{a.icona || "⚠️"}</span>
                            ))}
                            <span style={{ fontSize: 11, color: "#666" }}>
                              ({VARIANTS.find((v) => v.id === variant)?.label ?? variant}
                              {posExtra})
                            </span>
                          </span>
                          <span>€ {formatPrice(linePrice)}</span>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); removeIngredient(ing.id); }}
                            title="Rimuovi ingrediente"
                            style={{
                              background: "#c62828",
                              color: "white",
                              border: "none",
                              cursor: "pointer",
                              padding: "4px 8px",
                              borderRadius: 4,
                              fontSize: 14,
                              flexShrink: 0,
                            }}
                            aria-label="Rimuovi"
                          >
                            🗑
                          </button>
                        </li>
                      );
                    })}
                    {selectedIngredients.length === 0 && (
                      <li style={{ padding: 8, color: "#666", cursor: "default" }}>Aggiungi ingredienti da sinistra</li>
                    )}
                  </ul>
                </div>
              </div>
              <Modal open={!!customizingIngredient} onClose={() => setCustomizingIngredient(null)} title={customizingIngredient ? `Personalizza: ${customizingIngredient.nome}` : "Personalizza"}>
                {customizingIngredient && (
                  <div style={{ padding: 12 }}>
                    <p style={{ marginBottom: 8, fontSize: 14, fontWeight: 600 }}>Posizione rispetto alla cottura</p>
                    <p style={{ marginBottom: 8, fontSize: 13, color: "#555" }}>
                      Indica se l&apos;ingrediente va in forno, dopo cottura o servito a parte.
                    </p>
                    {POSIZIONI_COTTURA.map((p) => {
                      const isSel = (selectedPosizioneCottura[customizingIngredient.id] || "in_cottura") === p.id;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() =>
                            setSelectedPosizioneCottura((prev) => ({
                              ...prev,
                              [customizingIngredient.id]: p.id,
                            }))
                          }
                          style={{
                            display: "block",
                            width: "100%",
                            marginBottom: 8,
                            padding: "10px 12px",
                            textAlign: "left",
                            background: isSel ? "#e8f5e9" : "#f5f5f5",
                            border: `2px solid ${isSel ? "#2e7d32" : "#ddd"}`,
                            borderRadius: 8,
                            cursor: "pointer",
                            fontWeight: isSel ? 600 : 400,
                          }}
                        >
                          {p.label}
                        </button>
                      );
                    })}
                    <p style={{ margin: "16px 0 12px", fontSize: 14 }}>Scegli la variante (influenza il prezzo):</p>
                    {VARIANTS.map((v) => {
                      const price = getIngredientLinePrice(customizingIngredient, v.id);
                      const isSelected = (selectedVariants[customizingIngredient.id] || "normale") === v.id;
                      return (
                        <button
                          key={v.id}
                          type="button"
                          onClick={() => {
                            setSelectedVariants((prev) => ({ ...prev, [customizingIngredient.id]: v.id }));
                            setCustomizingIngredient(null);
                          }}
                          style={{
                            display: "block",
                            width: "100%",
                            marginBottom: 8,
                            padding: "10px 12px",
                            textAlign: "left",
                            background: isSelected ? "#e3f2fd" : "#f5f5f5",
                            border: `2px solid ${isSelected ? "#1976d2" : "#ddd"}`,
                            borderRadius: 8,
                            cursor: "pointer",
                            fontWeight: isSelected ? 600 : 400,
                          }}
                        >
                          {v.label} — € {formatPrice(price)}
                        </button>
                      );
                    })}
                    <button type="button" className="btn-primary-dashboard" style={{ marginTop: 12 }} onClick={() => setCustomizingIngredient(null)}>
                      Chiudi
                    </button>
                  </div>
                )}
              </Modal>
              <div className="pizza-modal-footer">
                <p className="pizza-modal-price">
                  Prezzo calcolato: € {formatPrice(prezzoCalcolato)}
                  <span style={{ fontSize: 12, fontWeight: 400, marginLeft: 8 }}>
                    (base € {formatPrice(costoBase)} + formato € {formatPrice(formatoPrezzo)} + ingredienti € {formatPrice(ingredientiTotal)})
                  </span>
                </p>
                <button type="button" className="btn-primary-dashboard" onClick={handleAdd}>
                  Aggiungi pizza
                </button>
              </div>
            </>
          )}
        </div>
      </Modal>

      <Modal open={!!editPizza} onClose={() => setEditPizza(null)} title="Modifica pizza" wide tall>
        <div className="pizza-modal-shell">
          {modalDataLoading && formati.length === 0 ? (
            <p>Caricamento...</p>
          ) : (
            <>
              <div className="pizza-modal-fields-grid">
                <div>
                  <label htmlFor="pizza-edit-name">Nome pizza</label>
                  <input
                    id="pizza-edit-name"
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                  />
                </div>
                <div>
                  <label htmlFor="pizza-edit-cat">Categoria</label>
                  <select
                    id="pizza-edit-cat"
                    value={editCategoryId}
                    onChange={(e) => setEditCategoryId(e.target.value)}
                  >
                    <option value="">Seleziona categoria</option>
                    {categoriesForPizza.map((c) => (
                      <option key={c.id} value={c.id}>{c.nome}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="pizza-edit-fmt">Formato</label>
                  <select
                    id="pizza-edit-fmt"
                    value={editFormatoId}
                    onChange={(e) => setEditFormatoId(e.target.value)}
                  >
                    <option value="">Nessun formato</option>
                    {formati.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.nome} {f.prezzo != null && Number(f.prezzo) !== 0 ? `(+ € ${formatPrice(f.prezzo)})` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <p className="pizza-modal-ingredients-heading">Ingredienti</p>
              <div className="pizza-modal-ingredients">
                <div className="pizza-modal-ing-col">
                  <div className="pizza-modal-ing-col-title">Disponibili</div>
                  <input
                    type="text"
                    className="pizza-modal-ing-search"
                    placeholder="Cerca ingrediente..."
                    value={editIngredientSearch}
                    onChange={(e) => setEditIngredientSearch(e.target.value)}
                    aria-label="Cerca tra gli ingredienti disponibili"
                  />
                  <ul className="pizza-modal-ing-list">
                    {editAvailableIngredients.map((ing) => (
                      <li key={ing.id} onClick={() => addEditIngredient(ing)} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); addEditIngredient(ing); } }}>
                        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          {ing.nome}
                          {getAllergeniIcons(ing.id).map((a) => (
                            <span key={a.id} title={a.nome || ""} style={{ fontSize: "0.95em" }}>{a.icona || "⚠️"}</span>
                          ))}
                        </span>
                        <span>€ {formatPrice(ing.costo ?? ing.costoUnitario ?? ing.costo_unitario)}</span>
                      </li>
                    ))}
                    {editAvailableIngredients.length === 0 && (
                      <li style={{ padding: 8, color: "#666", cursor: "default" }}>Nessun ingrediente o tutti già aggiunti</li>
                    )}
                  </ul>
                </div>
                <div className="pizza-modal-ing-col">
                  <div className="pizza-modal-ing-col-title">In pizza (clicca per personalizzare)</div>
                  <ul className="pizza-modal-ing-list">
                    {editSelectedIngredients.map((ing) => {
                      const variant = editSelectedVariants[ing.id] || "normale";
                      const linePrice = getIngredientLinePrice(ing, variant);
                      const pos = editSelectedPosizioneCottura[ing.id] || "in_cottura";
                      const posExtra = pos !== "in_cottura" ? ` · ${labelPosizioneCottura(pos)}` : "";
                      return (
                        <li
                          key={ing.id}
                          className="pizza-modal-ing-list__in-pizza"
                          style={{ display: "flex", alignItems: "center", gap: 8 }}
                        >
                          <span
                            style={{ flex: 1, display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}
                            onClick={() => setEditCustomizingIngredient(ing)}
                            title="Clicca per personalizzare variante prezzo e posizione in cottura"
                          >
                            {ing.nome}
                            {getAllergeniIcons(ing.id).map((a) => (
                              <span key={a.id} title={a.nome || ""} style={{ fontSize: "0.95em" }}>{a.icona || "⚠️"}</span>
                            ))}
                            <span style={{ fontSize: 11, color: "#666" }}>
                              ({VARIANTS.find((v) => v.id === variant)?.label ?? variant}
                              {posExtra})
                            </span>
                          </span>
                          <span>€ {formatPrice(linePrice)}</span>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); removeEditIngredient(ing.id); }}
                            title="Rimuovi ingrediente"
                            style={{
                              background: "#c62828",
                              color: "white",
                              border: "none",
                              cursor: "pointer",
                              padding: "4px 8px",
                              borderRadius: 4,
                              fontSize: 14,
                              flexShrink: 0,
                            }}
                            aria-label="Rimuovi"
                          >
                            🗑
                          </button>
                        </li>
                      );
                    })}
                    {editSelectedIngredients.length === 0 && (
                      <li style={{ padding: 8, color: "#666", cursor: "default" }}>Aggiungi ingredienti da sinistra</li>
                    )}
                  </ul>
                </div>
              </div>
              <Modal open={!!editCustomizingIngredient} onClose={() => setEditCustomizingIngredient(null)} title={editCustomizingIngredient ? `Personalizza: ${editCustomizingIngredient.nome}` : "Personalizza"}>
                {editCustomizingIngredient && (
                  <div style={{ padding: 12 }}>
                    <p style={{ marginBottom: 8, fontSize: 14, fontWeight: 600 }}>Posizione rispetto alla cottura</p>
                    <p style={{ marginBottom: 8, fontSize: 13, color: "#555" }}>
                      Indica se l&apos;ingrediente va in forno, dopo cottura o servito a parte.
                    </p>
                    {POSIZIONI_COTTURA.map((p) => {
                      const isSel = (editSelectedPosizioneCottura[editCustomizingIngredient.id] || "in_cottura") === p.id;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() =>
                            setEditSelectedPosizioneCottura((prev) => ({
                              ...prev,
                              [editCustomizingIngredient.id]: p.id,
                            }))
                          }
                          style={{
                            display: "block",
                            width: "100%",
                            marginBottom: 8,
                            padding: "10px 12px",
                            textAlign: "left",
                            background: isSel ? "#e8f5e9" : "#f5f5f5",
                            border: `2px solid ${isSel ? "#2e7d32" : "#ddd"}`,
                            borderRadius: 8,
                            cursor: "pointer",
                            fontWeight: isSel ? 600 : 400,
                          }}
                        >
                          {p.label}
                        </button>
                      );
                    })}
                    <p style={{ margin: "16px 0 12px", fontSize: 14 }}>Scegli la variante (influenza il prezzo):</p>
                    {VARIANTS.map((v) => {
                      const price = getIngredientLinePrice(editCustomizingIngredient, v.id);
                      const isSelected = (editSelectedVariants[editCustomizingIngredient.id] || "normale") === v.id;
                      return (
                        <button
                          key={v.id}
                          type="button"
                          onClick={() => {
                            setEditSelectedVariants((prev) => ({ ...prev, [editCustomizingIngredient.id]: v.id }));
                            setEditCustomizingIngredient(null);
                          }}
                          style={{
                            display: "block",
                            width: "100%",
                            marginBottom: 8,
                            padding: "10px 12px",
                            textAlign: "left",
                            background: isSelected ? "#e3f2fd" : "#f5f5f5",
                            border: `2px solid ${isSelected ? "#1976d2" : "#ddd"}`,
                            borderRadius: 8,
                            cursor: "pointer",
                            fontWeight: isSelected ? 600 : 400,
                          }}
                        >
                          {v.label} — € {formatPrice(price)}
                        </button>
                      );
                    })}
                    <button type="button" className="btn-primary-dashboard" style={{ marginTop: 12 }} onClick={() => setEditCustomizingIngredient(null)}>
                      Chiudi
                    </button>
                  </div>
                )}
              </Modal>
              <div className="pizza-modal-footer">
                <p className="pizza-modal-price">
                  Prezzo calcolato: € {formatPrice(editPrezzoCalcolato)}
                  <span style={{ fontSize: 12, fontWeight: 400, marginLeft: 8 }}>
                    (base € {formatPrice(editCostoBase)} + formato € {formatPrice(editFormatoPrezzo)} + ingredienti € {formatPrice(editIngredientiTotal)})
                  </span>
                </p>
                <button type="button" className="btn-primary-dashboard" onClick={handleSaveEdit}>
                  Salva modifiche
                </button>
              </div>
            </>
          )}
        </div>
      </Modal>

      <ul className="dashboard-list">
        {filteredPizze.map((p) => (
          <li key={p.id} className="dashboard-list-item">
            <div style={{ flex: 1, minWidth: 0 }}>
              <span
                className="dashboard-list-item-name"
                role="button"
                tabIndex={0}
                onClick={() => openEdit(p)}
                onKeyDown={(e) => e.key === "Enter" && openEdit(p)}
                style={{ cursor: "pointer", textDecoration: "underline" }}
                title="Clicca per modificare"
              >
                {p.nome}
              </span>
              {pizzeIngredienti[p.id]?.length > 0 && (
                <p className="dashboard-list-item-desc" style={{ margin: "4px 0 0 0", fontSize: 13, color: "#555", fontWeight: 400 }}>
                  {pizzeIngredienti[p.id].join(", ")}
                </p>
              )}
            </div>
            <span className="dashboard-list-item-meta">€ {formatPrice(p.prezzo)}</span>
            <button type="button" className="btn-primary-dashboard" onClick={() => openEdit(p)} style={{ marginRight: 8 }}>
              Modifica
            </button>
            <button
              type="button"
              className={p.attivo !== false ? "dashboard-btn-active" : "dashboard-btn-inactive"}
              onClick={() => handleToggle(p.id, p.attivo)}
            >
              {p.attivo !== false ? "Attiva" : "Disattiva"}
            </button>
          </li>
        ))}
      </ul>
      {filteredPizze.length === 0 && !loading && (
        <p className="dashboard-empty">
          {searchTerm.trim() ? "Nessuna pizza corrisponde alla ricerca." : "Nessuna pizza. Usa Inserisci per creare la prima."}
        </p>
      )}
    </div>
  );
}
