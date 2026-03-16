import DashboardNavCards from "@/components/dashboard/DashboardNavCards";

const OPERATIVE_NAV = Object.freeze([
  { to: "/operative/cassa", label: "Cassa", description: "Incassi e ordini" },
  { to: "/operative/cucina", label: "Cucina", description: "Ordini in preparazione" },
  { to: "/operative/bancone", label: "Bancone", description: "Comande pronte" },
  { to: "/operative/delivery", label: "Delivery", description: "Consegne" },
  { to: "/operative/pony", label: "Pony", description: "Asporto" },
]);

export default function OperativeDashboard() {
  return (
    <>
      <h1 className="dashboard-page-title">Riepilogo</h1>
      <p style={{ margin: "0 0 20px 0", fontSize: 14, color: "#666" }}>
        Scegli l’area di lavoro da aprire.
      </p>
      <DashboardNavCards items={[...OPERATIVE_NAV]} columns={3} />
    </>
  );
}
