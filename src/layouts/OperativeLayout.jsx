import { Outlet, NavLink, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { useAuth } from "@/app/contexts/AuthContext";
import { useTenant } from "@/app/contexts/TenantContext";
import { CassaHeaderContext } from "@/app/contexts/CassaHeaderContext";
import { adminLayoutCssVarsFromTheme, resolveMenuTheme } from "@/utils/tenantMenuTheme";
import {
  useAutoFullscreenOnTablet,
  requestBrowserFullscreen,
  isTabletLike,
} from "@/hooks/usePizzaioloFullscreen";
import { OPERATIVE_ROLE_HOME, PIZZAIOLO_TEST_INGRESSO_PATH } from "@/constants/operativeRoutes";
import { ENABLE_TEST_REPARTI, PERMESSI_TUTTE_AREE } from "@/constants/testReparti";
import { isDefaultAreaForRole } from "@/utils/operativeAreaAccess";
import { useTenantServizi } from "@/app/hooks/useTenantServizi";
import { OPERATIVE_AREA_NAV } from "@/constants/operativeNav";
import { findOperativeNavItemForPath, resolveFirstOperativePath } from "@/utils/operativePathEligibility";
import { labelFromEmailPrefix } from "@/utils/emailDisplayLabel";
import { prefetchWhenIdle } from "@/utils/idlePrefetch";
import { isQuadRepartiTestEmail } from "@/constants/quadRepartiTest";
import AppCopyrightLine from "@/components/branding/AppCopyrightLine";

const ROLE_NAV = OPERATIVE_AREA_NAV;

function getAreaKeyForPath(pathname) {
  return findOperativeNavItemForPath(pathname)?.areaKey;
}

const RUOLO_SIDEBAR_LABEL = {
  operatore: "Operatore",
  pizzaiolo: "Pizzaiolo",
  cassa: "Cassa",
  bancone: "Bancone",
  cucina: "Cucina",
  delivery: "Delivery",
  pony: "Pony",
  superadmin: "Super Admin",
};

export default function OperativeLayout() {
  const { user, logout, ruolo, permessiAree } = useAuth();
  const navigate = useNavigate();
  const { tenantData } = useTenant();
  const { hasServizio } = useTenantServizi();
  const location = useLocation();

  const resolvedTenantTheme = resolveMenuTheme(tenantData?.parametri_operativi);
  const themeStyle = adminLayoutCssVarsFromTheme(resolvedTenantTheme);
  const tenantThemeClass = resolvedTenantTheme ? " tenant-theme-on" : "";
  const logoUrl = tenantData?.logo_url ?? null;
  const brandName = tenantData?.nome || "Pizzeria";

  const ruoloKey = typeof ruolo === "string" ? ruolo.toLowerCase().trim() : "";
  const defaultPath =
    isQuadRepartiTestEmail(user?.email) && ruoloKey === "pizzaiolo"
      ? PIZZAIOLO_TEST_INGRESSO_PATH
      : OPERATIVE_ROLE_HOME[ruoloKey] || "/operative/dashboard";
  const permessiAreeEffective =
    ruoloKey === "superadmin" && ENABLE_TEST_REPARTI
      ? PERMESSI_TUTTE_AREE
      : isQuadRepartiTestEmail(user?.email)
        ? PERMESSI_TUTTE_AREE
        : permessiAree;
  const navItemsRaw = permessiAreeEffective
    ? ROLE_NAV.filter((item) => {
        if (item.servizioId && !hasServizio(item.servizioId) && !isQuadRepartiTestEmail(user?.email)) return false;
        if (item.areaKey === "delivery") {
          return permessiAreeEffective.delivery === true || permessiAreeEffective.pony === true;
        }
        return permessiAreeEffective[item.areaKey] === true;
      })
    : [];
  const navItems = [...navItemsRaw].sort((a, b) => {
    const score = (item) => {
      if (item.areaKey === "delivery") {
        return isDefaultAreaForRole(ruolo, "delivery") || isDefaultAreaForRole(ruolo, "pony") ? 0 : 1;
      }
      return isDefaultAreaForRole(ruolo, item.areaKey) ? 0 : 1;
    };
    const diff = score(a) - score(b);
    if (diff !== 0) return diff;
    return ROLE_NAV.findIndex((x) => x.to === a.to) - ROLE_NAV.findIndex((x) => x.to === b.to);
  });
  const firstAllowedPath = resolveFirstOperativePath(navItems, defaultPath, permessiAreeEffective, hasServizio);
  const currentAreaKey = getAreaKeyForPath(location.pathname);
  const currentNavMatch = findOperativeNavItemForPath(location.pathname);
  const servizioOk =
    isQuadRepartiTestEmail(user?.email) ||
    !currentNavMatch?.servizioId ||
    hasServizio(currentNavMatch.servizioId);
  const canAccessCurrent =
    Boolean(permessiAreeEffective) &&
    servizioOk &&
    (!currentAreaKey ||
      (currentAreaKey === "delivery"
        ? permessiAreeEffective.delivery === true || permessiAreeEffective.pony === true
        : permessiAreeEffective[currentAreaKey] === true));
  const operatoreLabel = labelFromEmailPrefix(user?.email ?? "");
  const isCassaPage = location.pathname === "/operative/cassa" || location.pathname.startsWith("/operative/cassa/");
  const isPizzaioloPage = location.pathname === "/operative/pizzaioli";
  const isRepartiQuadTestPage = location.pathname === "/operative/test-reparti-quad";
  const operativeFullBleed = isPizzaioloPage || isRepartiQuadTestPage;
  const [cassaToolbar, setCassaToolbar] = useState(null);
  const [cassaSidebar, setCassaSidebar] = useState(null);
  const [tabletLike, setTabletLike] = useState(false);
  const matchedNavItem = [...ROLE_NAV]
    .sort((a, b) => b.to.length - a.to.length)
    .find(
      (item) =>
        location.pathname === item.to || location.pathname.startsWith(`${item.to}/`)
    );
  const headerSubtitle = matchedNavItem?.label ?? "";
  const headerTitle = headerSubtitle ? `Area operativa — ${headerSubtitle}` : `Area operativa${operatoreLabel ? ` — ${operatoreLabel}` : ""}`;

  useAutoFullscreenOnTablet(isPizzaioloPage);

  useEffect(() => {
    const sync = () => setTabletLike(isTabletLike());
    sync();
    window.addEventListener("resize", sync);
    return () => window.removeEventListener("resize", sync);
  }, []);

  useEffect(() => {
    if (!isCassaPage) {
      setCassaToolbar(null);
      setCassaSidebar(null);
    }
  }, [isCassaPage]);

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  useEffect(() => {
    return prefetchWhenIdle([
      () => import("@/features/operative/pages/OperativeDashboard"),
      () => import("@/features/operative/cassa/pages/CassaPage"),
      () => import("@/features/operative/cucina/pages/Cucina"),
    ]);
  }, []);

  if (!firstAllowedPath) {
    return (
      <div className={`dashboard-wrap theme-admin${tenantThemeClass}`} style={themeStyle}>
        <main className="dashboard-main" style={{ flex: 1, minWidth: 0 }}>
          <div className="dashboard-content" style={{ maxWidth: 520, margin: "48px auto", padding: 24 }}>
            <h1 className="dashboard-page-title">Nessuna area disponibile</h1>
            <p style={{ fontSize: 14, color: "#64748b", lineHeight: 1.6 }}>
              Il tuo profilo non ha permessi su aree attive per questo piano, oppure i servizi abilitati per la pizzeria non
              includono moduli collegati alle tue aree. Contatta un amministratore.
            </p>
            <button type="button" className="btn-logout btn-logout-red" style={{ marginTop: 20 }} onClick={() => void handleLogout()}>
              Esci
            </button>
          </div>
          <AppCopyrightLine className="dashboard-app-copyright" />
        </main>
      </div>
    );
  }

  if (location.pathname === "/operative" || location.pathname === "/operative/") {
    const homeOp =
      isQuadRepartiTestEmail(user?.email) ? "/operative/pizzaiolo-ingresso" : firstAllowedPath;
    return <Navigate to={homeOp} replace />;
  }
  if (!canAccessCurrent && firstAllowedPath) {
    return <Navigate to={firstAllowedPath} replace />;
  }
  const wrapClass = `dashboard-wrap theme-admin${tenantThemeClass}${operativeFullBleed ? " pizzaiolo-fullscreen" : ""}`;

  return (
    <div className={wrapClass} style={themeStyle}>
      {!operativeFullBleed && (
        <aside className="dashboard-sidebar">
          {logoUrl && (
            <div style={{ marginBottom: 16, textAlign: "center" }}>
              <img src={logoUrl} alt={brandName} style={{ maxWidth: "100%", maxHeight: 48, objectFit: "contain" }} />
            </div>
          )}
          <h2 className="dashboard-sidebar-title">Area operativa</h2>
          {isCassaPage && cassaSidebar ? (
            <div className="dashboard-sidebar-cassa-slot" style={{ marginBottom: 14 }}>
              {cassaSidebar}
            </div>
          ) : null}
          <nav>
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => (isActive ? "active" : "")}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="dashboard-sidebar-footer">
            <p className="user-email" title={user?.email}>{operatoreLabel || user?.email}</p>
            {ruoloKey ? (
              <p className="user-role-line" title="Ruolo assegnato in Admin → Dipendenti / Ruoli">
                Ruolo: {RUOLO_SIDEBAR_LABEL[ruoloKey] ?? ruoloKey}
              </p>
            ) : null}
          </div>
        </aside>
      )}
      <div className={`dashboard-main${operativeFullBleed ? " pizzaiolo-fullscreen-main" : ""}`}>
        <CassaHeaderContext.Provider value={{ setContent: setCassaToolbar, setSidebar: setCassaSidebar }}>
          {isPizzaioloPage && (
            <div className="pizzaiolo-floating-bar" role="toolbar" aria-label="Azioni Pizzaiolo">
              {tabletLike && (
                <button
                  type="button"
                  className="pizzaiolo-fs-btn"
                  onClick={() => requestBrowserFullscreen()}
                  title="Schermo intero (nasconde barra browser)"
                  aria-label="Schermo intero"
                >
                  ⛶
                </button>
              )}
              <button type="button" className="btn-logout btn-logout-red" onClick={() => void handleLogout()}>
                Esci
              </button>
            </div>
          )}
          {!operativeFullBleed && (
            <header className="dashboard-header">
              <h1 className="dashboard-header-title">
                {headerTitle}
              </h1>
              {isCassaPage && (
                <div className="dashboard-header-toolbar" style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 0, margin: "0 16px", justifyContent: "flex-start" }}>
                  {cassaToolbar}
                </div>
              )}
              <div className="dashboard-header-actions">
                <button type="button" className="btn-logout btn-logout-red" onClick={() => void handleLogout()}>
                  Esci
                </button>
              </div>
            </header>
          )}
          <main className={`dashboard-content${operativeFullBleed ? " pizzaiolo-content-full" : ""}`}>
            <Outlet context={{ operatoreLabel, ruolo }} />
          </main>
        </CassaHeaderContext.Provider>
        <AppCopyrightLine className="dashboard-app-copyright" />
      </div>
    </div>
  );
}
