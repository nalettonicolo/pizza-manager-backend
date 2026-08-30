import { Fragment, useEffect, useMemo, useState } from "react";
import { Outlet, NavLink, Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/app/contexts/AuthContext";
import { prefetchWhenIdle } from "@/utils/idlePrefetch";
import { ENABLE_TEST_REPARTI } from "@/constants/testReparti";
import {
  resolveSupportTenantOverride,
  withSupportTenantQuery,
} from "@/utils/supportTenantOverride";
import { applyTenantDocumentTitle } from "@/utils/tenantDocumentTitle";
import "@/styles/superadmin-enterprise.css";

const PIATTAFORMA_ITEMS_BASE = [
  { to: "/superadmin/registro-attivita", label: "📋 Registro attività" },
  { to: "/superadmin/azioni-da-completare", label: "⚠️ Azioni da completare" },
  { to: "/superadmin/sala-qa", label: "Sala QA e supporto" },
  { to: "/superadmin/guide", label: "Documentazione" },
  { to: "/superadmin/flussi", label: "Flussi" },
  { to: "/superadmin/auth-email-templates", label: "Template email Auth" },
  { to: "/superadmin/sviluppo", label: "Roadmap" },
  { to: "/superadmin/agenti-moduli", label: "Moduli agenti" },
  { to: "/superadmin/checklist-mese", label: "Chek-Sviluppi" },
  { to: "/superadmin/registratore-cassa", label: "Registratore cassa" },
  { to: "/superadmin/test-layout", label: "Test viewport layout" },
  { to: "/superadmin/settings", label: "Sistema" },
];

const PIATTAFORMA_ITEMS = ENABLE_TEST_REPARTI
  ? [{ to: "/superadmin/test-reparti", label: "Pannello test reparti" }, ...PIATTAFORMA_ITEMS_BASE]
  : PIATTAFORMA_ITEMS_BASE;

/** Menu compatto desktop: solo queste voci in barra; sottovoci in dropdown al passaggio del mouse. */
const NAV_DROPDOWNS = [
  {
    label: "Commerciale",
    items: [
      { to: "/superadmin/dashboard", label: "Panoramica" },
      { to: "/superadmin/tenants", label: "Clienti" },
      { to: "/superadmin/preventivi-contratti", label: "Preventivi e contratti" },
      { to: "/superadmin/piani", label: "Piani e listini" },
      { to: "/superadmin/servizi", label: "Catalogo servizi" },
      { to: "/superadmin/catalogo-hardware", label: "Catalogo Hardware" },
      { to: "/superadmin/licenses", label: "Abbonamenti" },
    ],
  },
  {
    label: "Go Live",
    items: [{ to: "/superadmin/go-live", label: "Go-live cliente" }],
  },
  {
    label: "Marketing",
    items: [
      { to: "/superadmin/marketing/concorrenza", label: "Concorrenza" },
      { to: "/superadmin/marketing/contenuti", label: "Contenuti (blog/landing)" },
      { to: "/superadmin/marketing/ads", label: "Ads" },
    ],
  },
  {
    label: "Piattaforma",
    items: PIATTAFORMA_ITEMS,
  },
];

function pathMatchesItem(pathname, to) {
  if (pathname === to) return true;
  if (to.length > 1 && pathname.startsWith(`${to}/`)) return true;
  return false;
}

function resolveAnteprimaPath() {
  const envId = String(import.meta.env.VITE_PUBLIC_DEMO_TENANT_ID || "").trim();
  const tenantId = resolveSupportTenantOverride() || envId;
  if (tenantId) return withSupportTenantQuery("/preview", tenantId);
  return "/preview";
}

const NAV_ANTEPRIMA = { label: "Anteprima sito" };

function dropdownGroupActive(items, pathname) {
  return items.some((item) => pathMatchesItem(pathname, item.to));
}

const MOBILE_NAV_MQ = "(max-width: 768px)";

export default function SuperAdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const anteprimaTo = useMemo(() => resolveAnteprimaPath(), []);
  const anteprimaActive = useMemo(
    () => pathMatchesItem(location.pathname, "/preview"),
    [location.pathname],
  );

  useEffect(() => {
    setMobileNavOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    applyTenantDocumentTitle(null, "Super Admin");
  }, []);

  useEffect(() => {
    const mq = window.matchMedia(MOBILE_NAV_MQ);
    const onChange = () => {
      if (!mq.matches) setMobileNavOpen(false);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    const mq = window.matchMedia(MOBILE_NAV_MQ);
    if (!mobileNavOpen || !mq.matches) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileNavOpen]);

  useEffect(() => {
    if (!mobileNavOpen) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") setMobileNavOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileNavOpen]);

  useEffect(() => {
    return prefetchWhenIdle([
      () => import("@/features/superadmin/pages/SuperAdminDashboard"),
      () => import("@/features/superadmin/pages/Tenants"),
      () => import("@/features/superadmin/pages/SuperadminTenantArchivioPasswordPage"),
      () => import("@/features/superadmin/pages/Piani"),
      () => import("@/features/superadmin/pages/ServiziCatalogo"),
      () => import("@/features/superadmin/pages/SuperadminCatalogoHardwarePage"),
      () => import("@/features/superadmin/pages/Licenses"),
      () => import("@/features/superadmin/pages/SuperadminGoLivePage"),
      () => import("@/features/superadmin/pages/SuperadminGuideHub"),
      () => import("@/features/superadmin/pages/SuperadminFlussiPage"),
      // SuperadminGuideDocPage esclusa apposta: usa react-markdown (~100KB chunk vendor-markdown)
      // — stesso motivo di ManualeUtentePage in AdminLayout.jsx (vedi commento lì).
      () => import("@/features/superadmin/pages/SviluppoPage"),
      () => import("@/features/superadmin/pages/Settings"),
      () => import("@/features/superadmin/pages/RegistroAttivitaPage"),
      () => import("@/features/superadmin/pages/ServizioSchedaPage"),
      () => import("@/features/superadmin/pages/SuperadminRegistratoreCassaPage"),
      () => import("@/features/superadmin/pages/SuperadminViewportTesterPage"),
      () => import("@/features/superadmin/pages/SuperadminViewportStudioPage"),
      () => import("@/features/superadmin/pages/SuperadminAuthEmailTemplatesPage"),
    ]);
  }, []);

  return (
    <Fragment>
      <header className="superadmin-fixed-bar sa-enterprise-bar" role="banner">
        <div className="sa-bar-row-top">
          <div className="sa-bar-row-left-cluster">
            <div className="sa-bar-brand-block">
              <Link to="/superadmin/ingresso" className="superadmin-bar-logo">
                PizzaManager
              </Link>
              <span className="sa-enterprise-badge">Console piattaforma</span>
            </div>
            <nav
              id="sa-nav-primary"
              className={`sa-nav-clustered sa-nav-compact${mobileNavOpen ? " sa-nav-clustered--open" : ""}`}
              aria-label="Navigazione Super Admin"
            >
              <ul className="sa-nav-compact-list">
                {NAV_DROPDOWNS.map((group) => {
                  const groupActive = dropdownGroupActive(group.items, location.pathname);
                  return (
                    <li
                      key={group.label}
                      className={`sa-nav-dropdown${groupActive ? " sa-nav-dropdown--active" : ""}`}
                    >
                      <button type="button" className="sa-nav-dropdown-trigger" aria-haspopup="true">
                        {group.label}
                      </button>
                      <div className="sa-nav-dropdown-panel" role="group" aria-label={group.label}>
                        {group.items.map((item) => (
                          <NavLink
                            key={item.to}
                            to={item.to}
                            className={({ isActive }) => (isActive ? "active" : "")}
                            onClick={() => setMobileNavOpen(false)}
                          >
                            {item.label}
                          </NavLink>
                        ))}
                      </div>
                    </li>
                  );
                })}
                <li className={`sa-nav-dropdown sa-nav-dropdown--flat${anteprimaActive ? " sa-nav-dropdown--active" : ""}`}>
                  <NavLink
                    to={anteprimaTo}
                    className={({ isActive }) =>
                      `sa-nav-dropdown-trigger sa-nav-anteprima-link${isActive ? " active" : ""}`
                    }
                    onClick={() => setMobileNavOpen(false)}
                  >
                    {NAV_ANTEPRIMA.label}
                  </NavLink>
                </li>
              </ul>
            </nav>
          </div>
          <div className="superadmin-bar-right">
            <span className="superadmin-bar-email" title={user?.email}>
              {user?.email}
            </span>
            <span className="sa-bar-role-label">Super Admin</span>
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
            <button
              type="button"
              className="sa-nav-mobile-toggle"
              aria-expanded={mobileNavOpen}
              aria-controls="sa-nav-primary"
              id="sa-nav-mobile-toggle"
              aria-label={mobileNavOpen ? "Chiudi menu di navigazione" : "Apri menu di navigazione"}
              onClick={() => setMobileNavOpen((o) => !o)}
            >
              <span className="sa-nav-mobile-toggle-icon" aria-hidden>
                <span />
                <span />
                <span />
              </span>
              <span className="sa-nav-mobile-toggle-text">Menu</span>
            </button>
          </div>
        </div>
        {mobileNavOpen ? (
          <div
            className="sa-mobile-nav-backdrop"
            role="presentation"
            onClick={() => setMobileNavOpen(false)}
          />
        ) : null}
      </header>

      <div className="dashboard-wrap theme-superadmin sa-enterprise-body">
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
