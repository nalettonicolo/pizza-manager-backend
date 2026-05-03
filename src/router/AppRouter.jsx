import { lazy as reactLazy, Suspense } from "react";
import { Routes, Route, Navigate, Outlet } from "react-router-dom";
import { createLazyWithChunkReload } from "@/utils/lazyWithReload";
import { ENABLE_TEST_REPARTI } from "@/constants/testReparti";
import { ADMIN_TENANT_HOME } from "@/constants/adminTenantHome";
import { isSaaSHostname } from "@/utils/saasHost";

/* ================= LAYOUT ================= */
import PublicLayout from "@/layouts/PublicLayout";
import AdminLayout from "@/layouts/AdminLayout";
import SuperAdminLayout from "@/layouts/SuperAdminLayout";
import OperativeLayout from "@/layouts/OperativeLayout";

/* ================= GUARDS ================= */
import ProtectedRoute from "@/components/ProtectedRoute";
import ContabilitaFullRoutesGate from "@/features/admin/components/ContabilitaFullRoutesGate";
import ClienteRoute from "@/components/ClienteRoute";
import ClienteEmailVerifiedRoute from "@/components/ClienteEmailVerifiedRoute";
import RoleLayout from "@/layouts/RoleLayout";

/* ================= PUBLIC (SaaS) — lazy per ridurre JS iniziale (landing / vetrina / legal) ================= */
const lazy = createLazyWithChunkReload(reactLazy);

const Landing = lazy(() => import("@/features/public/pages/Landing"));
const PublicStore = lazy(() => import("@/features/public/pages/PublicStore"));
const Home = lazy(() => import("@/features/public/pages/Home"));
const Contatti = lazy(() => import("@/features/public/pages/Contatti"));
const PrivacyPolicy = lazy(() => import("@/features/public/pages/PrivacyPolicy"));
const CookiePolicy = lazy(() => import("@/features/public/pages/CookiePolicy"));
const TerminiCondizioni = lazy(() => import("@/features/public/pages/TerminiCondizioni"));
const Support = lazy(() => import("@/features/public/pages/Support"));
const SelectPuntoVendita = lazy(() => import("@/features/public/pages/SelectPuntoVendita"));
const WebAppPreview = lazy(() => import("@/features/public/pages/WebAppPreview"));
const OrdinePage = lazy(() => import("@/pages/OrdinePage"));
const OrdineConfermato = lazy(() => import("@/pages/OrdineConfermato"));

/* ================= SUPERADMIN (lazy) ================= */
const Login = lazy(() => import("@/features/public/pages/Login"));
const ClienteRegistrazionePage = lazy(() => import("@/features/public/pages/ClienteRegistrazionePage"));
const ClientePasswordDimenticataPage = lazy(() => import("@/features/public/pages/ClientePasswordDimenticataPage"));
const ClienteReimpostaPasswordPage = lazy(() => import("@/features/public/pages/ClienteReimpostaPasswordPage"));
const ClienteDashboardPage = lazy(() => import("@/features/public/pages/ClienteDashboardPage"));
const ClienteOrdiniPage = lazy(() => import("@/features/public/pages/ClienteOrdiniPage"));
const ClienteProfiloPage = lazy(() => import("@/features/public/pages/ClienteProfiloPage"));
const ClienteVerificaEmailPage = lazy(() => import("@/features/public/pages/ClienteVerificaEmailPage"));
const PublicOrdineCheckoutPage = lazy(() => import("@/features/public/pages/PublicOrdineCheckoutPage"));
const SuperAdminDashboard = lazy(() => import("@/features/superadmin/pages/SuperAdminDashboard"));
const Licenses = lazy(() => import("@/features/superadmin/pages/Licenses"));
const Tenants = lazy(() => import("@/features/superadmin/pages/Tenants"));
const SuperadminTenantArchivioPasswordPage = lazy(() =>
  import("@/features/superadmin/pages/SuperadminTenantArchivioPasswordPage"),
);
const Settings = lazy(() => import("@/features/superadmin/pages/Settings"));
const Piani = lazy(() => import("@/features/superadmin/pages/Piani"));
const ServiziCatalogo = lazy(() => import("@/features/superadmin/pages/ServiziCatalogo"));
const DeployClientiPage = lazy(() => import("@/features/superadmin/pages/DeployClientiPage"));
const SuperadminPubblicazioneSitoPage = lazy(() => import("@/features/superadmin/pages/SuperadminPubblicazioneSitoPage"));
const SuperadminGuideHub = lazy(() => import("@/features/superadmin/pages/SuperadminGuideHub"));
const SuperadminGuideDocPage = lazy(() => import("@/features/superadmin/pages/SuperadminGuideDocPage"));
const SviluppoPage = lazy(() => import("@/features/superadmin/pages/SviluppoPage"));
const ServizioSchedaPage = lazy(() => import("@/features/superadmin/pages/ServizioSchedaPage"));
const SuperadminRegistratoreCassaPage = lazy(() => import("@/features/superadmin/pages/SuperadminRegistratoreCassaPage"));
const TestRepartiPanelPage = lazy(() => import("@/features/superadmin/pages/TestRepartiPanelPage"));
const SuperadminViewportTesterPage = lazy(() => import("@/features/superadmin/pages/SuperadminViewportTesterPage"));
const SuperadminViewportStudioPage = lazy(() => import("@/features/superadmin/pages/SuperadminViewportStudioPage"));

/* ================= ADMIN (lazy) ================= */
const Report = lazy(() => import("@/features/admin/pages/Report"));
const SettingsLayout = lazy(() => import("@/features/admin/pages/settings/SettingsLayout"));
const DatiPizzeriaSection = lazy(() => import("@/features/admin/pages/settings/DatiPizzeriaSection"));
const LayoutSection = lazy(() => import("@/features/admin/pages/settings/LayoutSection"));
const OrariSection = lazy(() => import("@/features/admin/pages/settings/OrariSection"));
const ParametriSection = lazy(() => import("@/features/admin/pages/settings/ParametriSection"));
const AreaConsegnaSection = lazy(() => import("@/features/admin/pages/settings/AreaConsegnaSection"));
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
const ListiniPage = lazy(() => import("@/features/admin/pages/menu/ListiniPage"));
const PrepCucinaColoriPage = lazy(() => import("@/features/admin/pages/menu/PrepCucinaColoriPage"));
const UserManager = lazy(() => import("@/features/admin/pages/UserManager"));
const RuoliPage = lazy(() => import("@/features/admin/pages/RuoliPage"));
const ManualeUtentePage = lazy(() => import("@/features/admin/pages/ManualeUtentePage"));
const MagazzinoHubPage = lazy(() => import("@/features/admin/pages/magazzino/MagazzinoHubPage"));
const OrdiniFornitoriPage = lazy(() => import("@/features/admin/pages/magazzino/OrdiniFornitoriPage"));
const DdtPage = lazy(() => import("@/features/admin/pages/magazzino/DdtPage"));
const MagazzinoMovimentiDbPage = lazy(() => import("@/features/admin/pages/magazzino/MagazzinoMovimentiDbPage"));
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
const CassaStampantiRepartiPage = lazy(() => import("@/features/operative/cassa/pages/CassaStampantiRepartiPage"));
const Cucina = lazy(() => import("@/features/operative/cucina/pages/Cucina"));
const Bancone = lazy(() => import("@/features/operative/bancone/pages/Bancone"));
const DeliveryDashboard = lazy(() => import("@/features/operative/delivery/pages/DeliveryDashboard"));
const PizzaioloDashboard = lazy(() => import("@/features/operative/pizzaiolo/pages/Dashboard"));
const OperativeTurniPage = lazy(() => import("@/features/operative/pages/OperativeTurniPage"));
const RepartiQuadTestPage = lazy(() => import("@/features/operative/pages/RepartiQuadTestPage"));
const PizzaioloIngressoPage = lazy(() => import("@/features/operative/pages/PizzaioloIngressoPage"));

const PageFallback = () => <div className="p-6 flex items-center justify-center min-h-[120px]"><span className="text-gray-400 text-sm">Caricamento...</span></div>;

const OPERATIVE_ROLES = ["operatore", "cassa", "bancone", "cucina", "pony", "delivery", "pizzaiolo"];
/** In dev o con VITE_ENABLE_TEST_REPARTI: superadmin può aprire le schermate operative (pannello test iframe). */
const OPERATIVE_ROLES_WITH_SUPERADMIN_TEST = ENABLE_TEST_REPARTI ? [...OPERATIVE_ROLES, "superadmin"] : OPERATIVE_ROLES;

/* =========================================================
   HOST DETECTION
========================================================= */

const host = typeof window !== "undefined" ? window.location.hostname : "";

const isLocal =
  host.includes("localhost") ||
  host.includes("127.0.0.1");

const isSupportHost = host === "support.pizzamanager.it";

/** Allineato a `isSaaSHostname` (saasHost): include Firebase Hosting e VITE_FULL_APP_HOSTNAMES. */
const isSaaS = isSaaSHostname(host);

/** Vetrina cliente (registrazione, password): anche in localhost per sviluppo. */
const showPublicClientAuthRoutes = !isSaaS || isLocal;

/* =========================================================
   HOST RESOLVER
========================================================= */

function RootResolver() {
  return (
    <Suspense fallback={<PageFallback />}>
      {isSupportHost ? <Support /> : isSaaS ? <Landing /> : <PublicStore />}
    </Suspense>
  );
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

        {showPublicClientAuthRoutes && (
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
            path="/cliente/verifica-email"
            element={
              <Suspense fallback={<PageFallback />}>
                <ClienteVerificaEmailPage />
              </Suspense>
            }
          />
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
          <Route element={<ClienteEmailVerifiedRoute />}>
            <Route
              path="/ordina"
              element={
                <Suspense fallback={<PageFallback />}>
                  <PublicOrdineCheckoutPage />
                </Suspense>
              }
            />
          </Route>
        </Route>

        <Route
          path="/privacy"
          element={
            <Suspense fallback={<PageFallback />}>
              <PrivacyPolicy />
            </Suspense>
          }
        />
        <Route
          path="/cookie"
          element={
            <Suspense fallback={<PageFallback />}>
              <CookiePolicy />
            </Suspense>
          }
        />
        <Route
          path="/termini"
          element={
            <Suspense fallback={<PageFallback />}>
              <TerminiCondizioni />
            </Suspense>
          }
        />

        {/* Queste route esistono SOLO nel SaaS */}
        {isSaaS && (
          <>
            <Route
              path="/negozio"
              element={
                <Suspense fallback={<PageFallback />}>
                  <PublicStore />
                </Suspense>
              }
            />
            <Route
              path="/contatti"
              element={
                <Suspense fallback={<PageFallback />}>
                  <Contatti />
                </Suspense>
              }
            />
            <Route
              path="/support"
              element={
                <Suspense fallback={<PageFallback />}>
                  <Support />
                </Suspense>
              }
            />
            <Route
              path="/select-pv"
              element={
                <Suspense fallback={<PageFallback />}>
                  <SelectPuntoVendita />
                </Suspense>
              }
            />
            <Route
              path="/preview"
              element={
                <Suspense fallback={<PageFallback />}>
                  <WebAppPreview />
                </Suspense>
              }
            />
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
          <Route path="/superadmin/ingresso" element={<Navigate to="/superadmin/dashboard" replace />} />
          {/* Studio viewport: fullscreen senza barra superadmin (anteprima tipo builder). */}
          <Route
            path="/superadmin/test-layout/studio"
            element={
              <Suspense fallback={<PageFallback />}>
                <SuperadminViewportStudioPage />
              </Suspense>
            }
          />
          <Route element={<SuperAdminLayout />}>
            <Route path="/superadmin" element={<Navigate to="/superadmin/dashboard" replace />} />
            <Route path="/superadmin/test-reparti" element={<Suspense fallback={<PageFallback />}><TestRepartiPanelPage /></Suspense>} />
            <Route
              path="/superadmin/test-layout"
              element={
                <Suspense fallback={<PageFallback />}>
                  <SuperadminViewportTesterPage />
                </Suspense>
              }
            />
            <Route path="/superadmin/dashboard" element={<Suspense fallback={<PageFallback />}><SuperAdminDashboard /></Suspense>} />
            <Route path="/superadmin/tenants" element={<Suspense fallback={<PageFallback />}><Tenants /></Suspense>} />
            <Route
              path="/superadmin/tenants/:tenantId/archivio-password"
              element={
                <Suspense fallback={<PageFallback />}>
                  <SuperadminTenantArchivioPasswordPage />
                </Suspense>
              }
            />
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
            <Route
              path="/superadmin/registratore-cassa"
              element={
                <Suspense fallback={<PageFallback />}>
                  <SuperadminRegistratoreCassaPage />
                </Suspense>
              }
            />
            <Route
              path="/superadmin/home-pizzeria"
              element={
                <Suspense fallback={<PageFallback />}>
                  <Home />
                </Suspense>
              }
            />
          </Route>
        </Route>
      )}

      {/* =================================================
          ADMIN
      ================================================= */}

      {isSaaS && (
        <Route
          element={
            <ProtectedRoute allowedRoles={["admin", "owner"]} requireTenant>
              <RoleLayout allowedRoles={["admin", "owner"]}>
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
          <Route path="/admin/magazzino/movimenti-db" element={<Suspense fallback={<PageFallback />}><MagazzinoMovimentiDbPage /></Suspense>} />
          <Route
            path="/admin/contabilita"
            element={
              <Suspense fallback={<PageFallback />}>
                <ContabilitaFullRoutesGate>
                  <ContabilitaHubPage />
                </ContabilitaFullRoutesGate>
              </Suspense>
            }
          />
          <Route
            path="/admin/contabilita/fatture"
            element={
              <Suspense fallback={<PageFallback />}>
                <ContabilitaFullRoutesGate>
                  <FatturePage />
                </ContabilitaFullRoutesGate>
              </Suspense>
            }
          />
          <Route
            path="/admin/contabilita/pagamenti-fatture"
            element={
              <Suspense fallback={<PageFallback />}>
                <ContabilitaFullRoutesGate>
                  <PagamentiFatturePage />
                </ContabilitaFullRoutesGate>
              </Suspense>
            }
          />
          <Route
            path="/admin/contabilita/food-cost"
            element={
              <Suspense fallback={<PageFallback />}>
                <ContabilitaFullRoutesGate>
                  <FoodCostPage />
                </ContabilitaFullRoutesGate>
              </Suspense>
            }
          />
          <Route
            path="/admin/contabilita/spese-locale"
            element={
              <Suspense fallback={<PageFallback />}>
                <ContabilitaFullRoutesGate>
                  <SpeseLocalePage />
                </ContabilitaFullRoutesGate>
              </Suspense>
            }
          />
          <Route
            path="/admin/contabilita/spese-personale"
            element={
              <Suspense fallback={<PageFallback />}>
                <ContabilitaFullRoutesGate>
                  <SpesePersonalePage />
                </ContabilitaFullRoutesGate>
              </Suspense>
            }
          />
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
          <Route path="/admin/menu/listini" element={<Suspense fallback={<PageFallback />}><ListiniPage /></Suspense>} />
          <Route
            path="/admin/menu/prep-cucina-colori"
            element={
              <Suspense fallback={<PageFallback />}>
                <PrepCucinaColoriPage />
              </Suspense>
            }
          />
          <Route path="/admin/report" element={<Suspense fallback={<PageFallback />}><Report /></Suspense>} />
          <Route path="/admin/fidelity" element={<Suspense fallback={<PageFallback />}><FidelityCardPage /></Suspense>} />
          <Route path="/admin/dipendenti" element={<Suspense fallback={<PageFallback />}><UserManager /></Suspense>} />
          <Route path="/admin/ruoli" element={<Suspense fallback={<PageFallback />}><RuoliPage /></Suspense>} />
          <Route path="/admin/settings" element={<Suspense fallback={<PageFallback />}><SettingsLayout /></Suspense>}>
            <Route index element={<Navigate to="dati-pizzeria" replace />} />
            <Route path="dati-pizzeria" element={<Suspense fallback={<PageFallback />}><DatiPizzeriaSection /></Suspense>} />
            <Route path="layout" element={<Suspense fallback={<PageFallback />}><LayoutSection /></Suspense>} />
            <Route path="orari" element={<Suspense fallback={<PageFallback />}><OrariSection /></Suspense>} />
            <Route path="area-consegna" element={<Suspense fallback={<PageFallback />}><AreaConsegnaSection /></Suspense>} />
            <Route path="sedi-aree" element={<Navigate to="/admin/settings/area-consegna" replace />} />
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
          <Route path="/operative/cassa/stampanti-reparti" element={<Suspense fallback={<PageFallback />}><CassaStampantiRepartiPage /></Suspense>} />
          <Route path="/operative/cassa/prodotti-esauriti" element={<Suspense fallback={<PageFallback />}><ProdottiEsauritiPage /></Suspense>} />
          <Route path="/operative/cassa/ingredienti-esauriti" element={<Navigate to="/operative/cassa/prodotti-esauriti" replace />} />
          <Route path="/operative/turni" element={<Suspense fallback={<PageFallback />}><OperativeTurniPage /></Suspense>} />
          <Route path="/operative/cucina" element={<Suspense fallback={<PageFallback />}><Cucina /></Suspense>} />
          <Route path="/operative/bancone" element={<Suspense fallback={<PageFallback />}><Bancone /></Suspense>} />
          <Route path="/operative/pizzaioli" element={<Suspense fallback={<PageFallback />}><PizzaioloDashboard /></Suspense>} />
          <Route path="/operative/delivery" element={<Suspense fallback={<PageFallback />}><DeliveryDashboard /></Suspense>} />
          <Route path="/operative/pony" element={<Navigate to="/operative/delivery" replace />} />
          <Route
            path="/operative/pizzaiolo-ingresso"
            element={
              <Suspense fallback={<PageFallback />}>
                <PizzaioloIngressoPage />
              </Suspense>
            }
          />
          <Route
            path="/operative/test-reparti-quad"
            element={
              <Suspense fallback={<PageFallback />}>
                <RepartiQuadTestPage />
              </Suspense>
            }
          />
        </Route>
      )}

      {/* =================================================
          PUBLIC STORE (solo dominio pizzeria)
      ================================================= */}

      {!isSaaS && (
        <>
          <Route
            path="/ordine"
            element={
              <Suspense fallback={<PageFallback />}>
                <OrdinePage />
              </Suspense>
            }
          />
          <Route
            path="/ordine-confermato"
            element={
              <Suspense fallback={<PageFallback />}>
                <OrdineConfermato />
              </Suspense>
            }
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
