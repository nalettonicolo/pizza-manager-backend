import { Fragment, useEffect, useMemo } from "react";
import { Outlet, NavLink, Link, useLocation, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "@/app/contexts/AuthContext";
import { useTenant } from "@/app/contexts/TenantContext";
import { usePv } from "@/app/contexts/PvContext";
import { useTenantServizi } from "@/app/hooks/useTenantServizi";
import { adminLayoutCssVarsFromTheme, resolveMenuTheme } from "@/utils/tenantMenuTheme";
import { prefetchWhenIdle } from "@/utils/idlePrefetch";
import { ADMIN_TENANT_HOME } from "@/constants/adminTenantHome";

const HEADER_HEIGHT = 56;

/**
 * Voci allineate alle route reali (vedi docs/ARCHITETTURA_E_STATO.md).
 * `servizioId` → opzionale filtro voci nav; nessun redirect forzato per piano (servizi non bloccanti).
 */
const topNavItems = [
  { to: "/admin/manuale", label: "Manuale", servizioId: null },
  { to: "/admin/report", label: "Report", servizioId: "report_analisi" },
  { to: "/admin/fidelity", label: "Fidelity", servizioId: "fidelity_card" },
  { to: "/admin/menu", label: "Menu", servizioId: null },
  { to: "/admin/magazzino", label: "Magazzino", servizioId: "magazzino_gestione" },
  { to: "/admin/contabilita", label: "Contabilità", servizioId: "contabilita_locale" },
  { to: "/admin/dipendenti", label: "Dipendenti", servizioId: null },
  { to: "/admin/ruoli", label: "Ruoli", servizioId: "ruoli_avanzati" },
  { to: "/admin/settings", label: "Impostazioni", servizioId: null },
];

const magazzinoSidebarItems = [
  { to: "/admin/magazzino", label: "Panoramica" },
  { to: "/admin/magazzino/ordini-fornitori", label: "Ordini fornitori" },
  { to: "/admin/magazzino/ddt", label: "DDT" },
];

const contabilitaSidebarItems = [
  { to: "/admin/contabilita", label: "Panoramica" },
  { to: "/admin/contabilita/fatture", label: "Fatture" },
  { to: "/admin/contabilita/pagamenti-fatture", label: "Pagamenti fatture" },
  { to: "/admin/contabilita/food-cost", label: "Food cost" },
  { to: "/admin/contabilita/spese-locale", label: "Spese gestione locale" },
  { to: "/admin/contabilita/spese-personale", label: "Spese gestione personale" },
  { to: "/admin/contabilita/incassi", label: "Gestione incassi" },
];

const menuSidebarItems = [
  { to: "/admin/menu/categorie", label: "Categorie" },
  { to: "/admin/menu/formati", label: "Formati" },
  { to: "/admin/menu/cottura", label: "Cottura" },
  { to: "/admin/menu/pizze", label: "Pizze" },
  { to: "/admin/menu/ingredienti", label: "Ingredienti" },
  { to: "/admin/menu/impasti", label: "Impasti" },
  { to: "/admin/menu/bibite", label: "Bibite" },
  { to: "/admin/menu/dolci", label: "Dolci" },
  { to: "/admin/menu/fritti", label: "Fritti" },
  { to: "/admin/menu/allergeni", label: "Allergeni" },
  { to: "/admin/menu/listini", label: "Listini e backup" },
];

const settingsSidebarItems = [
  { to: "/admin/settings/dati-pizzeria", label: "Dati pizzeria" },
  { to: "/admin/settings/layout", label: "Layout" },
  { to: "/admin/settings/orari", label: "Giorni e orari" },
  { to: "/admin/settings/area-consegna", label: "Area di consegna" },
  { to: "/admin/settings/parametri", label: "Parametri" },
];

export default function AdminLayout() {
  const { user, logout, ruolo } = useAuth();
  const navigate = useNavigate();
  const { tenantData } = useTenant();
  const { activePv, pvList, loading: pvLoading } = usePv();
  const { hasServizio, enforcementActive } = useTenantServizi();
  const location = useLocation();
  const isMenuArea = location.pathname.startsWith("/admin/menu");
  const isSettingsArea = location.pathname.startsWith("/admin/settings");
  const isMagazzinoArea = location.pathname.startsWith("/admin/magazzino");
  const isContabilitaArea = location.pathname.startsWith("/admin/contabilita");
  const showSectionSidebar = isMenuArea || isSettingsArea || isMagazzinoArea || isContabilitaArea;
  const sidebarItems = isSettingsArea
    ? settingsSidebarItems
    : isMenuArea
      ? menuSidebarItems
      : isMagazzinoArea
        ? magazzinoSidebarItems
        : isContabilitaArea
          ? contabilitaSidebarItems
          : menuSidebarItems;
  const sidebarTitle = isSettingsArea
    ? "Impostazioni"
    : isMenuArea
      ? "Menu e listino"
      : isMagazzinoArea
        ? "Magazzino"
        : isContabilitaArea
          ? "Contabilità"
          : "Menu e listino";

  const visibleTopNav = useMemo(
    () => topNavItems.filter((item) => !item.servizioId || hasServizio(item.servizioId)),
    [hasServizio],
  );

  const blockedRedirect = useMemo(() => {
    if (!enforcementActive) return null;
    const p = location.pathname;
    if (p.startsWith("/admin/report") && !hasServizio("report_analisi")) return ADMIN_TENANT_HOME;
    if (p.startsWith("/admin/fidelity") && !hasServizio("fidelity_card")) return ADMIN_TENANT_HOME;
    if (p === "/admin/ruoli" && !hasServizio("ruoli_avanzati")) return ADMIN_TENANT_HOME;
    if (p.startsWith("/admin/magazzino") && !hasServizio("magazzino_gestione")) return ADMIN_TENANT_HOME;
    if (p.startsWith("/admin/contabilita") && !hasServizio("contabilita_locale")) return ADMIN_TENANT_HOME;
    return null;
  }, [enforcementActive, location.pathname, hasServizio]);

  const ruoloKey = (ruolo && String(ruolo).toLowerCase().trim()) || "";
  const adminNeedsPvChoice = ruoloKey === "admin" && pvList.length > 1;

  useEffect(() => {
    return prefetchWhenIdle([
      () => import("@/features/admin/pages/ManualeUtentePage"),
      () => import("@/features/admin/pages/menu/CategoriePage"),
      () => import("@/features/admin/pages/menu/IngredientiPage"),
      () => import("@/features/admin/pages/menu/ImpastiPage"),
      () => import("@/features/admin/pages/UserManager"),
    ]);
  }, []);

  if (blockedRedirect) {
    return <Navigate to={blockedRedirect} replace />;
  }

  if (adminNeedsPvChoice && !pvLoading && !activePv) {
    return <Navigate to="/select-pv" replace />;
  }

  const logoUrl = tenantData?.logo_url ?? null;
  const brandName = tenantData?.nome || "PizzaManager";
  const resolvedTenantTheme = resolveMenuTheme(tenantData?.parametri_operativi);
  const adminThemeStyle = adminLayoutCssVarsFromTheme(resolvedTenantTheme);
  const tenantThemeClass = resolvedTenantTheme ? " tenant-theme-on" : "";

  return (
    <Fragment>
      <header className={`admin-fixed-bar${tenantThemeClass}`} role="banner" style={adminThemeStyle}>
        <div className="admin-bar-left">
          <Link to={ADMIN_TENANT_HOME} className="admin-bar-logo">
            {logoUrl ? (
              <img src={logoUrl} alt={brandName} />
            ) : (
              brandName
            )}
          </Link>
          <nav>
            {visibleTopNav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={
                  item.to === "/admin/menu" ||
                  item.to === "/admin/settings" ||
                  item.to === "/admin/magazzino" ||
                  item.to === "/admin/contabilita"
                    ? false
                    : true
                }
                className={({ isActive }) => (isActive ? "active" : "")}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
        <div className="admin-bar-right" style={{ alignItems: "center", gap: 12 }}>
          <span
            className="admin-bar-user-email"
            style={{ fontSize: 12, color: "rgba(255,255,255,0.88)", maxWidth: 200 }}
            title={user?.email}
          >
            {user?.email}
          </span>
          <span style={{ fontSize: 13 }}>Admin</span>
          <button
            type="button"
            className="admin-bar-logout"
            onClick={() => {
              void (async () => {
                await logout();
                navigate("/login", { replace: true });
              })();
            }}
          >
            Esci
          </button>
        </div>
      </header>

      <div className={`dashboard-wrap theme-admin${tenantThemeClass}`} style={{ paddingTop: HEADER_HEIGHT, ...adminThemeStyle }}>
        {showSectionSidebar ? (
          <aside className="dashboard-sidebar" style={{ flexShrink: 0 }}>
            <h2 className="dashboard-sidebar-title">{sidebarTitle}</h2>
            <nav>
              {sidebarItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === "/admin/magazzino" || item.to === "/admin/contabilita"}
                  className={({ isActive }) => (isActive ? "active" : "")}
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>
          </aside>
        ) : null}
        <main className="dashboard-main" style={{ flex: 1, minWidth: 0 }}>
          <div className="dashboard-content">
            <Outlet />
          </div>
          <p className="dashboard-app-copyright">© 2026 PizzaManager di Naletto Nicolò</p>
        </main>
      </div>
    </Fragment>
  );
}
