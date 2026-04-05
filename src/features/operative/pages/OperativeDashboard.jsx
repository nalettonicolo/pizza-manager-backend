import { useMemo } from "react";
import DashboardNavCards from "@/components/dashboard/DashboardNavCards";
import { useTenantServizi } from "@/app/hooks/useTenantServizi";
import { useAuth } from "@/app/contexts/AuthContext";
import { isOperativeAreaPermitted } from "@/utils/operativePathEligibility";

const OPERATIVE_NAV = Object.freeze([
  { to: "/operative/cassa", label: "Cassa", description: "Incassi e ordini", servizioId: "ordini_cassa", areaKey: "cassa" },
  { to: "/operative/cucina", label: "Cucina", description: "Ordini in preparazione", servizioId: "tablet_ruoli", areaKey: "cucina" },
  { to: "/operative/bancone", label: "Bancone", description: "Comande pronte", servizioId: "tablet_ruoli", areaKey: "bancone" },
  { to: "/operative/pizzaioli", label: "Pizzaioli", description: "Schermata forno / tablet", servizioId: "tablet_ruoli", areaKey: "pizzaiolo" },
  { to: "/operative/delivery", label: "Delivery", description: "Consegne", servizioId: "gestione_consegne", areaKey: "delivery" },
  { to: "/operative/pony", label: "Pony", description: "Asporto", servizioId: "gestione_consegne", areaKey: "pony" },
]);

export default function OperativeDashboard() {
  const { permessiAree } = useAuth();
  const { hasServizio } = useTenantServizi();
  const items = useMemo(
    () =>
      OPERATIVE_NAV.filter((item) => {
        if (item.servizioId && !hasServizio(item.servizioId)) return false;
        return isOperativeAreaPermitted(item.areaKey, permessiAree);
      }),
    [hasServizio, permessiAree],
  );

  return (
    <>
      <h1 className="dashboard-page-title">Riepilogo</h1>
      <p style={{ margin: "0 0 20px 0", fontSize: 14, color: "#666" }}>
        Scegli l’area di lavoro da aprire.
      </p>
      {items.length ? (
        <DashboardNavCards items={[...items]} columns={3} />
      ) : (
        <p style={{ fontSize: 14, color: "#64748b" }}>Nessuna area operativa è abilitata per i servizi attivi di questa pizzeria.</p>
      )}
    </>
  );
}
