import { Outlet, NavLink, Navigate, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import { useAuth } from "@/app/contexts/AuthContext";
import { useTenant } from "@/app/contexts/TenantContext";
import { CassaHeaderContext } from "@/app/contexts/CassaHeaderContext";

const ROLE_ROUTES = {
  operatore: "/operative/dashboard",
  pizzaiolo: "/operative/pizzaioli",
  cassa: "/operative/cassa",
  bancone: "/operative/bancone",
  cucina: "/operative/cucina",
  delivery: "/operative/delivery",
  pony: "/operative/delivery",
};

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

  const menuTheme = tenantData?.parametri_operativi?.menuTheme && typeof tenantData.parametri_operativi.menuTheme === "object"
    ? tenantData.parametri_operativi.menuTheme
    : null;
  const themeStyle = menuTheme
    ? {
        "--admin-bar-bg": menuTheme.primary,
        "--admin-bar-accent": menuTheme.accent,
        "--admin-sidebar-bg": menuTheme.primary,
        "--admin-content-bg": menuTheme.background,
      }
    : {};

  const defaultPath = ROLE_ROUTES[ruolo] || "/operative/dashboard";
  const navItems = permessiAree
    ? ROLE_NAV.filter((item) => {
        if (item.areaKey === "delivery") return permessiAree.delivery === true || permessiAree.pony === true;
        return permessiAree[item.areaKey] === true;
      })
    : ROLE_NAV;
  const firstAllowedPath = navItems[0]?.to ?? defaultPath;
  const currentAreaKey = ROLE_NAV.find((item) => item.to === location.pathname)?.areaKey;
  const canAccessCurrent = !currentAreaKey || !permessiAree || permessiAree[currentAreaKey] === true;
  const operatoreLabel = labelFromEmail(user?.email ?? "");
  const isCassaPage = location.pathname === "/operative/cassa" || location.pathname.startsWith("/operative/cassa/");
  const [cassaToolbar, setCassaToolbar] = useState(null);
  const headerSubtitle = ROLE_NAV.find((item) => item.to === location.pathname)?.label ?? "";
  const headerTitle = headerSubtitle ? `Area operativa — ${headerSubtitle}` : `Area operativa${operatoreLabel ? ` — ${operatoreLabel}` : ""}`;

  useEffect(() => {
    if (!isCassaPage) setCassaToolbar(null);
  }, [isCassaPage]);

  if (location.pathname === "/operative" || location.pathname === "/operative/") {
    return <Navigate to={firstAllowedPath} replace />;
  }
  if (!canAccessCurrent && firstAllowedPath) {
    return <Navigate to={firstAllowedPath} replace />;
  }
  return (
    <div className="dashboard-wrap theme-admin" style={themeStyle}>
      <aside className="dashboard-sidebar">
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
      <div className="dashboard-main">
        <CassaHeaderContext.Provider value={{ setContent: setCassaToolbar }}>
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
          <main className="dashboard-content">
            <Outlet context={{ operatoreLabel, ruolo }} />
          </main>
        </CassaHeaderContext.Provider>
      </div>
    </div>
  );
}
