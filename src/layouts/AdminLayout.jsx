import { Fragment } from "react";
import { Outlet, NavLink, Link, useLocation } from "react-router-dom";
import { useAuth } from "@/app/contexts/AuthContext";
import { useTenant } from "@/app/contexts/TenantContext";
import { adminLayoutCssVarsFromTheme, resolveMenuTheme } from "@/utils/tenantMenuTheme";

const HEADER_HEIGHT = 56;

/** Voci allineate alle route reali: roadmap “ideale” mappata su pagine esistenti (vedi docs/ARCHITETTURA_E_STATO.md). */
const topNavItems = [
  { to: "/admin/dashboard", label: "Riepilogo" },
  { to: "/admin/report", label: "Report" },
  { to: "/admin/menu", label: "Menu" },
  { to: "/admin/menu/ingredienti", label: "Magazzino" },
  { to: "/admin/menu/pizze", label: "Costi" },
  { to: "/admin/dipendenti", label: "Dipendenti" },
  { to: "/admin/ruoli", label: "Ruoli" },
  { to: "/admin/settings", label: "Impostazioni" },
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
];

const settingsSidebarItems = [
  { to: "/admin/settings/dati-pizzeria", label: "Dati pizzeria" },
  { to: "/admin/settings/layout", label: "Layout" },
  { to: "/admin/settings/orari", label: "Giorni e orari" },
  { to: "/admin/settings/parametri", label: "Parametri" },
];

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const { tenantData } = useTenant();
  const location = useLocation();
  const isMenuArea = location.pathname.startsWith("/admin/menu");
  const isSettingsArea = location.pathname.startsWith("/admin/settings");
  const isDashboard = location.pathname === "/admin/dashboard" || location.pathname === "/admin";
  const sidebarItems = isSettingsArea ? settingsSidebarItems : isMenuArea ? menuSidebarItems : topNavItems;

  const logoUrl = tenantData?.logo_url ?? null;
  const brandName = tenantData?.nome || "PizzaManager";
  const resolvedTenantTheme = resolveMenuTheme(tenantData?.parametri_operativi);
  const adminThemeStyle = adminLayoutCssVarsFromTheme(resolvedTenantTheme);
  const tenantThemeClass = resolvedTenantTheme ? " tenant-theme-on" : "";

  return (
    <Fragment>
      <header className={`admin-fixed-bar${tenantThemeClass}`} role="banner" style={adminThemeStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <Link to="/admin/dashboard" className="admin-bar-logo">
            {logoUrl ? (
              <img src={logoUrl} alt={brandName} />
            ) : (
              brandName
            )}
          </Link>
          <nav>
            {topNavItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={!item.to.startsWith("/admin/menu")}
                className={({ isActive }) => (isActive ? "active" : "")}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
        <div className="admin-bar-right">
          <span style={{ fontSize: 13 }}>Admin</span>
          <button type="button" className="admin-bar-logout" onClick={logout}>
            Esci
          </button>
        </div>
      </header>

      <div className={`dashboard-wrap theme-admin${tenantThemeClass}`} style={{ paddingTop: HEADER_HEIGHT, ...adminThemeStyle }}>
        {!isDashboard && (
        <aside className="dashboard-sidebar" style={{ flexShrink: 0 }}>
          <h2 className="dashboard-sidebar-title">{isSettingsArea ? "Impostazioni" : "Gestione"}</h2>
          <nav>
            {sidebarItems.map((item) => (
              <NavLink key={item.to} to={item.to} className={({ isActive }) => (isActive ? "active" : "")}>
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="dashboard-sidebar-footer">
            <p className="user-email" title={user?.email}>{user?.email}</p>
          </div>
        </aside>
        )}
        <main className="dashboard-main" style={{ flex: 1, minWidth: 0 }}>
          <div className="dashboard-content">
            <Outlet />
          </div>
        </main>
      </div>
    </Fragment>
  );
}
