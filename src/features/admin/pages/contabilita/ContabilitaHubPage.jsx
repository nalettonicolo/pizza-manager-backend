import { Link } from "react-router-dom";
import DashboardNavCards from "@/components/dashboard/DashboardNavCards";

const ITEMS = [
  { to: "/admin/contabilita/fatture", label: "Fatture", description: "Collegate ai DDT fornitori" },
  { to: "/admin/contabilita/pagamenti-fatture", label: "Pagamenti fatture", description: "Scadenze, tipo pagamento, stato pagato" },
  { to: "/admin/contabilita/food-cost", label: "Food cost", description: "Listino automatico e margine target" },
  { to: "/admin/contabilita/spese-locale", label: "Spese gestione locale", description: "Affitto, utenze, overhead" },
  { to: "/admin/contabilita/spese-personale", label: "Spese gestione personale", description: "Stipendi, F24, formazione" },
  { to: "/admin/contabilita/incassi", label: "Gestione incassi", description: "Contanti ed elettronico" },
];

export default function ContabilitaHubPage() {
  return (
    <>
      <h1 className="dashboard-page-title">Contabilità</h1>
      <p style={{ margin: "0 0 20px 0", fontSize: 14, color: "#64748b", lineHeight: 1.55 }}>
        Moduli collegati a magazzino (DDT) e gestione economica del locale. Dati salvati in locale per tenant fino a
        integrazione database.
      </p>
      <DashboardNavCards items={ITEMS} columns={3} currentPath="/admin/contabilita" />
      <p style={{ marginTop: 24, fontSize: 13, color: "#94a3b8" }}>
        DDT: <Link to="/admin/magazzino/ddt">Magazzino → DDT</Link>
      </p>
    </>
  );
}
