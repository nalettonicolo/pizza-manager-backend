import { Link } from "react-router-dom";
import DashboardNavCards from "@/components/dashboard/DashboardNavCards";

const ITEMS = [
  {
    to: "/admin/magazzino/movimenti-db",
    label: "Movimenti (database)",
    description: "Carichi e scarichi su Supabase — base per giacenza e tracciabilità",
  },
  {
    to: "/admin/magazzino/ordini-fornitori",
    label: "Ordini fornitori",
    description: "Grossisti, agenti, listini e soglie di riordino",
  },
  {
    to: "/admin/magazzino/ddt",
    label: "DDT",
    description: "Documenti di trasporto in entrata",
  },
];

export default function MagazzinoHubPage() {
  return (
    <>
      <h1 className="dashboard-page-title">Magazzino</h1>
      <p style={{ margin: "0 0 20px 0", fontSize: 14, color: "#64748b", lineHeight: 1.55 }}>
        Gestione acquisti e movimenti verso fornitore. I <strong>movimenti magazzino</strong> possono essere salvati su Supabase
        (tabella <code>magazzino_movimenti</code> dopo <code>sql/sql_upgrade.sql</code>); ordini fornitori e DDT restano in
        questo browser fino a integrazione completa.
      </p>
      <DashboardNavCards items={ITEMS} columns={2} currentPath="/admin/magazzino" />
      <p style={{ marginTop: 24, fontSize: 13, color: "#94a3b8" }}>
        Suggerimento: collega le <Link to="/admin/contabilita/fatture">fatture</Link> ai DDT registrati qui.
      </p>
    </>
  );
}
