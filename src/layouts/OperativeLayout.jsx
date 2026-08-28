import { Outlet, NavLink, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { useAuth } from "@/app/contexts/AuthContext";
import { useTenant } from "@/app/contexts/TenantContext";
import { isCucinaTabletAbilitato } from "@/utils/cucinaTabletConfig";
import { CassaHeaderContext } from "@/app/contexts/CassaHeaderContext";
import { adminLayoutCssVarsFromTheme, resolveMenuTheme } from "@/utils/tenantMenuTheme";
import {
  useAutoFullscreenOnTablet,
  requestBrowserFullscreen,
  isTabletLike,
} from "@/hooks/usePizzaioloFullscreen";
import { OPERATIVE_ROLE_HOME, PIZZAIOLO_TEST_INGRESSO_PATH } from "@/constants/operativeRoutes";
import { PERMESSI_TUTTE_AREE } from "@/constants/testReparti";
import { isDefaultAreaForRole } from "@/utils/operativeAreaAccess";
import { useTenantServizi } from "@/app/hooks/useTenantServizi";
import { OPERATIVE_AREA_NAV, OPERATIVE_NAV_GROUPS, groupOperativeNavItems } from "@/constants/operativeNav";
import { findOperativeNavItemForPath, resolveFirstOperativePath } from "@/utils/operativePathEligibility";
import { labelFromEmailPrefix } from "@/utils/emailDisplayLabel";
import { prefetchWhenIdle } from "@/utils/idlePrefetch";
import { isQuadRepartiTestEmail } from "@/constants/quadRepartiTest";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { applyTenantFavicon } from "@/utils/tenantFavicon";
import { applyTenantDocumentTitle } from "@/utils/tenantDocumentTitle";
import { isQaSupportSearch } from "@/utils/viewportLayoutPreview";
import { withPreservedSupportSearch } from "@/utils/supportTenantOverride";
import { isSuperAdminRole } from "@/utils/superAdminAccess";
import { useOperativeSaDemoAccess } from "@/app/hooks/useOperativeSaDemoAccess";
import { useKioskAutoLogout } from "@/features/operative/hooks/useKioskAutoLogout";
import { ADMIN_TENANT_HOME } from "@/constants/adminTenantHome";
import { DEMO_GIRO_ADMIN_LINKS, isDemoGiroSessionActive, withDemoGiroQuery } from "@/utils/demoGiro";
import { openDemoClienteArea } from "@/utils/demoClienteSession";
import SaHomeButton from "@/components/SaHomeButton";
import LiveClock from "@/components/LiveClock";
import CassaStressTestButton from "@/features/operative/cassa/components/CassaStressTestButton";
import { resolveSupportTenantOverride } from "@/utils/supportTenantOverride";

const ROLE_NAV = OPERATIVE_AREA_NAV;

function pathMatchesNavTo(pathname, to) {
  return pathname === to || (to.length > 1 && pathname.startsWith(`${to}/`));
}

function OperativeNavGroup({ id, label, open, children }) {
  return (
    <details className="operative-nav-group" open={open || undefined} data-group={id}>
      <summary className="operative-nav-group-summary">{label}</summary>
      <div className="operative-nav-group-links">{children}</div>
    </details>
  );
}

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
  const { user, logout, ruolo } = useAuth();
  const navigate = useNavigate();
  const { tenantData } = useTenant();
  const kioskMinuti = Number(tenantData?.parametri_operativi?.kiosk_logout_minuti);
  useKioskAutoLogout({
    enabled: Number.isFinite(kioskMinuti) && kioskMinuti > 0,
    timeoutMin: Number.isFinite(kioskMinuti) && kioskMinuti > 0 ? kioskMinuti : 5,
  });
  const { hasServizio } = useTenantServizi();
  const location = useLocation();
  const { permessiAreeEffective, inDemoLive, fullDemoAccess } = useOperativeSaDemoAccess();
  const cucinaTabletOn = isCucinaTabletAbilitato(tenantData?.parametri_operativi);

  const resolvedTenantTheme = resolveMenuTheme(tenantData?.parametri_operativi);
  const themeStyle = adminLayoutCssVarsFromTheme(resolvedTenantTheme);
  const tenantThemeClass = resolvedTenantTheme ? " tenant-theme-on" : "";
  const logoUrl = tenantData?.logo_url ?? null;
  const brandName = tenantData?.nome || "Pizzeria";

  useEffect(() => {
    void applyTenantFavicon(logoUrl);
  }, [logoUrl]);

  useEffect(() => {
    applyTenantDocumentTitle(brandName, "Operativo");
  }, [brandName]);

  /** Ripristina `_demo_giro=1` in URL se perso da navigate() interni (es. Cassa → Stampanti). */
  useEffect(() => {
    if (!isDemoGiroSessionActive()) return;
    try {
      const q = location.search.startsWith("?") ? location.search.slice(1) : location.search;
      if (new URLSearchParams(q).get("_demo_giro") === "1") return;
    } catch {
      /* ignore */
    }
    const tenantId = resolveSupportTenantOverride(location.search);
    if (!tenantId) return;
    navigate(withDemoGiroQuery(`${location.pathname}${location.hash || ""}`, tenantId), { replace: true });
  }, [location.pathname, location.search, location.hash, navigate]);

  const ruoloKey = typeof ruolo === "string" ? ruolo.toLowerCase().trim() : "";
  const isSaSupport =
    ruoloKey === "superadmin" &&
    (isQaSupportSearch(location.search) || Boolean(new URLSearchParams(location.search).get("support_tenant")));
  const defaultPath =
    isQuadRepartiTestEmail(user?.email) && ruoloKey === "pizzaiolo"
      ? PIZZAIOLO_TEST_INGRESSO_PATH
      : OPERATIVE_ROLE_HOME[ruoloKey] || "/operative/dashboard";
  const permessiForNav = isQuadRepartiTestEmail(user?.email)
    ? PERMESSI_TUTTE_AREE
    : permessiAreeEffective;
  const navItemsRaw = permessiForNav
    ? ROLE_NAV.filter((item) => {
        if (item.areaKey === "cucina" && !cucinaTabletOn) return false
        // Demo / SA: non nascondere voci per piano servizi
        if (
          item.servizioId &&
          !hasServizio(item.servizioId) &&
          !isQuadRepartiTestEmail(user?.email) &&
          !fullDemoAccess
        ) {
          return false;
        }
        if (item.areaKey === "delivery") {
          return permessiForNav.delivery === true || permessiForNav.pony === true;
        }
        return permessiForNav[item.areaKey] === true;
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
  const firstAllowedPath = resolveFirstOperativePath(navItems, defaultPath, permessiForNav, hasServizio);
  const isSaUser = isSuperAdminRole(ruolo);
  const showQuadLink = isSaUser || inDemoLive || fullDemoAccess;
  /** Area cliente / vetrina in sidebar: solo Super Admin in Demo live. */
  const showClienteShortcuts = isSaUser && inDemoLive;
  const showAdminLinks = fullDemoAccess || inDemoLive || isSaSupport;
  const clienteShortcutLinks = DEMO_GIRO_ADMIN_LINKS.filter((l) => l.group === "strumenti");
  const navGroups = (() => {
    const byId = new Map(groupOperativeNavItems(navItems).map((g) => [g.id, { ...g, items: [...g.items] }]));
    const ensure = (id, label, extras) => {
      if (!extras.length) return;
      if (byId.has(id)) {
        byId.get(id).items.push(...extras);
      } else {
        byId.set(id, { id, label, items: extras });
      }
    };
    ensure("strumenti", "Strumenti", [
      ...(showQuadLink
        ? [
            {
              to: "/operative/test-reparti-quad",
              label: "4 schermate",
              description: "Pizzaioli, bancone, cucina e delivery insieme",
            },
          ]
        : []),
    ]);
    ensure(
      "admin",
      "Admin del locale",
      showAdminLinks
        ? DEMO_GIRO_ADMIN_LINKS.filter((l) => l.group === "admin").map((l) => ({
            to: l.path === "/admin/home" ? ADMIN_TENANT_HOME : l.path,
            label: l.label,
            description: l.description || "",
          }))
        : [],
    );
    return OPERATIVE_NAV_GROUPS.map((meta) => byId.get(meta.id)).filter(Boolean);
  })();
  const currentAreaKey = getAreaKeyForPath(location.pathname);
  const currentNavMatch = findOperativeNavItemForPath(location.pathname);
  const servizioOk =
    fullDemoAccess ||
    isQuadRepartiTestEmail(user?.email) ||
    !currentNavMatch?.servizioId ||
    hasServizio(currentNavMatch.servizioId);
  const canAccessCurrent =
    Boolean(permessiForNav) &&
    servizioOk &&
    (!currentAreaKey ||
      (currentAreaKey === "delivery"
        ? permessiForNav.delivery === true || permessiForNav.pony === true
        : permessiForNav[currentAreaKey] === true));
  const operatoreLabel = labelFromEmailPrefix(user?.email ?? "");
  const isCassaPage = location.pathname === "/operative/cassa" || location.pathname.startsWith("/operative/cassa/");
  const isDemoHubPage = location.pathname === "/operative/dashboard";
  const isPizzaioloPage = location.pathname === "/operative/pizzaioli";
  const isCucinaPage = location.pathname === "/operative/cucina";
  const isBanconePage = location.pathname === "/operative/bancone";
  const isDeliveryFlowPage = location.pathname === "/operative/delivery" || location.pathname === "/operative/rider";
  const isRepartiQuadTestPage = location.pathname === "/operative/test-reparti-quad";
  const isOperativeIngressoPage = location.pathname.endsWith("-ingresso");
  /** Mappa live pony: ha già la sua intestazione compatta con link "← Lista delivery" — sidebar,
   * header e footer copyright dell'area operativa la spingevano oltre l'altezza schermo (100dvh
   * proprio + quello sopra/sotto = scroll di pagina su una mappa pensata per stare tutta a vista). */
  const isDeliveryMapPage = location.pathname === "/operative/delivery/mappa";
  /** SA / demo / Sala QA: sidebar sempre utile per cambiare reparto (niente full-bleed pizzaiolo). */
  const keepOperativeSidebar =
    fullDemoAccess || ruoloKey === "superadmin" || isSaSupport || inDemoLive || isSuperAdminRole(ruolo);
  /** Reparti "da tablet/app" — schermate pensate per stare montate fisse in sala/cucina, non per
   * navigare tra sezioni: schermo pieno SEMPRE (anche per Super Admin/demo, su richiesta esplicita
   * — prima restava con menu laterale per poter cambiare reparto al volo), con una barra minima
   * (orologio + uscita) al posto del menu completo. Cassa resta esclusa per ora: ha una sua
   * toolbar (Ordini/Planning/Live) iniettata nell'header che andrebbe prima spostata dentro la
   * barra flottante. */
  const isRepartoTabletPage = isPizzaioloPage || isCucinaPage || isBanconePage || isDeliveryFlowPage;
  const operativeFullBleed =
    isRepartoTabletPage ||
    isRepartiQuadTestPage ||
    isOperativeIngressoPage ||
    isDeliveryMapPage;
  const [cassaToolbar, setCassaToolbar] = useState(null);
  const [cassaSidebar, setCassaSidebar] = useState(null);
  const [tabletLike, setTabletLike] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  /** Alias stabile per effetti/HMR (evita ReferenceError se un bundle stale usa il nome precedente). */
  const setMobileSidebarOpen = setSidebarOpen;
  const narrowViewport = useMediaQuery("(max-width: 900px)");
  /** Sidebar nascosta di default: si apre con ☰ (desktop e mobile). */
  const useDrawerSidebar = !operativeFullBleed;
  const matchedNavItem = [...ROLE_NAV]
    .sort((a, b) => b.to.length - a.to.length)
    .find(
      (item) =>
        location.pathname === item.to || location.pathname.startsWith(`${item.to}/`)
    );
  const headerSubtitle = matchedNavItem?.label ?? "";
  const headerTitle = headerSubtitle ? `Area operativa — ${headerSubtitle}` : `Area operativa${operatoreLabel ? ` — ${operatoreLabel}` : ""}`;
  const headerTitleCompact = headerSubtitle || (operatoreLabel ? operatoreLabel : "Area operativa");

  useAutoFullscreenOnTablet(isPizzaioloPage && !keepOperativeSidebar);

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

  useEffect(() => {
    setMobileSidebarOpen(false);
  }, [location.pathname, setMobileSidebarOpen]);

  useEffect(() => {
    if (!sidebarOpen) return;
    const onKey = (e) => {
      if (e.key === "Escape") setMobileSidebarOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sidebarOpen, setMobileSidebarOpen]);

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  useEffect(() => {
    return prefetchWhenIdle([
      () => import("@/features/operative/pages/OperativeDashboard"),
      () => import("@/features/operative/cassa/pages/CassaPage"),
      () => import("@/features/operative/cucina/pages/Cucina"),
      () => import("@/features/operative/bancone/pages/Bancone"),
      () => import("@/features/operative/delivery/pages/DeliveryDashboard"),
      () => import("@/features/operative/pizzaiolo/pages/Dashboard"),
    ]);
  }, []);

  // Evita schermata vuota / “Nessuna area” mentre il ruolo SA non è ancora risolto (iframe Sala QA).
  if (!ruoloKey) {
    return (
      <div className={`dashboard-wrap theme-admin${tenantThemeClass}`} style={themeStyle}>
        <main className="dashboard-main" style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <p style={{ color: "#64748b", fontSize: 14 }}>Accesso in corso…</p>
        </main>
      </div>
    );
  }

  if (!firstAllowedPath && ruoloKey !== "superadmin") {
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
          <p className="dashboard-app-copyright">© 2026 PizzaManager di Naletto Nicolò</p>
        </main>
      </div>
    );
  }

  if (location.pathname === "/operative" || location.pathname === "/operative/") {
    const homeOp =
      isQuadRepartiTestEmail(user?.email) ? "/operative/pizzaiolo-ingresso" : firstAllowedPath || "/operative/cassa";
    return <Navigate to={`${homeOp}${location.search || ""}`} replace />;
  }
  if (!canAccessCurrent && firstAllowedPath && ruoloKey !== "superadmin" && !isSaSupport && !fullDemoAccess && !inDemoLive) {
    return <Navigate to={`${firstAllowedPath}${location.search || ""}`} replace />;
  }
  // Sala QA / support_tenant: evita layout cassa-mobile (min-height:0 + overflow hidden)
  // che in iframe/popup collassa il contenuto a schermo beige vuoto.
  // Stessa condizione di CassaPage (`isQaSupportSearch`), non solo SA+override.
  const qaSupportPreview = isQaSupportSearch(location.search);
  const useCassaMobileShell = isCassaPage && narrowViewport && !qaSupportPreview;
  const wrapClass = [
    "dashboard-wrap",
    "theme-admin",
    tenantThemeClass.trim(),
    operativeFullBleed ? "pizzaiolo-fullscreen" : "",
    useDrawerSidebar ? "dashboard-wrap--drawer-sidebar" : "",
    useCassaMobileShell ? "dashboard-wrap--cassa-mobile" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={wrapClass} style={themeStyle}>
      {useDrawerSidebar && sidebarOpen ? (
        <button
          type="button"
          className="operative-drawer-backdrop"
          aria-label="Chiudi menu"
          onClick={() => setSidebarOpen(false)}
        />
      ) : null}
      {!operativeFullBleed && (
        <aside
          className={`dashboard-sidebar${useDrawerSidebar ? " dashboard-sidebar--drawer" : ""}${sidebarOpen ? " is-open" : ""}`}
          aria-hidden={useDrawerSidebar && !sidebarOpen ? true : undefined}
        >
          {useDrawerSidebar ? (
            <div className="operative-sidebar-drawer-close">
              <button type="button" onClick={() => setSidebarOpen(false)} aria-label="Chiudi menu">
                ✕
              </button>
            </div>
          ) : null}
          {logoUrl && (
            <div style={{ marginBottom: 16, textAlign: "center" }}>
              <img src={logoUrl} alt={brandName} style={{ maxWidth: "100%", maxHeight: 48, objectFit: "contain" }} />
            </div>
          )}
          <h2 className="dashboard-sidebar-title">
            {inDemoLive ? "Demo live" : "Area operativa"}
          </h2>
          {inDemoLive ? (
            <p className="operative-demo-lede">
              Qui sotto: vista <strong>cliente</strong>. Più in basso: reparti sala e admin del locale.
            </p>
          ) : null}
          {showClienteShortcuts ? (
            <div className="operative-sa-demo-shortcuts" aria-label="Vista cliente">
              <p className="operative-sa-demo-shortcuts-kicker">Vista cliente</p>
              {clienteShortcutLinks.map((l) => (
                <NavLink
                  key={`${l.label}:${l.path}`}
                  to={withPreservedSupportSearch(l.path, location.search)}
                  className={({ isActive }) =>
                    `operative-sa-demo-shortcut${isActive ? " active" : ""}`
                  }
                  onClick={(e) => {
                    if (!l.demoClienteLogin) {
                      setSidebarOpen(false)
                      return
                    }
                    e.preventDefault()
                    void (async () => {
                      const tid =
                        resolveSupportTenantOverride() ||
                        String(import.meta.env.VITE_PUBLIC_DEMO_TENANT_ID || "").trim()
                      const login = await openDemoClienteArea(tid, "/preview")
                      if (!login.ok) {
                        alert(login.error)
                        return
                      }
                      setSidebarOpen(false)
                    })()
                  }}
                >
                  <span className="operative-sa-demo-shortcut-label">{l.label}</span>
                  {l.description ? (
                    <span className="operative-sa-demo-shortcut-desc">{l.description}</span>
                  ) : null}
                </NavLink>
              ))}
            </div>
          ) : null}
          <nav
            id="operative-sidebar-nav"
            className={`operative-sidebar-nav${inDemoLive ? " operative-sidebar-nav--demo-cards" : ""}`}
          >
            {navGroups.map((group) => {
              const hasActive = group.items.some((item) => pathMatchesNavTo(location.pathname, item.to));
              const defaultOpen =
                hasActive ||
                group.id === "panoramica" ||
                group.id === "reparti" ||
                (inDemoLive && (group.id === "admin" || group.id === "strumenti")) ||
                (group.id === "cassa" &&
                  (location.pathname === "/operative/cassa" ||
                    location.pathname.startsWith("/operative/cassa/") ||
                    location.pathname.startsWith("/operative/turni")));
              return (
                <OperativeNavGroup
                  key={`${group.id}-${location.pathname}`}
                  id={group.id}
                  label={inDemoLive && group.id === "admin" ? "Admin del locale" : group.label}
                  open={defaultOpen}
                >
                  {group.id === "cassa" && isCassaPage && cassaSidebar ? (
                    <div
                      className={`operative-nav-group-cassa-slot${inDemoLive ? " operative-nav-group-cassa-slot--demo" : ""}`}
                    >
                      {cassaSidebar}
                    </div>
                  ) : null}
                  {group.items.map((item) => (
                    <NavLink
                      key={item.to}
                      to={withPreservedSupportSearch(item.to, location.search)}
                      end={item.to === "/operative/cassa"}
                      className={({ isActive }) =>
                        inDemoLive
                          ? `operative-sa-demo-shortcut${isActive ? " active" : ""}`
                          : isActive
                            ? "active"
                            : ""
                      }
                      onClick={() => setSidebarOpen(false)}
                    >
                      {inDemoLive ? (
                        <>
                          <span className="operative-sa-demo-shortcut-label">{item.label}</span>
                          {item.description ? (
                            <span className="operative-sa-demo-shortcut-desc">{item.description}</span>
                          ) : null}
                        </>
                      ) : (
                        item.label
                      )}
                    </NavLink>
                  ))}
                </OperativeNavGroup>
              );
            })}
          </nav>
          <div className="dashboard-sidebar-footer">
            <p className="user-email" title={user?.email}>{operatoreLabel || user?.email}</p>
            {ruoloKey ? (
              <p className="user-role-line" title="Ruolo assegnato in Admin → Dipendenti / Ruoli">
                Ruolo: {RUOLO_SIDEBAR_LABEL[ruoloKey] ?? ruoloKey}
              </p>
            ) : null}
            {isSaUser || inDemoLive ? (
              <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                <SaHomeButton mode={inDemoLive && !isDemoHubPage ? "demoHub" : "ingresso"} />
              </div>
            ) : null}
          </div>
        </aside>
      )}
      <div className={`dashboard-main${operativeFullBleed ? " pizzaiolo-fullscreen-main" : ""}`}>
        <CassaHeaderContext.Provider value={{ setContent: setCassaToolbar, setSidebar: setCassaSidebar }}>
          {isRepartoTabletPage && operativeFullBleed && (
            <div className="pizzaiolo-floating-bar" role="toolbar" aria-label="Azioni reparto">
              <LiveClock />
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
              {isSaUser || inDemoLive || fullDemoAccess ? (
                <SaHomeButton compact mode={inDemoLive ? "demoHub" : "ingresso"} />
              ) : null}
              <button type="button" className="btn-logout btn-logout-red" onClick={() => void handleLogout()}>
                Esci
              </button>
            </div>
          )}
          {!operativeFullBleed && (
            <header className="dashboard-header">
              {useDrawerSidebar ? (
                <button
                  type="button"
                  className="operative-mobile-menu-btn"
                  onClick={() => setSidebarOpen((v) => !v)}
                  aria-expanded={sidebarOpen}
                  aria-controls="operative-sidebar-nav"
                  aria-label={sidebarOpen ? "Chiudi menu di navigazione" : "Apri menu di navigazione"}
                >
                  <span className="operative-hamburger-icon" aria-hidden>
                    <span />
                    <span />
                    <span />
                  </span>
                </button>
              ) : null}
              <h1 className="dashboard-header-title">{narrowViewport ? headerTitleCompact : headerTitle}</h1>
              {isCassaPage && (
                <div
                  className={`dashboard-header-toolbar${narrowViewport ? " cassa-header-toolbar-scroll" : ""}`}
                  style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 0, margin: "0 16px", justifyContent: "flex-start" }}
                >
                  {cassaToolbar}
                </div>
              )}
              <div className="dashboard-header-actions">
                {isCassaPage && (inDemoLive || fullDemoAccess) ? <CassaStressTestButton /> : null}
                {isSaUser ? (
                  // Sull'hub demo stesso "torna all'hub demo" è ridondante (ci siamo già): qui
                  // mostriamo la via di uscita vera verso l'ingresso Super Admin.
                  <SaHomeButton compact={narrowViewport} mode={inDemoLive && !isDemoHubPage ? "demoHub" : "ingresso"} />
                ) : null}
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
        <p className="dashboard-app-copyright">© 2026 PizzaManager di Naletto Nicolò</p>
      </div>
    </div>
  );
}
