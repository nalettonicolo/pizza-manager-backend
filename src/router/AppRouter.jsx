import { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";

/* ================= LAYOUT ================= */
import PublicLayout from "@/layouts/PublicLayout";
import AdminLayout from "@/layouts/AdminLayout";
import SuperAdminLayout from "@/layouts/SuperAdminLayout";
import OperativeLayout from "@/layouts/OperativeLayout";

/* ================= GUARDS ================= */
import ProtectedRoute from "@/components/ProtectedRoute";
import RoleLayout from "@/layouts/RoleLayout";

/* ================= PUBLIC (SaaS) ================= */
import Landing from "@/features/public/pages/Landing";
import PublicStore from "@/features/public/pages/PublicStore";
import Home from "@/features/public/pages/Home";
import Contatti from "@/features/public/pages/Contatti";
import PrivacyPolicy from "@/features/public/pages/PrivacyPolicy";
import CookiePolicy from "@/features/public/pages/CookiePolicy";
import TerminiCondizioni from "@/features/public/pages/TerminiCondizioni";
import Login from "@/features/public/pages/Login";
import SelectPuntoVendita from "@/features/public/pages/SelectPuntoVendita";
import WebAppPreview from "@/features/public/pages/WebAppPreview";

/* ================= SUPERADMIN (lazy) ================= */
const SuperAdminDashboard = lazy(() => import("@/features/superadmin/pages/SuperAdminDashboard"));
const Licenses = lazy(() => import("@/features/superadmin/pages/Licenses"));
const Tenants = lazy(() => import("@/features/superadmin/pages/Tenants"));
const Settings = lazy(() => import("@/features/superadmin/pages/Settings"));
const Piani = lazy(() => import("@/features/superadmin/pages/Piani"));
const ServiziCatalogo = lazy(() => import("@/features/superadmin/pages/ServiziCatalogo"));

/* ================= ADMIN (lazy) ================= */
const Dashboard = lazy(() => import("@/features/admin/pages/Dashboard"));
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
const GuidaUtentePage = lazy(() => import("@/features/admin/pages/GuidaUtentePage"));

/* ================= OPERATIVE (lazy) ================= */
const OperativeDashboard = lazy(() => import("@/features/operative/pages/OperativeDashboard"));
const CassaPage = lazy(() => import("@/features/operative/cassa/pages/CassaPage"));
const ProdottiEsauritiPage = lazy(() => import("@/features/operative/cassa/pages/ProdottiEsauritiPage"));
const Cucina = lazy(() => import("@/features/operative/cucina/pages/Cucina"));
const Bancone = lazy(() => import("@/features/operative/bancone/pages/Bancone"));
const DeliveryDashboard = lazy(() => import("@/features/operative/delivery/pages/DeliveryDashboard"));
const PizzaioloDashboard = lazy(() => import("@/features/operative/pizzaiolo/pages/Dashboard"));
const OperativeTurniPage = lazy(() => import("@/features/operative/pages/OperativeTurniPage"));

/* ================= LEGACY ================= */
import OrdinePage from "@/pages/OrdinePage";
import OrdineConfermato from "@/pages/OrdineConfermato";

const PageFallback = () => <div className="p-6 flex items-center justify-center min-h-[120px]"><span className="text-gray-400 text-sm">Caricamento...</span></div>;

const OPERATIVE_ROLES = ["operatore", "cassa", "bancone", "cucina", "pony", "delivery", "pizzaiolo"];

/* =========================================================
   HOST DETECTION
========================================================= */

const host = window.location.hostname;

const isLocal =
  host.includes("localhost") ||
  host.includes("127.0.0.1");

const isSaaS = host === "pizzamanager.it" || host.startsWith("app.") || isLocal;

/* =========================================================
   HOST RESOLVER
========================================================= */

function RootResolver() {
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
        <Route path="/login" element={<Login />} />

        {/* Queste route esistono SOLO nel SaaS */}
        {isSaaS && (
          <>
            <Route path="/home" element={<Home />} />
            <Route path="/negozio" element={<PublicStore />} />
            <Route path="/contatti" element={<Contatti />} />
            <Route path="/privacy" element={<PrivacyPolicy />} />
            <Route path="/cookie" element={<CookiePolicy />} />
            <Route path="/termini" element={<TerminiCondizioni />} />
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
                <SuperAdminLayout />
              </RoleLayout>
            </ProtectedRoute>
          }
        >
          <Route path="/superadmin" element={<Navigate to="/superadmin/dashboard" replace />} />
          <Route path="/superadmin/dashboard" element={<Suspense fallback={<PageFallback />}><SuperAdminDashboard /></Suspense>} />
          <Route path="/superadmin/tenants" element={<Suspense fallback={<PageFallback />}><Tenants /></Suspense>} />
          <Route path="/superadmin/servizi" element={<Suspense fallback={<PageFallback />}><ServiziCatalogo /></Suspense>} />
          <Route path="/superadmin/piani" element={<Suspense fallback={<PageFallback />}><Piani /></Suspense>} />
          <Route path="/superadmin/licenses" element={<Suspense fallback={<PageFallback />}><Licenses /></Suspense>} />
          <Route path="/superadmin/settings" element={<Suspense fallback={<PageFallback />}><Settings /></Suspense>} />
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
          <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="/admin/dashboard" element={<Suspense fallback={<PageFallback />}><Dashboard /></Suspense>} />
          <Route path="/admin/guida" element={<Suspense fallback={<PageFallback />}><GuidaUtentePage /></Suspense>} />
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
            <ProtectedRoute allowedRoles={OPERATIVE_ROLES} requireTenant requirePv>
              <RoleLayout allowedRoles={OPERATIVE_ROLES}>
                <OperativeLayout />
              </RoleLayout>
            </ProtectedRoute>
          }
        >
          <Route path="/operative" element={<Navigate to="/operative/dashboard" replace />} />
          <Route path="/operative/dashboard" element={<Suspense fallback={<PageFallback />}><OperativeDashboard /></Suspense>} />
          <Route path="/operative/cassa" element={<Suspense fallback={<PageFallback />}><CassaPage /></Suspense>} />
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
