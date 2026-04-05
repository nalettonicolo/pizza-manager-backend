import { Fragment, useEffect } from "react";
import { Outlet, NavLink, Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/app/contexts/AuthContext";
import { prefetchWhenIdle } from "@/utils/idlePrefetch";
import "@/styles/superadmin-enterprise.css";

const NAV_GROUPS = [
  {
    label: "Accesso",
    items: [{ to: "/superadmin/ingresso", label: "Ingresso" }],
  },
  {
    label: "Commercio",
    items: [
      { to: "/superadmin/dashboard", label: "Panoramica" },
      { to: "/superadmin/tenants", label: "Clienti" },
      { to: "/superadmin/piani", label: "Piani e listini" },
      { to: "/superadmin/servizi", label: "Catalogo servizi" },
      { to: "/superadmin/licenses", label: "Abbonamenti" },
    ],
  },
  {
    label: "Go-live",
    items: [
      { to: "/superadmin/deploy-clienti", label: "Deploy siti" },
      { to: "/superadmin/pubblicazione-sito", label: "Pubblicazione dominio" },
    ],
  },
  {
    label: "Piattaforma",
    items: [
      { to: "/superadmin/guide", label: "Documentazione" },
      { to: "/superadmin/sviluppo", label: "Roadmap" },
      { to: "/superadmin/home-pizzeria", label: "Anteprima sito" },
      { to: "/superadmin/settings", label: "Sistema" },
    ],
  },
];

export default function SuperAdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    return prefetchWhenIdle([
      () => import("@/features/superadmin/pages/SuperAdminDashboard"),
      () => import("@/features/superadmin/pages/Tenants"),
      () => import("@/features/superadmin/pages/Piani"),
      () => import("@/features/superadmin/pages/ServiziCatalogo"),
      () => import("@/features/superadmin/pages/Licenses"),
      () => import("@/features/superadmin/pages/DeployClientiPage"),
      () => import("@/features/superadmin/pages/SuperadminPubblicazioneSitoPage"),
      () => import("@/features/superadmin/pages/SuperadminGuideHub"),
      () => import("@/features/superadmin/pages/SuperadminGuideDocPage"),
      () => import("@/features/superadmin/pages/SviluppoPage"),
      () => import("@/features/superadmin/pages/Settings"),
      () => import("@/features/superadmin/pages/SuperadminIngressoPage"),
      () => import("@/features/superadmin/pages/ServizioSchedaPage"),
    ]);
  }, []);

  return (
    <Fragment>
      <header className="superadmin-fixed-bar sa-enterprise-bar" role="banner">
        <div className="sa-bar-row-top">
          <div className="sa-bar-brand-block">
            <Link to="/superadmin/dashboard" className="superadmin-bar-logo">
              PizzaManager
            </Link>
            <span className="sa-enterprise-badge">Console piattaforma</span>
          </div>
          <div className="superadmin-bar-right">
            <span className="superadmin-bar-email" title={user?.email}>
              {user?.email}
            </span>
            <span>Super Admin</span>
            <button
              type="button"
              className="superadmin-bar-logout"
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
        </div>
        <nav className="sa-nav-clustered" aria-label="Navigazione Super Admin">
          {NAV_GROUPS.map((group) => (
            <div key={group.label} className="sa-nav-cluster">
              <span className="sa-nav-cluster-label">{group.label}</span>
              <div className="sa-nav-cluster-links">
                {group.items.map((item) => (
                  <NavLink key={item.to} to={item.to} className={({ isActive }) => (isActive ? "active" : "")}>
                    {item.label}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>
      </header>

      <div className="dashboard-wrap theme-superadmin sa-enterprise-body">
        <main className="dashboard-main" style={{ flex: 1, minWidth: 0 }}>
          <div className="dashboard-content">
            <Outlet />
          </div>
        </main>
      </div>
    </Fragment>
  );
}
