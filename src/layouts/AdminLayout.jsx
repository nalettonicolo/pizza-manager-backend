import { Fragment, useEffect, useMemo, useState, useCallback, useRef } from "react";
import { Outlet, NavLink, Link, useLocation, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "@/app/contexts/AuthContext";
import { useTenant } from "@/app/contexts/TenantContext";
import { usePv } from "@/app/contexts/PvContext";
import { useTenantServizi } from "@/app/hooks/useTenantServizi";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { adminLayoutCssVarsFromTheme, resolveMenuTheme } from "@/utils/tenantMenuTheme";
import { readStampaModalita } from "@/utils/stampaOperativaConfig";
import { prefetchWhenIdle } from "@/utils/idlePrefetch";
import { ADMIN_TENANT_HOME } from "@/constants/adminTenantHome";
import { ADMIN_TOP_NAV } from "@/constants/adminTenantNav";
import { applyTenantFavicon } from "@/utils/tenantFavicon";
import { applyTenantDocumentTitle } from "@/utils/tenantDocumentTitle";
import AgenteChatWidget from "@/features/public/components/AgenteChatWidget";
import CalibrazioneProposalModal from "@/features/admin/components/CalibrazioneProposalModal";
import { isSuperAdminRole } from "@/utils/superAdminAccess";
import { withPreservedSupportSearch } from "@/utils/supportTenantOverride";
import { isDemoGiroSearch } from "@/utils/demoGiro";
import SaHomeButton from "@/components/SaHomeButton";
import AdminGroupedSidebar from "@/components/admin/AdminGroupedSidebar";
import {
  SETTINGS_SIDEBAR_GROUPS,
  MENU_SIDEBAR_GROUPS,
  MAGAZZINO_SIDEBAR_GROUPS,
  CONTABILITA_SIDEBAR_GROUPS,
  CONTABILITA_SEMPLICE_SIDEBAR_GROUPS,
} from "@/constants/adminSidebarGroups";

/**
 * Voci allineate alle route reali (vedi `ADMIN_TOP_NAV`).
 * `servizioId` → filtro piano; nessun redirect forzato senza enforcement.
 */

const settingsSidebarGroups = SETTINGS_SIDEBAR_GROUPS;
const menuSidebarGroups = MENU_SIDEBAR_GROUPS;
const magazzinoSidebarGroups = MAGAZZINO_SIDEBAR_GROUPS;
const contabilitaSidebarGroups = CONTABILITA_SIDEBAR_GROUPS;
const contabilitaSempliceSidebarGroups = CONTABILITA_SEMPLICE_SIDEBAR_GROUPS;

function topNavLinkEnd(item) {
  if (item.end) return true;
  const to = item.to;
  return !(
    to === "/admin/menu" ||
    to === "/admin/settings" ||
    to === "/admin/magazzino" ||
    to === "/admin/contabilita"
  );
}

export default function AdminLayout() {
  const { user, logout, ruolo, tenantId } = useAuth();
  const navigate = useNavigate();
  const { tenantData } = useTenant();
  const { activePv, pvList, loading: pvLoading } = usePv();
  const { hasServizio, enforcementActive, contabilitaMode } = useTenantServizi();
  const location = useLocation();
  const inDemoLive = isDemoGiroSearch(location.search);
  // Con tutte le voci (Home…Guida) + email/ruolo/pulsanti SA a destra, sotto ~1024px la barra
  // inline non ci sta più: meglio il menu a hamburger (già pronto) che uno scroll orizzontale
  // silenzioso e poco scopribile. Prima era 768px: troppo tardi, restava lo scroll nascosto.
  const adminNavCompact = useMediaQuery("(max-width: 1024px)");
  const [adminMobileNavOpen, setAdminMobileNavOpen] = useState(false);
  const closeMobileNav = useCallback(() => setAdminMobileNavOpen(false), []);
  // Fade + freccia a destra quando la barra inline (voci Home…Guida) ha altre voci fuori
  // dallo schermo da scrollare — altrimenti lo scroll orizzontale resta invisibile/non scopribile.
  const [navHasMoreRight, setNavHasMoreRight] = useState(false);
  const navInlineRef = useRef(null);

  const isMenuArea = location.pathname.startsWith("/admin/menu");
  const isSettingsArea = location.pathname.startsWith("/admin/settings");
  const isMagazzinoArea = location.pathname.startsWith("/admin/magazzino");
  const isContabilitaArea = location.pathname.startsWith("/admin/contabilita");
  const showSectionSidebar = isMenuArea || isSettingsArea || isMagazzinoArea || isContabilitaArea;
  // Senza "Con tablet nei reparti" (Impostazioni → Stampa operativa) le comande escono su carta
  // termica: i colori prep Cucina non sono mai visibili da nessuna parte, quindi la voce di
  // configurazione va nascosta invece di far credere che serva a qualcosa.
  const tabletAttivo = readStampaModalita(tenantData?.parametri_operativi) === "con_tablet";
  const menuSidebarGroupsVisibili = useMemo(() => {
    if (tabletAttivo) return menuSidebarGroups;
    return menuSidebarGroups.map((group) => ({
      ...group,
      items: group.items.filter((item) => item.to !== "/admin/menu/prep-cucina-colori"),
    }));
  }, [tabletAttivo]);
  const sidebarGroups = isSettingsArea
    ? settingsSidebarGroups
    : isMenuArea
      ? menuSidebarGroupsVisibili
      : isMagazzinoArea
        ? magazzinoSidebarGroups
        : isContabilitaArea
          ? contabilitaMode === "semplice"
            ? contabilitaSempliceSidebarGroups
            : contabilitaSidebarGroups
          : menuSidebarGroupsVisibili;
  const sidebarLinkEndFor =
    isMagazzinoArea ? "/admin/magazzino" : isContabilitaArea ? "/admin/contabilita" : null;
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
    return ADMIN_TOP_NAV.filter((item) => {
      if (item.to === "/admin/contabilita") {
        if (enforcementActive) {
          return hasServizio("contabilita_locale") || hasServizio("contabilita_semplice");
        }
        return true;
      }
      return !item.servizioId || hasServizio(item.servizioId);
    });
  }, [hasServizio, enforcementActive]);

  useEffect(() => {
    const node = navInlineRef.current;
    if (!node) return undefined;
    const update = () => {
      setNavHasMoreRight(node.scrollWidth - node.clientWidth - node.scrollLeft > 4);
    };
    update();
    node.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(node);
    return () => {
      node.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, [adminNavCompact, visibleTopNav]);

  const blockedRedirect = useMemo(() => {
    if (isSuperAdminRole(ruolo)) return null;
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
  }, [enforcementActive, location.pathname, hasServizio, ruolo]);

  const ruoloKey = (ruolo && String(ruolo).toLowerCase().trim()) || "";
  const adminNeedsPvChoice = !isSuperAdminRole(ruolo) && ruoloKey === "admin" && pvList.length > 1;

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
      () => import("@/features/admin/pages/AdminOrdiniPage"),
      // ManualeUtentePage esclusa apposta: usa react-markdown (+ remark/rehype), ~100KB
      // (chunk vendor-markdown) — prefetch idle su ogni sessione admin forzava Rollup a
      // includere quel chunk nel modulepreload eager di index.html per TUTTI i visitatori
      // (anche vetrina pubblica anonima), dato che AdminLayout è importato eager in AppRouter.
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

  useEffect(() => {
    applyTenantDocumentTitle(brandName, "Admin");
  }, [brandName]);

  if (blockedRedirect) {
    return <Navigate to={`${blockedRedirect}${location.search || ""}`} replace />;
  }

  if (adminNeedsPvChoice && !pvLoading && !activePv) {
    return <Navigate to={`/select-pv${location.search || ""}`} replace />;
  }

  return (
    <Fragment>
      <header className={`admin-fixed-bar${tenantThemeClass}`} role="banner" style={adminThemeStyle}>
        <div className="admin-bar-left">
          <Link to={withPreservedSupportSearch(ADMIN_TENANT_HOME, location.search)} className="admin-bar-logo">
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
            <div className="admin-bar-nav-inline-wrap">
              <nav className="admin-bar-nav-inline" aria-label="Sezioni admin" ref={navInlineRef}>
                {visibleTopNav.map((item) => (
                  <NavLink
                    key={item.to}
                    to={withPreservedSupportSearch(item.to, location.search)}
                    end={topNavLinkEnd(item)}
                    className={({ isActive }) => (isActive ? "active" : "")}
                  >
                    {item.label}
                  </NavLink>
                ))}
              </nav>
              {navHasMoreRight ? (
                <span className="admin-bar-nav-more" aria-hidden>
                  ›
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
        <div className="admin-bar-right" style={{ alignItems: "center", gap: 12 }}>
          <span className="admin-bar-user-email" title={user?.email}>
            {user?.email}
          </span>
          <span className="admin-bar-role-label">{inDemoLive ? "Demo · Admin locale" : "Admin"}</span>
          {isSuperAdminRole(ruolo) ? <SaHomeButton compact={adminNavCompact} /> : null}
          {inDemoLive ? (
            <>
              <Link
                to={withPreservedSupportSearch("/operative/dashboard", location.search)}
                className="admin-bar-logout"
                style={{ textDecoration: "none", display: "inline-flex", alignItems: "center" }}
              >
                Hub demo
              </Link>
            </>
          ) : null}
          {!isSuperAdminRole(ruolo) ? (
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
          ) : null}
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
                  to={withPreservedSupportSearch(item.to, location.search)}
                  end={topNavLinkEnd(item)}
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
          <AdminGroupedSidebar
            title={sidebarTitle}
            groups={sidebarGroups}
            locationSearch={location.search}
            linkEndFor={sidebarLinkEndFor}
          />
        ) : null}
        <main className="dashboard-main" style={{ flex: 1, minWidth: 0 }}>
          <div className="dashboard-content">
            <Outlet />
          </div>
          <p className="dashboard-app-copyright">© 2026 PizzaManager di Naletto Nicolò</p>
        </main>
      </div>
      <AgenteChatWidget modalita="supporto" tenantId={tenantId} utenteId={user?.id} />
      <CalibrazioneProposalModal />
    </Fragment>
  );
}
