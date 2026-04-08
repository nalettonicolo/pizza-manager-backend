import { useEffect, useState, useMemo, useCallback } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { UtensilsCrossed } from "lucide-react";

import { useAuth } from "@/app/contexts/AuthContext";
import HeroStore from "@/features/public/components/HeroStore";
import Loader from "@/components/feedback/Loader";
import ErrorState from "@/components/feedback/ErrorState";
import ProductGrid from "@/features/operative/cassa/components/ProductGrid";
import CategoryTabs from "@/features/operative/cassa/components/CategoryTabs";

import { getPublicMenu, getPublicTenantInfo } from "@/features/services/publicService";
import { resolveMenuTheme } from "@/utils/tenantMenuTheme";
import { sortByOrdine } from "@/utils/sortByOrdine";
import { usePublicCart } from "@/app/contexts/PublicCartContext";
import { applyPromoCalendarioToProducts } from "@/utils/promozioniCalendario";

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
  const [selectedCategoryId, setSelectedCategoryId] = useState(null);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        setError(null);
        const tenant = await getPublicTenantInfo({ search: location.search });
        if (tenant) {
          setTenantName(tenant.nome || null);
          setTenantParametri(
            tenant.parametri_operativi && typeof tenant.parametri_operativi === "object"
              ? tenant.parametri_operativi
              : null
          );
          if (tenant.orari_settimana) {
            setClosedToday(isTodayClosed(tenant.orari_settimana));
          }
          setBranding({
            nome: tenant.nome,
            logo_url: tenant.logo_url ?? null,
            indirizzo: tenant.indirizzo ?? null,
            ordinazione_attiva: true,
          });
          setMenuTheme(resolveMenuTheme(tenant.parametri_operativi));
        } else {
          setBranding(null);
          setMenuTheme(null);
          setTenantParametri(null);
        }
        const menuData = await getPublicMenu({ tenantId: tenant?.id ?? null });
        setMenu(menuData || []);
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
  const cardBg = menuTheme?.cardBackground ?? "#ffffff";
  const pageBg = menuTheme?.background;

  const filteredProducts = useMemo(() => {
    if (!menu.length) return [];
    if (!categories.length) return menu;
    if (!activeCategoryId) return [];
    const raw = menu.filter((p) => p.categoria_id === activeCategoryId);
    return applyPromoCalendarioToProducts(raw, tenantParametri, new Date());
  }, [menu, categories.length, activeCategoryId, tenantParametri]);

  const handleAddProduct = useCallback(
    (product) => {
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
    [user, navigate, location, addItem]
  );

  const ingredientiMap = useMemo(
    () =>
      menu.reduce(
        (acc, p) => ({
          ...acc,
          [p.id]: p.descrizione ? [p.descrizione] : [],
        }),
        {}
      ),
    [menu]
  );

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
      <HeroStore branding={branding} menuTheme={menuTheme} />

      {closedToday && (
        <div style={styles.closedBanner}>
          Oggi {tenantName ? `la pizzeria ${tenantName}` : "la pizzeria"} è <strong>chiusa</strong>. Le ordinazioni online non sono disponibili.
        </div>
      )}

      <div id="public-menu" style={styles.menuSection}>
        {categories.length > 0 ? (
          <CategoryTabs
            categories={categories}
            activeCategory={activeCategoryId}
            onSelect={setSelectedCategoryId}
            accentColor={accent}
          />
        ) : (
          <div style={styles.menuHeaderRow}>
            <UtensilsCrossed size={22} style={{ color: accent, flexShrink: 0 }} />
            <span style={{ ...styles.menuTitleFallback, color: accent }}>Menù</span>
          </div>
        )}
        {!user && (
          <p style={styles.loginHint}>Accedi per aggiungere al carrello (si apre il login).</p>
        )}
        {user && totalQty > 0 && (
          <div style={styles.cartBar}>
            <span>
              Carrello: <strong>{totalQty}</strong> {totalQty === 1 ? "articolo" : "articoli"}
            </span>
            <Link to="/ordina" style={styles.cartBarBtn}>
              Procedi all&apos;ordine (consegna)
            </Link>
          </div>
        )}
        {!menu.length && (
          <p style={styles.emptyMenuHint}>
            {location.pathname.startsWith("/preview") || location.pathname.startsWith("/negozio") ? (
              <>
                Nessun piatto in vetrina per la pizzeria selezionata. Verifica in{" "}
                <strong>Admin → Menu</strong> che i prodotti siano <strong>attivi</strong> e{" "}
                <strong>visibili online</strong>. Su <strong>pizzamanager.it</strong> senza parametri
                l&apos;anteprima sceglie un tenant con menu pubblico; per forzare la tua pizzeria usa{" "}
                <code style={{ fontSize: 12 }}>?tenant=&lt;uuid&gt;</code> o{" "}
                <code style={{ fontSize: 12 }}>?slug=&lt;slug-tenant&gt;</code>, oppure{" "}
                <code style={{ fontSize: 12 }}>VITE_PUBLIC_DEMO_TENANT_ID</code> nel build.
              </>
            ) : (
              <>Al momento non ci sono piatti disponibili online.</>
            )}
          </p>
        )}
        <ProductGrid
          products={filteredProducts}
          ingredientiMap={ingredientiMap}
          rowBackground={cardBg}
          canAdd
          onAdd={handleAddProduct}
          showModifica={false}
          storefront
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
};
