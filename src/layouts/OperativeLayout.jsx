import { Outlet, NavLink, Navigate, useLocation } from "react-router-dom";
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
import { OPERATIVE_ROLE_HOME } from "@/constants/operativeRoutes";
import { isDefaultAreaForRole } from "@/utils/operativeAreaAccess";

const ROLE_NAV = [
  { to: "/operative/dashboard", label: "Riepilogo", areaKey: "riepilogo" },
  { to: "/operative/cassa", label: "Cassa", areaKey: "cassa" },
  { to: "/operative/cassa/prodotti-esauriti", label: "Prodotti esauriti", areaKey: "cassa" },
  { to: "/operative/turni", label: "Turni", areaKey: "cassa" },
  { to: "/operative/cucina", label: "Cucina", areaKey: "cucina" },
  { to: "/operative/bancone", label: "Bancone", areaKey: "bancone" },
  { to: "/operative/pizzaioli", label: "Pizzaioli", areaKey: "pizzaiolo" },
  { to: "/operative/delivery", label: "Delivery", areaKey: "delivery" },
];

function getAreaKeyForPath(pathname) {
  const sorted = [...ROLE_NAV].sort((a, b) => b.to.length - a.to.length);
  const hit = sorted.find(
    (item) => pathname === item.to || pathname.startsWith(`${item.to}/`)
  );
  return hit?.areaKey;
}

function labelFromEmail(email) {
  if (!email || !email.includes("@")) return "";
  const prefix = email.split("@")[0].trim();
  if (!prefix) return "";
  return prefix.charAt(0).toUpperCase() + prefix.slice(1).toLowerCase().replace(/(\d+)/, " $1");
}

export default function OperativeLayout() {
  const { user, logout, ruolo, permessiAree } = useAuth();
  const { tenantData } = useTenant();
  const location = useLocation();

  const resolvedTenantTheme = resolveMenuTheme(tenantData?.parametri_operativi);
  const themeStyle = adminLayoutCssVarsFromTheme(resolvedTenantTheme);
  const tenantThemeClass = resolvedTenantTheme ? " tenant-theme-on" : "";
  const logoUrl = tenantData?.logo_url ?? null;
  const brandName = tenantData?.nome || "Pizzeria";

  const ruoloKey = typeof ruolo === "string" ? ruolo.toLowerCase().trim() : "";
  const defaultPath = OPERATIVE_ROLE_HOME[ruoloKey] || "/operative/dashboard";
  const navItemsRaw = permessiAree
    ? ROLE_NAV.filter((item) => {
        if (item.areaKey === "delivery") {
          return permessiAree.delivery === true || permessiAree.pony === true;
        }
        return permessiAree[item.areaKey] === true;
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
  const firstAllowedPath = navItems[0]?.to ?? defaultPath;
  const currentAreaKey = getAreaKeyForPath(location.pathname);
  const canAccessCurrent =
    Boolean(permessiAree) &&
    (!currentAreaKey ||
      (currentAreaKey === "delivery"
        ? permessiAree.delivery === true || permessiAree.pony === true
        : permessiAree[currentAreaKey] === true));
  const operatoreLabel = labelFromEmail(user?.email ?? "");
  const isCassaPage = location.pathname === "/operative/cassa" || location.pathname.startsWith("/operative/cassa/");
  const isPizzaioloPage = location.pathname === "/operative/pizzaioli";
  const [cassaToolbar, setCassaToolbar] = useState(null);
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
    if (!isCassaPage) setCassaToolbar(null);
  }, [isCassaPage]);

  if (location.pathname === "/operative" || location.pathname === "/operative/") {
    return <Navigate to={firstAllowedPath} replace />;
  }
  if (!canAccessCurrent && firstAllowedPath) {
    return <Navigate to={firstAllowedPath} replace />;
  }
  const wrapClass = `dashboard-wrap theme-admin${tenantThemeClass}${isPizzaioloPage ? " pizzaiolo-fullscreen" : ""}`;

  return (
    <div className={wrapClass} style={themeStyle}>
      {!isPizzaioloPage && (
        <aside className="dashboard-sidebar">
          {logoUrl && (
            <div style={{ marginBottom: 16, textAlign: "center" }}>
              <img src={logoUrl} alt={brandName} style={{ maxWidth: "100%", maxHeight: 48, objectFit: "contain" }} />
            </div>
          )}
          <h2 className="dashboard-sidebar-title">Area operativa</h2>
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
          </div>
        </aside>
      )}
      <div className={`dashboard-main${isPizzaioloPage ? " pizzaiolo-fullscreen-main" : ""}`}>
        <CassaHeaderContext.Provider value={{ setContent: setCassaToolbar }}>
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
              <button type="button" className="btn-logout btn-logout-red" onClick={logout}>
                Esci
              </button>
            </div>
          )}
          {!isPizzaioloPage && (
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
                <button type="button" className="btn-logout btn-logout-red" onClick={logout}>
                  Esci
                </button>
              </div>
            </header>
          )}
          <main className={`dashboard-content${isPizzaioloPage ? " pizzaiolo-content-full" : ""}`}>
            <Outlet context={{ operatoreLabel, ruolo }} />
          </main>
        </CassaHeaderContext.Provider>
      </div>
    </div>
  );
}
