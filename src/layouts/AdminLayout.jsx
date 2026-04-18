import { Fragment, useEffect, useMemo, useState, useCallback } from "react";
import { Outlet, NavLink, Link, useLocation, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "@/app/contexts/AuthContext";
import { useTenant } from "@/app/contexts/TenantContext";
import { usePv } from "@/app/contexts/PvContext";
import { useTenantServizi } from "@/app/hooks/useTenantServizi";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { adminLayoutCssVarsFromTheme, resolveMenuTheme } from "@/utils/tenantMenuTheme";
import { prefetchWhenIdle } from "@/utils/idlePrefetch";
import { ADMIN_TENANT_HOME } from "@/constants/adminTenantHome";
import { applyTenantFavicon } from "@/utils/tenantFavicon";

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
  { to: "/admin/contabilita", label: "Contabilità", servizioId: null },
  { to: "/admin/dipendenti", label: "Dipendenti", servizioId: null },
  { to: "/admin/ruoli", label: "Ruoli", servizioId: null },
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
  { to: "/admin/menu/prep-cucina-colori", label: "Colori prep Cucina" },
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

function topNavLinkEnd(to) {
  return !(
    to === "/admin/menu" ||
    to === "/admin/settings" ||
    to === "/admin/magazzino" ||
    to === "/admin/contabilita"
  );
}

export default function AdminLayout() {
  const { user, logout, ruolo } = useAuth();
  const navigate = useNavigate();
  const { tenantData } = useTenant();
  const { activePv, pvList, loading: pvLoading } = usePv();
  const { hasServizio, enforcementActive, contabilitaMode } = useTenantServizi();
  const location = useLocation();
  const adminNavCompact = useMediaQuery("(max-width: 768px)");
  const [adminMobileNavOpen, setAdminMobileNavOpen] = useState(false);
  const closeMobileNav = useCallback(() => setAdminMobileNavOpen(false), []);

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
          ? contabilitaMode === "semplice"
            ? [{ to: "/admin/contabilita/incassi", label: "Gestione incassi" }]
            : contabilitaSidebarItems
          : menuSidebarItems;
  const sidebarTitle = isSettingsArea
    ? "Impostazioni"
    : isMenuArea
      ? "Menu e listino"
      : isMagazzinoArea
        ? "Magazzino"
        : isContabilitaArea
          ? contabilitaMode === "semplice"
            ? "Contabilità semplificata"
            : "Contabilità"
          : "Menu e listino";

  const visibleTopNav = useMemo(() => {
    return topNavItems.filter((item) => {
      if (item.to === "/admin/contabilita") {
        if (enforcementActive) {
          return hasServizio("contabilita_locale") || hasServizio("contabilita_semplice");
        }
        // Senza enforcement piano: la voce resta sempre visibile (hub, food cost, incassi in base ai moduli attivi).
        return true;
      }
      return !item.servizioId || hasServizio(item.servizioId);
    });
  }, [hasServizio, enforcementActive]);

  const blockedRedirect = useMemo(() => {
    if (!enforcementActive) return null;
    const p = location.pathname;
    if (p.startsWith("/admin/report") && !hasServizio("report_analisi")) return ADMIN_TENANT_HOME;
    if (p.startsWith("/admin/fidelity") && !hasServizio("fidelity_card")) return ADMIN_TENANT_HOME;
    if (p.startsWith("/admin/magazzino") && !hasServizio("magazzino_gestione")) return ADMIN_TENANT_HOME;
    if (
      p.startsWith("/admin/contabilita") &&
      !hasServizio("contabilita_locale") &&
      !hasServizio("contabilita_semplice")
    ) {
      return ADMIN_TENANT_HOME;
    }
    return null;
  }, [enforcementActive, location.pathname, hasServizio]);

  const ruoloKey = (ruolo && String(ruolo).toLowerCase().trim()) || "";
  const adminNeedsPvChoice = ruoloKey === "admin" && pvList.length > 1;

  useEffect(() => {
    closeMobileNav();
  }, [location.pathname, closeMobileNav]);

  useEffect(() => {
    if (!adminNavCompact || !adminMobileNavOpen) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e) => {
      if (e.key === "Escape") closeMobileNav();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [adminNavCompact, adminMobileNavOpen, closeMobileNav]);

  useEffect(() => {
    return prefetchWhenIdle([
      () => import("@/features/admin/pages/ManualeUtentePage"),
      () => import("@/features/admin/pages/menu/CategoriePage"),
      () => import("@/features/admin/pages/menu/IngredientiPage"),
      () => import("@/features/admin/pages/menu/PrepCucinaColoriPage"),
      () => import("@/features/admin/pages/menu/ImpastiPage"),
      () => import("@/features/admin/pages/UserManager"),
    ]);
  }, []);

  const logoUrl = tenantData?.logo_url ?? null;
  const brandName = tenantData?.nome || "PizzaManager";
  const resolvedTenantTheme = resolveMenuTheme(tenantData?.parametri_operativi);
  const adminThemeStyle = adminLayoutCssVarsFromTheme(resolvedTenantTheme);
  const tenantThemeClass = resolvedTenantTheme ? " tenant-theme-on" : "";

  useEffect(() => {
    void applyTenantFavicon(logoUrl);
  }, [logoUrl]);

  if (blockedRedirect) {
    return <Navigate to={blockedRedirect} replace />;
  }

  if (adminNeedsPvChoice && !pvLoading && !activePv) {
    return <Navigate to="/select-pv" replace />;
  }

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
          {adminNavCompact ? (
            <button
              type="button"
              className="admin-bar-mobile-toggle"
              aria-expanded={adminMobileNavOpen}
              aria-controls="admin-mobile-nav-panel"
              aria-label={adminMobileNavOpen ? "Chiudi menu sezioni" : "Apri menu sezioni"}
              onClick={() => setAdminMobileNavOpen((o) => !o)}
            >
              <span className="admin-bar-mobile-toggle-bars" aria-hidden>
                <span />
                <span />
                <span />
              </span>
              <span className="admin-bar-mobile-toggle-label">Menu</span>
            </button>
          ) : null}
          {!adminNavCompact ? (
            <nav className="admin-bar-nav-inline" aria-label="Sezioni admin">
              {visibleTopNav.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={topNavLinkEnd(item.to)}
                  className={({ isActive }) => (isActive ? "active" : "")}
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>
          ) : null}
        </div>
        <div className="admin-bar-right" style={{ alignItems: "center", gap: 12 }}>
          <span className="admin-bar-user-email" title={user?.email}>
            {user?.email}
          </span>
          <span className="admin-bar-role-label">Admin</span>
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
        {adminNavCompact && adminMobileNavOpen ? (
          <div
            className="admin-mobile-nav-backdrop"
            role="presentation"
            onClick={closeMobileNav}
          >
            <nav
              id="admin-mobile-nav-panel"
              className="admin-mobile-nav-panel"
              aria-label="Sezioni admin"
              onClick={(e) => e.stopPropagation()}
            >
              {visibleTopNav.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={topNavLinkEnd(item.to)}
                  className={({ isActive }) => (isActive ? "active" : "")}
                  onClick={closeMobileNav}
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>
          </div>
        ) : null}
      </header>

      <div
        className={`dashboard-wrap theme-admin admin-below-fixed-bar${tenantThemeClass}`}
        style={{ ...adminThemeStyle }}
      >
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
