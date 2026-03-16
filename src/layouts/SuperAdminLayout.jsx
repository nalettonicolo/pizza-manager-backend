import { Fragment } from "react";
import { Outlet, NavLink, Link } from "react-router-dom";
import { useAuth } from "@/app/contexts/AuthContext";

const HEADER_HEIGHT = 56;

const navItems = [
  { to: "/superadmin/dashboard", label: "Riepilogo" },
  { to: "/superadmin/tenants", label: "Clienti" },
  { to: "/superadmin/piani", label: "Piani" },
  { to: "/superadmin/licenses", label: "Abbonamenti" },
  { to: "/superadmin/settings", label: "Impostazioni" },
];

export default function SuperAdminLayout() {
  const { user, logout } = useAuth();

  return (
    <Fragment>
      {/* Fascia superiore FISSA - fuori dal wrapper, sempre in cima alla pagina */}
      <header className="superadmin-fixed-bar" role="banner">
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <Link to="/superadmin/dashboard" className="superadmin-bar-logo">
            PizzaManager
          </Link>
          <nav>
            {navItems.map((item) => (
              <NavLink key={item.to} to={item.to} className={({ isActive }) => (isActive ? "active" : "")}>
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
        <div className="superadmin-bar-right">
          <span style={{ fontSize: 13 }}>Super Admin</span>
          <button type="button" className="superadmin-bar-logout" onClick={logout}>
            Esci
          </button>
        </div>
      </header>

      {/* Contenuto: spazio per la barra fissa + sidebar + area principale */}
      <div className="dashboard-wrap theme-superadmin" style={{ paddingTop: HEADER_HEIGHT }}>
        <aside className="dashboard-sidebar" style={{ flexShrink: 0 }}>
          <h2 className="dashboard-sidebar-title">Piattaforma</h2>
          <nav>
            {navItems.map((item) => (
              <NavLink key={item.to} to={item.to} className={({ isActive }) => (isActive ? "active" : "")}>
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="dashboard-sidebar-footer">
            <p className="user-email" title={user?.email}>{user?.email}</p>
          </div>
        </aside>
        <main className="dashboard-main" style={{ flex: 1, minWidth: 0 }}>
          <div className="dashboard-content">
            <Outlet />
          </div>
        </main>
      </div>
    </Fragment>
  );
}
