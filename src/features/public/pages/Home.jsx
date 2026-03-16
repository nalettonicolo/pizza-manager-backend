import { Link } from "react-router-dom";
import DashboardNavCards from "@/components/dashboard/DashboardNavCards";
import { useAuth } from "@/app/contexts/AuthContext";
import { useTenant } from "@/app/contexts/TenantContext";
import { usePlan } from "@/app/hooks/usePlan";

const HOME_NAV = [
  { to: "/select-pv", label: "Scegli punto vendita", description: "Seleziona la pizzeria" },
  { to: "/preview", label: "Anteprima", description: "Vedi l’app in anteprima" },
];

const ADMIN_NAV = [
  { to: "/admin/dashboard", label: "Dashboard", description: "Riepilogo e statistiche" },
  { to: "/admin/settings", label: "Impostazioni", description: "Dati pizzeria, layout, parametri" },
  { to: "/admin/ruoli", label: "Ruoli", description: "Gestione ruoli e accessi" },
];

export default function Home() {
  const { ruolo } = useAuth();
  const { tenantData } = useTenant();
  const { plan, isPro, isEnterprise } = usePlan();

  const isAdmin = ruolo === "admin";
  const pianoLabel = plan === "PRO" ? "Pro" : plan === "ENTERPRISE" ? "Enterprise" : "Free";

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-xl font-semibold text-gray-900 mb-2">Benvenuto</h1>
        <p className="text-sm text-gray-500 mb-4">
          {tenantData?.nome ? `Pizzeria: ${tenantData.nome}` : "Scegli dove andare."}
        </p>
        {(isPro || isEnterprise) && (
          <p className="text-xs text-gray-500 mb-4">
            Piano: <span className="font-medium text-gray-700">{pianoLabel}</span>
          </p>
        )}
        <DashboardNavCards items={HOME_NAV} columns={2} />
        {isAdmin && (
          <>
            <h2 className="text-lg font-medium text-gray-800 mt-8 mb-3">Area admin</h2>
            <DashboardNavCards items={ADMIN_NAV} columns={2} />
          </>
        )}
      </div>
    </div>
  );
}
