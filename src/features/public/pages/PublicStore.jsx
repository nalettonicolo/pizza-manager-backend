import { useEffect, useState, useMemo, useCallback } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";

import { useAuth } from "@/app/contexts/AuthContext";
import HeroStore from "@/features/public/components/HeroStore";
import Loader from "@/components/feedback/Loader";
import ErrorState from "@/components/feedback/ErrorState";
import ProductGrid from "@/features/operative/cassa/components/ProductGrid";
import CategoryTabs from "@/features/operative/cassa/components/CategoryTabs";

import { getPublicMenu, getPublicTenantInfo } from "@/features/services/publicService";
import { getProductIngredientiMap } from "@/features/admin/services/adminService";
import { resolveMenuTheme } from "@/utils/tenantMenuTheme";
import { sortByOrdine } from "@/utils/sortByOrdine";
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

function buildCategoriesFromMenu(menu) {
  const byId = new Map();
  for (const p of menu) {
    const cid = p.categoria_id;
    if (!cid) continue;
    const ord = Number(p.ordine) || 0;
    const cur = byId.get(cid);
    if (!cur) {
      byId.set(cid, { id: cid, nome: p.categoria_nome || "Altro", ordine: ord });
    } else {
      cur.ordine = Math.min(cur.ordine, ord);
      if (p.categoria_nome) cur.nome = p.categoria_nome;
    }
  }
  return sortByOrdine([...byId.values()]);
}

export default function PublicStore() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { addItem, totalQty } = usePublicCart();
  const [menu, setMenu] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [closedToday, setClosedToday] = useState(false);
  const [tenantName, setTenantName] = useState(null);
  const [branding, setBranding] = useState(null);
  const [menuTheme, setMenuTheme] = useState(null);
  const [tenantParametri, setTenantParametri] = useState(null);
  /** Riga tenant completa (piano / licenza) per gate ordini online */
  const [vetrinaTenant, setVetrinaTenant] = useState(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState(null);
  const [searchPizza, setSearchPizza] = useState("");
  /** Nomi ingredienti per prodotto (ricetta); opzionale se RLS anon non consente la lettura. */
  const [ingredientiRicercaMap, setIngredientiRicercaMap] = useState({});

  const vetrinaOrdiniOk = useMemo(
    () => readOrdiniOnlineVetrinaAllowed(tenantParametri, vetrinaTenant),
    [tenantParametri, vetrinaTenant],
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
        setIngredientiRicercaMap({});
        if (tenant?.id && Array.isArray(menuData) && menuData.length > 0) {
          try {
            const ids = menuData.map((p) => p.id).filter(Boolean);
            const map = await getProductIngredientiMap(tenant.id, ids);
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

  const categories = useMemo(() => buildCategoriesFromMenu(menu), [menu]);

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
        navigate("/login", {
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

  return (
    <div
      className="public-store-page"
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

      <div id="public-menu" style={styles.menuSection}>
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
        {user && totalQty > 0 && vetrinaOrdiniOk ? (
          <div style={styles.cartBar}>
            <span>
              Carrello: <strong>{totalQty}</strong> {totalQty === 1 ? "articolo" : "articoli"}
            </span>
            <Link to="/ordina" style={styles.cartBarBtn}>
              Procedi all&apos;ordine (consegna)
            </Link>
          </div>
        ) : null}
        {user && totalQty > 0 && !vetrinaOrdiniOk ? (
          <p style={styles.cartBlockedHint}>
            Carrello con articoli: gli <strong>ordini online</strong> non sono disponibili (piano licenza o impostazioni del
            locale).
          </p>
        ) : null}
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
                <code style={{ fontSize: 12 }}>?tenant=&lt;uuid&gt;</code> all&apos;URL.
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
          showModifica={false}
          storefront={false}
        />
      </div>
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
  cartBar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 16,
    padding: "12px 14px",
    background: "#ecfdf5",
    border: "1px solid #a7f3d0",
    borderRadius: 8,
    fontSize: 14,
    color: "#14532d",
  },
  cartBarBtn: {
    padding: "8px 14px",
    background: "#0f766e",
    color: "#fff",
    borderRadius: 8,
    fontWeight: 700,
    textDecoration: "none",
    fontSize: 14,
  },
  cartBlockedHint: {
    marginBottom: 16,
    padding: "12px 14px",
    background: "#fef2f2",
    border: "1px solid #fecaca",
    borderRadius: 8,
    fontSize: 14,
    color: "#991b1b",
    lineHeight: 1.5,
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
