import { lazy, Suspense } from "react";
import { Routes, Route, Navigate, Outlet } from "react-router-dom";
import { ENABLE_TEST_REPARTI } from "@/constants/testReparti";
import { ADMIN_TENANT_HOME } from "@/constants/adminTenantHome";

/* ================= LAYOUT ================= */
import PublicLayout from "@/layouts/PublicLayout";
import AdminLayout from "@/layouts/AdminLayout";
import SuperAdminLayout from "@/layouts/SuperAdminLayout";
import OperativeLayout from "@/layouts/OperativeLayout";

/* ================= GUARDS ================= */
import ProtectedRoute from "@/components/ProtectedRoute";
import ClienteRoute from "@/components/ClienteRoute";
import RoleLayout from "@/layouts/RoleLayout";

/* ================= PUBLIC (SaaS) ================= */
import Landing from "@/features/public/pages/Landing";
import PublicStore from "@/features/public/pages/PublicStore";
import Home from "@/features/public/pages/Home";
import Contatti from "@/features/public/pages/Contatti";
import PrivacyPolicy from "@/features/public/pages/PrivacyPolicy";
import CookiePolicy from "@/features/public/pages/CookiePolicy";
import TerminiCondizioni from "@/features/public/pages/TerminiCondizioni";
import Support from "@/features/public/pages/Support";
import SelectPuntoVendita from "@/features/public/pages/SelectPuntoVendita";
import WebAppPreview from "@/features/public/pages/WebAppPreview";

/* ================= SUPERADMIN (lazy) ================= */
const Login = lazy(() => import("@/features/public/pages/Login"));
const ClienteRegistrazionePage = lazy(() => import("@/features/public/pages/ClienteRegistrazionePage"));
const ClientePasswordDimenticataPage = lazy(() => import("@/features/public/pages/ClientePasswordDimenticataPage"));
const ClienteReimpostaPasswordPage = lazy(() => import("@/features/public/pages/ClienteReimpostaPasswordPage"));
const ClienteDashboardPage = lazy(() => import("@/features/public/pages/ClienteDashboardPage"));
const ClienteOrdiniPage = lazy(() => import("@/features/public/pages/ClienteOrdiniPage"));
const ClienteProfiloPage = lazy(() => import("@/features/public/pages/ClienteProfiloPage"));
const SuperAdminDashboard = lazy(() => import("@/features/superadmin/pages/SuperAdminDashboard"));
const Licenses = lazy(() => import("@/features/superadmin/pages/Licenses"));
const Tenants = lazy(() => import("@/features/superadmin/pages/Tenants"));
const Settings = lazy(() => import("@/features/superadmin/pages/Settings"));
const Piani = lazy(() => import("@/features/superadmin/pages/Piani"));
const ServiziCatalogo = lazy(() => import("@/features/superadmin/pages/ServiziCatalogo"));
const DeployClientiPage = lazy(() => import("@/features/superadmin/pages/DeployClientiPage"));
const SuperadminPubblicazioneSitoPage = lazy(() => import("@/features/superadmin/pages/SuperadminPubblicazioneSitoPage"));
const SuperadminGuideHub = lazy(() => import("@/features/superadmin/pages/SuperadminGuideHub"));
const SuperadminGuideDocPage = lazy(() => import("@/features/superadmin/pages/SuperadminGuideDocPage"));
const SviluppoPage = lazy(() => import("@/features/superadmin/pages/SviluppoPage"));
const ServizioSchedaPage = lazy(() => import("@/features/superadmin/pages/ServizioSchedaPage"));
const SuperadminIngressoPage = lazy(() => import("@/features/superadmin/pages/SuperadminIngressoPage"));
const TestRepartiPanelPage = lazy(() => import("@/features/superadmin/pages/TestRepartiPanelPage"));

/* ================= ADMIN (lazy) ================= */
const Report = lazy(() => import("@/features/admin/pages/Report"));
const RuoliPage = lazy(() => import("@/features/admin/pages/RuoliPage"));
const SettingsLayout = lazy(() => import("@/features/admin/pages/settings/SettingsLayout"));
const DatiPizzeriaSection = lazy(() => import("@/features/admin/pages/settings/DatiPizzeriaSection"));
const LayoutSection = lazy(() => import("@/features/admin/pages/settings/LayoutSection"));
const OrariSection = lazy(() => import("@/features/admin/pages/settings/OrariSection"));
const ParametriSection = lazy(() => import("@/features/admin/pages/settings/ParametriSection"));
const CategoriePage = lazy(() => import("@/features/admin/pages/menu/CategoriePage"));
const FormatiPage = lazy(() => import("@/features/admin/pages/menu/FormatiPage"));
const CotturaPage = lazy(() => import("@/features/admin/pages/menu/CotturaPage"));
const PizzePage = lazy(() => import("@/features/admin/pages/menu/PizzePage"));
const IngredientiPage = lazy(() => import("@/features/admin/pages/menu/IngredientiPage"));
const ImpastiPage = lazy(() => import("@/features/admin/pages/menu/ImpastiPage"));
const BibitePage = lazy(() => import("@/features/admin/pages/menu/BibitePage"));
const DolciPage = lazy(() => import("@/features/admin/pages/menu/DolciPage"));
const FrittiPage = lazy(() => import("@/features/admin/pages/menu/FrittiPage"));
const AllergeniPage = lazy(() => import("@/features/admin/pages/menu/AllergeniPage"));
const UserManager = lazy(() => import("@/features/admin/pages/UserManager"));
const ManualeUtentePage = lazy(() => import("@/features/admin/pages/ManualeUtentePage"));
const MagazzinoHubPage = lazy(() => import("@/features/admin/pages/magazzino/MagazzinoHubPage"));
const OrdiniFornitoriPage = lazy(() => import("@/features/admin/pages/magazzino/OrdiniFornitoriPage"));
const DdtPage = lazy(() => import("@/features/admin/pages/magazzino/DdtPage"));
const ContabilitaHubPage = lazy(() => import("@/features/admin/pages/contabilita/ContabilitaHubPage"));
const FatturePage = lazy(() => import("@/features/admin/pages/contabilita/FatturePage"));
const PagamentiFatturePage = lazy(() => import("@/features/admin/pages/contabilita/PagamentiFatturePage"));
const FoodCostPage = lazy(() => import("@/features/admin/pages/contabilita/FoodCostPage"));
const SpeseLocalePage = lazy(() => import("@/features/admin/pages/contabilita/SpeseLocalePage"));
const SpesePersonalePage = lazy(() => import("@/features/admin/pages/contabilita/SpesePersonalePage"));
const GestioneIncassiPage = lazy(() => import("@/features/admin/pages/contabilita/GestioneIncassiPage"));
const FidelityCardPage = lazy(() => import("@/features/admin/pages/FidelityCardPage"));

/* ================= OPERATIVE (lazy) ================= */
const OperativeDashboard = lazy(() => import("@/features/operative/pages/OperativeDashboard"));
const CassaPage = lazy(() => import("@/features/operative/cassa/pages/CassaPage"));
const ProdottiEsauritiPage = lazy(() => import("@/features/operative/cassa/pages/ProdottiEsauritiPage"));
const CassaFidelityPage = lazy(() => import("@/features/operative/cassa/pages/CassaFidelityPage"));
const Cucina = lazy(() => import("@/features/operative/cucina/pages/Cucina"));
const Bancone = lazy(() => import("@/features/operative/bancone/pages/Bancone"));
const DeliveryDashboard = lazy(() => import("@/features/operative/delivery/pages/DeliveryDashboard"));
const PizzaioloDashboard = lazy(() => import("@/features/operative/pizzaiolo/pages/Dashboard"));
const OperativeTurniPage = lazy(() => import("@/features/operative/pages/OperativeTurniPage"));

/* ================= LEGACY ================= */
import OrdinePage from "@/pages/OrdinePage";
import OrdineConfermato from "@/pages/OrdineConfermato";

const PageFallback = () => <div className="p-6 flex items-center justify-center min-h-[120px]"><span className="text-gray-400 text-sm">Caricamento...</span></div>;

const SUPERADMIN_HEADER_PX = 56;

/** Stesso guscio di SuperAdminLayout senza la barra di navigazione (solo per Ingresso). */
function SuperadminIngressoRouteShell() {
  return (
    <div className="dashboard-wrap theme-superadmin" style={{ paddingTop: SUPERADMIN_HEADER_PX }}>
      <main className="dashboard-main" style={{ flex: 1, minWidth: 0 }}>
        <div className="dashboard-content">
          <Suspense fallback={<PageFallback />}>
            <SuperadminIngressoPage />
          </Suspense>
        </div>
      </main>
    </div>
  );
}

const OPERATIVE_ROLES = ["operatore", "cassa", "bancone", "cucina", "pony", "delivery", "pizzaiolo"];
/** In dev o con VITE_ENABLE_TEST_REPARTI: superadmin può aprire le schermate operative (pannello test iframe). */
const OPERATIVE_ROLES_WITH_SUPERADMIN_TEST = ENABLE_TEST_REPARTI ? [...OPERATIVE_ROLES, "superadmin"] : OPERATIVE_ROLES;

/* =========================================================
   HOST DETECTION
========================================================= */

const host = window.location.hostname;

const isLocal =
  host.includes("localhost") ||
  host.includes("127.0.0.1");

const isSupportHost = host === "support.pizzamanager.it";

const isSaaS =
  host === "pizzamanager.it" ||
  host.startsWith("app.") ||
  isSupportHost ||
  isLocal;

/* =========================================================
   HOST RESOLVER
========================================================= */

function RootResolver() {
  if (isSupportHost) {
    return <Support />;
  }
  if (isSaaS) {
    return <Landing />;
  }

  return <PublicStore />;
}

/* =========================================================
   ROUTER
========================================================= */

export default function AppRouter() {
  return (
    <Routes>

      {/* =================================================
          PUBLIC AREA (SaaS + Public Store entry)
      ================================================= */}

      <Route element={<PublicLayout />}>
        <Route path="/" element={<RootResolver />} />
        <Route
          path="/login"
          element={
            <Suspense fallback={<PageFallback />}>
              <Login />
            </Suspense>
          }
        />

        {!isSaaS && (
          <>
            <Route
              path="/registrazione"
              element={
                <Suspense fallback={<PageFallback />}>
                  <ClienteRegistrazionePage />
                </Suspense>
              }
            />
            <Route
              path="/password-dimenticata"
              element={
                <Suspense fallback={<PageFallback />}>
                  <ClientePasswordDimenticataPage />
                </Suspense>
              }
            />
            <Route
              path="/reimposta-password"
              element={
                <Suspense fallback={<PageFallback />}>
                  <ClienteReimpostaPasswordPage />
                </Suspense>
              }
            />
          </>
        )}

        <Route element={<ClienteRoute />}>
          <Route
            path="/cliente/dashboard"
            element={
              <Suspense fallback={<PageFallback />}>
                <ClienteDashboardPage />
              </Suspense>
            }
          />
          <Route
            path="/cliente/ordini"
            element={
              <Suspense fallback={<PageFallback />}>
                <ClienteOrdiniPage />
              </Suspense>
            }
          />
          <Route
            path="/cliente/profilo"
            element={
              <Suspense fallback={<PageFallback />}>
                <ClienteProfiloPage />
              </Suspense>
            }
          />
        </Route>

        <Route path="/privacy" element={<PrivacyPolicy />} />
        <Route path="/cookie" element={<CookiePolicy />} />
        <Route path="/termini" element={<TerminiCondizioni />} />

        {/* Queste route esistono SOLO nel SaaS */}
        {isSaaS && (
          <>
            <Route path="/negozio" element={<PublicStore />} />
            <Route path="/contatti" element={<Contatti />} />
            <Route path="/support" element={<Support />} />
            <Route path="/select-pv" element={<SelectPuntoVendita />} />
            <Route path="/preview" element={<WebAppPreview />} />
          </>
        )}
      </Route>

      {/* =================================================
          SUPERADMIN
      ================================================= */}

      {isSaaS && (
        <Route
          element={
            <ProtectedRoute allowedRoles={["superadmin"]}>
              <RoleLayout allowedRoles={["superadmin"]}>
                <Outlet />
              </RoleLayout>
            </ProtectedRoute>
          }
        >
          {/* Ingresso: fuori da SuperAdminLayout così la nav completa non viene mai montata (non dipende dal pathname). */}
          <Route path="/superadmin/ingresso" element={<SuperadminIngressoRouteShell />} />
          <Route element={<SuperAdminLayout />}>
            <Route path="/superadmin" element={<Navigate to="/superadmin/ingresso" replace />} />
            <Route path="/superadmin/test-reparti" element={<Suspense fallback={<PageFallback />}><TestRepartiPanelPage /></Suspense>} />
            <Route path="/superadmin/dashboard" element={<Suspense fallback={<PageFallback />}><SuperAdminDashboard /></Suspense>} />
            <Route path="/superadmin/tenants" element={<Suspense fallback={<PageFallback />}><Tenants /></Suspense>} />
            <Route path="/superadmin/servizi" element={<Suspense fallback={<PageFallback />}><ServiziCatalogo /></Suspense>} />
            <Route path="/superadmin/servizi/:servizioId" element={<Suspense fallback={<PageFallback />}><ServizioSchedaPage /></Suspense>} />
            <Route path="/superadmin/deploy-clienti" element={<Suspense fallback={<PageFallback />}><DeployClientiPage /></Suspense>} />
            <Route path="/superadmin/pubblicazione-sito" element={<Suspense fallback={<PageFallback />}><SuperadminPubblicazioneSitoPage /></Suspense>} />
            <Route path="/superadmin/piani" element={<Suspense fallback={<PageFallback />}><Piani /></Suspense>} />
            <Route path="/superadmin/licenses" element={<Suspense fallback={<PageFallback />}><Licenses /></Suspense>} />
            <Route path="/superadmin/settings" element={<Suspense fallback={<PageFallback />}><Settings /></Suspense>} />
            <Route path="/superadmin/guide" element={<Suspense fallback={<PageFallback />}><SuperadminGuideHub /></Suspense>} />
            <Route path="/superadmin/guide/:docSlug" element={<Suspense fallback={<PageFallback />}><SuperadminGuideDocPage /></Suspense>} />
            <Route path="/superadmin/sviluppo" element={<Suspense fallback={<PageFallback />}><SviluppoPage /></Suspense>} />
            <Route path="/superadmin/home-pizzeria" element={<Suspense fallback={<PageFallback />}><Home /></Suspense>} />
          </Route>
        </Route>
      )}

      {/* =================================================
          ADMIN
      ================================================= */}

      {isSaaS && (
        <Route
          element={
            <ProtectedRoute allowedRoles={["admin"]} requireTenant>
              <RoleLayout allowedRoles={["admin"]}>
                <AdminLayout />
              </RoleLayout>
            </ProtectedRoute>
          }
        >
          <Route path="/admin" element={<Navigate to={ADMIN_TENANT_HOME} replace />} />
          <Route path="/admin/dashboard" element={<Navigate to={ADMIN_TENANT_HOME} replace />} />
          <Route path="/admin/home" element={<Home />} />
          <Route path="/admin/magazzino" element={<Suspense fallback={<PageFallback />}><MagazzinoHubPage /></Suspense>} />
          <Route path="/admin/magazzino/ordini-fornitori" element={<Suspense fallback={<PageFallback />}><OrdiniFornitoriPage /></Suspense>} />
          <Route path="/admin/magazzino/ddt" element={<Suspense fallback={<PageFallback />}><DdtPage /></Suspense>} />
          <Route path="/admin/contabilita" element={<Suspense fallback={<PageFallback />}><ContabilitaHubPage /></Suspense>} />
          <Route path="/admin/contabilita/fatture" element={<Suspense fallback={<PageFallback />}><FatturePage /></Suspense>} />
          <Route path="/admin/contabilita/pagamenti-fatture" element={<Suspense fallback={<PageFallback />}><PagamentiFatturePage /></Suspense>} />
          <Route path="/admin/contabilita/food-cost" element={<Suspense fallback={<PageFallback />}><FoodCostPage /></Suspense>} />
          <Route path="/admin/contabilita/spese-locale" element={<Suspense fallback={<PageFallback />}><SpeseLocalePage /></Suspense>} />
          <Route path="/admin/contabilita/spese-personale" element={<Suspense fallback={<PageFallback />}><SpesePersonalePage /></Suspense>} />
          <Route path="/admin/contabilita/incassi" element={<Suspense fallback={<PageFallback />}><GestioneIncassiPage /></Suspense>} />
          <Route path="/admin/manuale" element={<Suspense fallback={<PageFallback />}><ManualeUtentePage /></Suspense>} />
          <Route path="/admin/guida" element={<Navigate to="/admin/manuale" replace />} />
          <Route path="/admin/pubblicazione" element={<Navigate to="/admin/manuale" replace />} />
          <Route path="/admin/menu" element={<Navigate to="/admin/menu/categorie" replace />} />
          <Route path="/admin/menu/categorie" element={<Suspense fallback={<PageFallback />}><CategoriePage /></Suspense>} />
          <Route path="/admin/menu/formati" element={<Suspense fallback={<PageFallback />}><FormatiPage /></Suspense>} />
          <Route path="/admin/menu/cottura" element={<Suspense fallback={<PageFallback />}><CotturaPage /></Suspense>} />
          <Route path="/admin/menu/pizze" element={<Suspense fallback={<PageFallback />}><PizzePage /></Suspense>} />
          <Route path="/admin/menu/ingredienti" element={<Suspense fallback={<PageFallback />}><IngredientiPage /></Suspense>} />
          <Route path="/admin/menu/impasti" element={<Suspense fallback={<PageFallback />}><ImpastiPage /></Suspense>} />
          <Route path="/admin/menu/bibite" element={<Suspense fallback={<PageFallback />}><BibitePage /></Suspense>} />
          <Route path="/admin/menu/dolci" element={<Suspense fallback={<PageFallback />}><DolciPage /></Suspense>} />
          <Route path="/admin/menu/fritti" element={<Suspense fallback={<PageFallback />}><FrittiPage /></Suspense>} />
          <Route path="/admin/menu/allergeni" element={<Suspense fallback={<PageFallback />}><AllergeniPage /></Suspense>} />
          <Route path="/admin/report" element={<Suspense fallback={<PageFallback />}><Report /></Suspense>} />
          <Route path="/admin/fidelity" element={<Suspense fallback={<PageFallback />}><FidelityCardPage /></Suspense>} />
          <Route path="/admin/dipendenti" element={<Suspense fallback={<PageFallback />}><UserManager /></Suspense>} />
          <Route path="/admin/ruoli" element={<Suspense fallback={<PageFallback />}><RuoliPage /></Suspense>} />
          <Route path="/admin/settings" element={<Suspense fallback={<PageFallback />}><SettingsLayout /></Suspense>}>
            <Route index element={<Navigate to="dati-pizzeria" replace />} />
            <Route path="dati-pizzeria" element={<Suspense fallback={<PageFallback />}><DatiPizzeriaSection /></Suspense>} />
            <Route path="layout" element={<Suspense fallback={<PageFallback />}><LayoutSection /></Suspense>} />
            <Route path="orari" element={<Suspense fallback={<PageFallback />}><OrariSection /></Suspense>} />
            <Route path="parametri" element={<Suspense fallback={<PageFallback />}><ParametriSection /></Suspense>} />
          </Route>
        </Route>
      )}

      {/* =================================================
          OPERATIVE
      ================================================= */}

      {isSaaS && (
        <Route
          element={
            <ProtectedRoute allowedRoles={OPERATIVE_ROLES_WITH_SUPERADMIN_TEST} requireTenant requirePv>
              <RoleLayout allowedRoles={OPERATIVE_ROLES_WITH_SUPERADMIN_TEST}>
                <OperativeLayout />
              </RoleLayout>
            </ProtectedRoute>
          }
        >
          <Route path="/operative" element={<Navigate to="/operative/dashboard" replace />} />
          <Route path="/operative/dashboard" element={<Suspense fallback={<PageFallback />}><OperativeDashboard /></Suspense>} />
          <Route path="/operative/cassa" element={<Suspense fallback={<PageFallback />}><CassaPage /></Suspense>} />
          <Route path="/operative/cassa/fidelity" element={<Suspense fallback={<PageFallback />}><CassaFidelityPage /></Suspense>} />
          <Route path="/operative/cassa/prodotti-esauriti" element={<Suspense fallback={<PageFallback />}><ProdottiEsauritiPage /></Suspense>} />
          <Route path="/operative/cassa/ingredienti-esauriti" element={<Navigate to="/operative/cassa/prodotti-esauriti" replace />} />
          <Route path="/operative/turni" element={<Suspense fallback={<PageFallback />}><OperativeTurniPage /></Suspense>} />
          <Route path="/operative/cucina" element={<Suspense fallback={<PageFallback />}><Cucina /></Suspense>} />
          <Route path="/operative/bancone" element={<Suspense fallback={<PageFallback />}><Bancone /></Suspense>} />
          <Route path="/operative/pizzaioli" element={<Suspense fallback={<PageFallback />}><PizzaioloDashboard /></Suspense>} />
          <Route path="/operative/delivery" element={<Suspense fallback={<PageFallback />}><DeliveryDashboard /></Suspense>} />
          <Route path="/operative/pony" element={<Navigate to="/operative/delivery" replace />} />
        </Route>
      )}

      {/* =================================================
          PUBLIC STORE (solo dominio pizzeria)
      ================================================= */}

      {!isSaaS && (
        <>
          <Route path="/ordine" element={<OrdinePage />} />
          <Route
            path="/ordine-confermato"
            element={<OrdineConfermato />}
          />
        </>
      )}

      {/* =================================================
          FALLBACK
      ================================================= */}

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
