import { useEffect, useState, useMemo, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";

import { useAuth } from "@/app/contexts/AuthContext";
import HeroStore from "@/features/public/components/HeroStore";
import PublicStoreCartSidebar from "@/features/public/components/PublicStoreCartSidebar";
import Loader from "@/components/feedback/Loader";
import ErrorState from "@/components/feedback/ErrorState";
import ProductGrid from "@/features/operative/cassa/components/ProductGrid";
import CategoryTabs from "@/features/operative/cassa/components/CategoryTabs";
import ModificaPizzaModal from "@/features/operative/cassa/components/ModificaPizzaModal";

import {
  getPublicMenu,
  getPublicTenantInfo,
  getPublicMenuIngredientNames,
  getPublicCategoriesForTenant,
  mergePublicCategoriesWithCatalog,
} from "@/features/services/publicService";
import { getProductIngredientiMap } from "@/features/admin/services/adminService";
import { resolveMenuTheme } from "@/utils/tenantMenuTheme";
import { usePublicCart } from "@/app/contexts/PublicCartContext";
import { applyPromoCalendarioToProducts } from "@/utils/promozioniCalendario";
import { readOrdiniOnlineVetrinaAllowed } from "@/utils/ordiniOnlineAttivi";
import { productMatchesMenuSearch } from "@/utils/menuProductSearch";

function isTodayClosed(orariSettimana) {
  if (!Array.isArray(orariSettimana) || !orariSettimana.length) return false;
  const jsDay = new Date().getDay();
  const giornoKey = (jsDay + 6) % 7;
  const row = orariSettimana.find(
    (o) => Number(o.giorno) === giornoKey
  );
  if (!row) return false;
  return !row.aperto;
}

function pickParametriOperativi(tenant) {
  if (!tenant || typeof tenant !== "object") return null;
  const po = tenant.parametri_operativi ?? tenant.parametriOperativi;
  return po && typeof po === "object" ? po : null;
}

export default function PublicStore() {
  const { user, tipoUtente, tenantId: authTenantId } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { addItem, replaceLine } = usePublicCart();
  const [menu, setMenu] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [productToAdd, setProductToAdd] = useState(null);
  const [pizzaModalEditCartLine, setPizzaModalEditCartLine] = useState(null);
  const [pizzaModalEditKey, setPizzaModalEditKey] = useState(null);
  const [closedToday, setClosedToday] = useState(false);
  const [tenantName, setTenantName] = useState(null);
  const [branding, setBranding] = useState(null);
  const [menuTheme, setMenuTheme] = useState(null);
  const [tenantParametri, setTenantParametri] = useState(null);
  /** Riga tenant completa (piano / licenza) per gate ordini online */
  const [vetrinaTenant, setVetrinaTenant] = useState(null);
  /** Categorie da core.categorie (RPC) per tab coerenti con admin */
  const [publicCategoryCatalog, setPublicCategoryCatalog] = useState([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState(null);
  const [searchPizza, setSearchPizza] = useState("");
  /** Nomi ingredienti per prodotto (ricetta); opzionale se RLS anon non consente la lettura. */
  const [ingredientiRicercaMap, setIngredientiRicercaMap] = useState({});

  const clienteLoggato = Boolean(user) && tipoUtente === "cliente";
  const vetrinaTenantId = vetrinaTenant?.id || authTenantId || null;

  const vetrinaOrdiniOk = useMemo(
    () => readOrdiniOnlineVetrinaAllowed(tenantParametri, vetrinaTenant),
    [tenantParametri, vetrinaTenant],
  );

  const closePizzaModal = useCallback(() => {
    setProductModalOpen(false);
    setProductToAdd(null);
    setPizzaModalEditCartLine(null);
    setPizzaModalEditKey(null);
  }, []);

  const openModificaPizza = useCallback((product, editLine = null, editKey = null) => {
    if (!user) {
      const qs = new URLSearchParams(location.search || "");
      qs.set("cliente", "1");
      qs.set("return_to", `${location.pathname}${location.search || ""}`);
      navigate(`/login?${qs.toString()}`, {
        state: { from: location, pendingProductId: product?.id ?? null },
      });
      return;
    }
    setPizzaModalEditCartLine(editLine);
    setPizzaModalEditKey(editKey);
    setProductToAdd(editLine ? { ...editLine } : { ...product });
    setProductModalOpen(true);
  }, [user, navigate, location]);

  const confirmModificaPizza = useCallback(
    (modsPayload) => {
      if (!productToAdd) return;
      const summary = modsPayload?.ingredientiCotturaSummary ?? "";
      const nextKey = modsPayload
        ? JSON.stringify({
            m: modsPayload.ingredientiModifiche,
            e: modsPayload.extraIngredienti,
            i: modsPayload.impastoId ?? null,
            f: modsPayload.formatoId ?? null,
            c: modsPayload.cotturaId ?? null,
          })
        : "";
      const linePayload = {
        id: productToAdd.id,
        nome: productToAdd.nome,
        prezzo:
          modsPayload?.prezzoCalcolato != null
            ? modsPayload.prezzoCalcolato
            : productToAdd.prezzo,
        qty: pizzaModalEditCartLine ? Math.max(1, Number(pizzaModalEditCartLine.qty) || 1) : 1,
        formatoNome: modsPayload?.formatoNome,
        formatoId: modsPayload?.formatoId,
        ingredientiCotturaSummary: summary,
        ingredientiModifiche: modsPayload?.ingredientiModifiche,
        extraIngredienti: modsPayload?.extraIngredienti,
        impastoId: modsPayload?.impastoId,
        impastoNome: modsPayload?.impastoNome,
        cotturaId: modsPayload?.cotturaId,
        cotturaNome: modsPayload?.cotturaNome,
        _modsKey: nextKey,
        _lineId: pizzaModalEditCartLine?._lineId,
      };
      if (pizzaModalEditKey) {
        replaceLine(pizzaModalEditKey, linePayload);
      } else {
        addItem(linePayload);
      }
      closePizzaModal();
    },
    [productToAdd, pizzaModalEditCartLine, pizzaModalEditKey, addItem, replaceLine, closePizzaModal],
  );

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        setError(null);
        const tenant = await getPublicTenantInfo({ search: location.search });
        if (tenant) {
          setTenantName(tenant.nome || null);
          setVetrinaTenant(tenant);
          const po = pickParametriOperativi(tenant);
          setTenantParametri(po);
          if (tenant.orari_settimana) {
            setClosedToday(isTodayClosed(tenant.orari_settimana));
          }
          const ordiniVetrina = readOrdiniOnlineVetrinaAllowed(po, tenant);
          setBranding({
            nome: tenant.nome,
            logo_url: tenant.logo_url ?? null,
            indirizzo: tenant.indirizzo ?? null,
            ordinazione_attiva: ordiniVetrina,
          });
          setMenuTheme(resolveMenuTheme(po));
        } else {
          setBranding(null);
          setMenuTheme(null);
          setTenantParametri(null);
          setVetrinaTenant(null);
        }
        const menuData = await getPublicMenu({ tenantId: tenant?.id ?? null });
        setMenu(menuData || []);
        if (tenant?.id) {
          const cats = await getPublicCategoriesForTenant(tenant.id);
          setPublicCategoryCatalog(Array.isArray(cats) ? cats : []);
        } else {
          setPublicCategoryCatalog([]);
        }
        setIngredientiRicercaMap({});
        if (tenant?.id && Array.isArray(menuData) && menuData.length > 0) {
          try {
            const ids = menuData.map((p) => p.id).filter(Boolean);
            let map = await getPublicMenuIngredientNames(tenant.id, ids);
            if (map == null) {
              map = await getProductIngredientiMap(tenant.id, ids);
            }
            setIngredientiRicercaMap(map || {});
          } catch (e) {
            console.warn("Vetrina: ingredienti ricetta (ricerca):", e);
            setIngredientiRicercaMap({});
          }
        }
      } catch (err) {
        console.error(err);
        setError("Errore nel caricamento del menu.");
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [location.pathname, location.search]);

  const categories = useMemo(
    () => mergePublicCategoriesWithCatalog(menu, publicCategoryCatalog),
    [menu, publicCategoryCatalog],
  );

  const defaultCategoryId = useMemo(() => {
    if (!categories.length) return null;
    const key = (n) => (n || "").toLowerCase().trim();
    const classiche = categories.find((c) => key(c.nome) === "classiche");
    const pizzaFirst = categories.find((c) =>
      ["classiche", "speciali", "bianche", "chiuse"].includes(key(c.nome))
    );
    return (classiche || pizzaFirst || categories[0]).id;
  }, [categories]);

  const activeCategoryId = selectedCategoryId ?? defaultCategoryId;

  const showModificaCategoria = useMemo(() => {
    if (!clienteLoggato || !vetrinaOrdiniOk) return false;
    const cat = categories.find((c) => c.id === activeCategoryId);
    const nome = String(cat?.nome || "").toLowerCase().trim();
    return !["fritti", "dolci", "bibite"].includes(nome);
  }, [clienteLoggato, vetrinaOrdiniOk, categories, activeCategoryId]);

  useEffect(() => {
    if (selectedCategoryId && !categories.some((c) => c.id === selectedCategoryId)) {
      setSelectedCategoryId(null);
    }
  }, [categories, selectedCategoryId]);

  const accent = menuTheme?.accent || "#e65100";
  /** Stesso default riga menù della cassa (`CassaPage`). */
  const menuRowBackground = menuTheme?.cardBackground || "#f3f9f4";
  const pageBg = menuTheme?.background;

  const productsByCategory = useMemo(() => {
    if (!menu.length) return [];
    if (!categories.length) return [];
    if (!activeCategoryId) return [];
    const raw = menu.filter((p) => p.categoria_id === activeCategoryId);
    return applyPromoCalendarioToProducts(raw, tenantParametri, new Date());
  }, [menu, categories.length, activeCategoryId, tenantParametri]);

  const filteredProducts = useMemo(() => {
    const q = (searchPizza || "").toLowerCase().trim();
    if (!q) return productsByCategory;
    return productsByCategory.filter((p) =>
      productMatchesMenuSearch(p, q, ingredientiRicercaMap[p.id]),
    );
  }, [productsByCategory, searchPizza, ingredientiRicercaMap]);

  const handleAddProduct = useCallback(
    (product) => {
      if (!vetrinaOrdiniOk) return;
      if (!user) {
        const qs = new URLSearchParams(location.search || "");
        qs.set("cliente", "1");
        qs.set("return_to", `${location.pathname}${location.search || ""}`);
        navigate(`/login?${qs.toString()}`, {
          state: {
            from: location,
            pendingProductId: product?.id ?? null,
          },
        });
        return;
      }
      addItem(product);
    },
    [vetrinaOrdiniOk, user, navigate, location, addItem]
  );

  const ingredientiMap = useMemo(() => {
    if (!menu.length) return {};
    return menu.reduce((acc, p) => {
      const real = ingredientiRicercaMap[p.id];
      if (Array.isArray(real) && real.length) {
        acc[p.id] = real;
      } else {
        acc[p.id] = p.descrizione ? [p.descrizione] : [];
      }
      return acc;
    }, {});
  }, [menu, ingredientiRicercaMap]);

  if (loading) return <Loader />;
  if (error) return <ErrorState message={error} />;

  const menuBody = (
    <>
      {!vetrinaOrdiniOk ? (
        <div style={styles.browseOnlyBanner}>
          <strong>Menù in consultazione.</strong> Gli ordini online non sono attivi per questo locale (licenza o
          impostazioni). Puoi consultare liberamente il menù; per ordinare contatta la pizzeria.
        </div>
      ) : null}
      <div style={{ marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
        <input
          type="text"
          placeholder="Cerca pizza..."
          value={searchPizza}
          onChange={(e) => setSearchPizza(e.target.value)}
          style={{ flex: 1, padding: "10px 14px", borderRadius: 8, border: "1px solid #ddd" }}
        />
      </div>
      {categories.length > 0 ? (
        <CategoryTabs
          categories={categories}
          activeCategory={activeCategoryId}
          onSelect={setSelectedCategoryId}
          accentColor={accent}
        />
      ) : (
        <div style={styles.menuHeaderRow}>
          <span style={{ ...styles.menuTitleFallback, color: accent }}>Menù</span>
        </div>
      )}
      {vetrinaOrdiniOk && !user ? <p style={styles.loginHint}>Accedi per aggiungere al carrello.</p> : null}
      {!menu.length && (
        <p style={styles.emptyMenuHint}>
          {location.pathname.startsWith("/preview") || location.pathname.startsWith("/negozio") ? (
            <>
              Nessun piatto in vetrina per la pizzeria selezionata. Verifica in{" "}
              <strong>Admin → Menu</strong> che i prodotti siano <strong>attivi</strong> e{" "}
              <strong>visibili online</strong>. Su ambiente demo la vetrina usa il tenant con slug{" "}
              <code style={{ fontSize: 12 }}>demo</code>, oppure imposta{" "}
              <code style={{ fontSize: 12 }}>VITE_PUBLIC_DEMO_TENANT_ID</code> nel file{" "}
              <code style={{ fontSize: 12 }}>.env</code>, oppure aggiungi{" "}
              <code style={{ fontSize: 12 }}>?tenant=&lt;uuid&gt;</code> o{" "}
              <code style={{ fontSize: 12 }}>?support_tenant=&lt;uuid&gt;</code> all&apos;URL.
            </>
          ) : (
            <>Al momento non ci sono piatti disponibili online.</>
          )}
        </p>
      )}
      <ProductGrid
        products={filteredProducts}
        ingredientiMap={ingredientiMap}
        rowBackground={menuRowBackground}
        canAdd={vetrinaOrdiniOk}
        onAdd={handleAddProduct}
        onModifica={(p) => openModificaPizza(p)}
        showModifica={showModificaCategoria}
        storefront={!vetrinaOrdiniOk}
      />
    </>
  );

  return (
    <div
      className={`public-store-page${clienteLoggato ? " public-store-page--cliente" : ""}`}
      style={{
        ...styles.wrapper,
        ...(pageBg ? { background: pageBg } : {}),
      }}
    >
      <HeroStore branding={branding} menuTheme={menuTheme} ordiniOnlineVetrinaOk={vetrinaOrdiniOk} />

      {closedToday && vetrinaOrdiniOk ? (
        <div style={styles.closedBannerInfo}>
          Oggi il calendario segnala chiusura: puoi comunque <strong>ordinare online</strong> nelle fasce disponibili al checkout.
        </div>
      ) : closedToday ? (
        <div style={styles.closedBanner}>
          Oggi {tenantName ? `la pizzeria ${tenantName}` : "la pizzeria"} è <strong>chiusa</strong>. Le ordinazioni online non sono disponibili.
        </div>
      ) : null}

      {clienteLoggato ? (
        <div className="public-store-shell">
          <div id="public-menu" className="public-store-menu-col">
            {menuBody}
          </div>
          <PublicStoreCartSidebar
            canCheckout={vetrinaOrdiniOk}
            accent={accent}
            onEditPizza={(item, key) => openModificaPizza(item, item, key)}
          />
        </div>
      ) : (
        <div id="public-menu" style={styles.menuSection}>
          {menuBody}
        </div>
      )}

      <ModificaPizzaModal
        open={productModalOpen}
        onClose={closePizzaModal}
        product={productToAdd}
        tenantId={vetrinaTenantId}
        tipoOrdine="consegna"
        parametri={tenantParametri}
        onConfirm={confirmModificaPizza}
        prefillFromProduct={Boolean(pizzaModalEditCartLine)}
        publicMode
      />
    </div>
  );
}

const styles = {
  wrapper: {
    minHeight: "40vh",
  },
  closedBanner: {
    marginTop: 24,
    marginBottom: 16,
    padding: "12px 16px",
    borderRadius: 8,
    background: "#fffbeb",
    border: "1px solid #fde68a",
    color: "#92400e",
    fontSize: 14,
  },
  closedBannerInfo: {
    marginTop: 24,
    marginBottom: 16,
    padding: "12px 16px",
    borderRadius: 8,
    background: "#eff6ff",
    border: "1px solid #bfdbfe",
    color: "#1e40af",
    fontSize: 14,
    lineHeight: 1.5,
  },
  menuSection: {
    marginTop: 28,
    maxWidth: 920,
    marginLeft: "auto",
    marginRight: "auto",
  },
  menuHeaderRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginBottom: 14,
    paddingBottom: 12,
    borderBottom: "1px solid #eee",
  },
  menuTitleFallback: {
    fontSize: 18,
    fontWeight: 700,
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
  },
  loginHint: {
    fontSize: 14,
    color: "#666",
    marginBottom: 12,
  },
  emptyMenuHint: {
    fontSize: 14,
    color: "#64748b",
    marginBottom: 16,
    lineHeight: 1.55,
    padding: "12px 14px",
    background: "#f8fafc",
    borderRadius: 8,
    border: "1px solid #e2e8f0",
  },
  browseOnlyBanner: {
    marginBottom: 18,
    padding: "14px 16px",
    background: "#f1f5f9",
    border: "1px solid #cbd5e1",
    borderRadius: 10,
    fontSize: 14,
    color: "#334155",
    lineHeight: 1.55,
  },
};
