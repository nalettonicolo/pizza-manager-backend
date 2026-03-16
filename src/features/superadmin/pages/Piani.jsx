import { useState } from "react";
import { Link } from "react-router-dom";
import DashboardNavCards from "@/components/dashboard/DashboardNavCards";

const PIANI_PREDEFINITI = [
  { id: "FREE", nome: "Free", prezzo: "0 €/mese", ordiniMax: "100/mese", descrizione: "Per provare la piattaforma." },
  { id: "PRO", nome: "Pro", prezzo: "29 €/mese", ordiniMax: "Illimitati", descrizione: "Per pizzerie in crescita." },
  { id: "ENTERPRISE", nome: "Enterprise", prezzo: "Su misura", ordiniMax: "Illimitati", descrizione: "Supporto dedicato e personalizzazioni." },
];

const SUPERADMIN_NAV = [
  { to: "/superadmin/dashboard", label: "Riepilogo", description: "Torna alla home" },
  { to: "/superadmin/tenants", label: "Clienti", description: "Pizzerie registrate" },
  { to: "/superadmin/licenses", label: "Abbonamenti", description: "Stato licenze" },
  { to: "/superadmin/settings", label: "Impostazioni", description: "Configurazione" },
];

export default function Piani() {
  const [piani] = useState(PIANI_PREDEFINITI);

  return (
    <>
      <div style={{ marginBottom: 16 }}>
        <Link
          to="/superadmin/dashboard"
          style={{
            display: "inline-block",
            padding: "10px 20px",
            background: "#d35400",
            color: "#fff",
            borderRadius: 6,
            textDecoration: "none",
            fontWeight: 600,
            fontSize: 14,
          }}
        >
          ← Torna al Riepilogo
        </Link>
      </div>
      <div className="dashboard-page-header">
        <h1 className="dashboard-page-title">Piani di abbonamento</h1>
      </div>

      <p style={{ margin: "0 0 24px 0", fontSize: 14, color: "#555" }}>
        I piani disponibili per i clienti. Ogni cliente (tenant) è associato a un piano. Qui puoi consultare la struttura; la modifica dei piani può essere estesa con salvataggio su database.
      </p>

      <div className="nav-cards cols-4" style={{ marginBottom: 32 }}>
        {SUPERADMIN_NAV.map((item) => (
          <Link key={item.to} to={item.to} className="nav-card">
            <h3>{item.label}</h3>
            <p>{item.description}</p>
            <span className="nav-card-link">Vai →</span>
          </Link>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 20 }}>
        {piani.map((p) => (
          <div key={p.id} className="dashboard-box" style={{ marginBottom: 0 }}>
            <h2 style={{ marginBottom: 8, color: "#d35400" }}>{p.nome}</h2>
            <p style={{ fontSize: 18, fontWeight: 700, margin: "0 0 8px 0", color: "#2c2c2c" }}>{p.prezzo}</p>
            <p style={{ fontSize: 13, color: "#666", margin: "0 0 8px 0" }}>Ordini: {p.ordiniMax}</p>
            <p style={{ fontSize: 14, color: "#555", margin: 0 }}>{p.descrizione}</p>
          </div>
        ))}
      </div>
    </>
  );
}
