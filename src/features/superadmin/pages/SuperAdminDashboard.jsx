import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getPlatformStats } from "@/features/superadmin/services/superadminService";
import DashboardNavCards from "@/components/dashboard/DashboardNavCards";

const PIANO_LABEL = {
  TRIAL: "Prova (7 gg)",
  PRO: "Pro",
  ENTERPRISE: "Enterprise",
  FREE: "Free (legacy)",
};
const STATO_LABEL = { ATTIVA: "Attiva", SCADUTA: "Scaduta", SOSPESA: "Sospesa", CANCELLATA: "Cancellata" };

const SUPERADMIN_NAV = [
  { to: "/superadmin/dashboard", label: "Riepilogo", description: "Home e statistiche" },
  { to: "/superadmin/tenants", label: "Clienti", description: "Pizzerie registrate" },
  { to: "/superadmin/piani", label: "Piani", description: "Piani di abbonamento" },
  { to: "/superadmin/licenses", label: "Abbonamenti", description: "Stato licenze" },
  { to: "/superadmin/settings", label: "Impostazioni", description: "Configurazione" },
];

export default function SuperAdminDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        setError(null);
        const data = await getPlatformStats();
        if (!cancelled) setStats(data);
      } catch (err) {
        if (!cancelled) {
          setError(err?.message ?? "Errore caricamento statistiche");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="dashboard-loading">
        <div className="skeleton" />
        <div className="skeleton-row" />
        <div className="skeleton-row" />
        <div className="skeleton-row" />
      </div>
    );
  }

  if (error) {
    return <div className="dashboard-error">{error}</div>;
  }

  if (!stats) return null;

  return (
    <>
      <h1 className="dashboard-page-title">Riepilogo</h1>

      <DashboardNavCards items={SUPERADMIN_NAV} columns={5} />

      <div className="stat-cards cols-4">
        <div className="stat-card">
          <p className="stat-label">Clienti totali</p>
          <p className="stat-value">{stats.totalTenants}</p>
        </div>
        <div className="stat-card">
          <p className="stat-label">Clienti attivi</p>
          <p className="stat-value">{stats.activeTenants}</p>
        </div>
        <div className="stat-card">
          <p className="stat-label">Abbonamenti</p>
          <p className="stat-value">{stats.totalSubscriptions}</p>
        </div>
        <div className="stat-card">
          <p className="stat-label">Ordini totali</p>
          <p className="stat-value">{stats.totalOrders}</p>
        </div>
      </div>

      <div className="dashboard-two-cols">
        <div className="dashboard-box">
          <h2>Clienti per piano</h2>
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {Object.entries(stats.byPlan || {}).map(([piano, count]) => (
              <li key={piano} className="dashboard-list-item">
                <span>{PIANO_LABEL[piano] ?? piano}</span>
                <span>{count}</span>
              </li>
            ))}
            {Object.keys(stats.byPlan || {}).length === 0 && (
              <li className="dashboard-list-item" style={{ color: "#666" }}>Nessun dato</li>
            )}
          </ul>
        </div>
        <div className="dashboard-box">
          <h2>Abbonamenti per stato</h2>
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {Object.entries(stats.subsByStato || {}).map(([stato, count]) => (
              <li key={stato} className="dashboard-list-item">
                <span>{STATO_LABEL[stato] ?? stato}</span>
                <span>{count}</span>
              </li>
            ))}
            {Object.keys(stats.subsByStato || {}).length === 0 && (
              <li className="dashboard-list-item" style={{ color: "#666" }}>Nessun dato</li>
            )}
          </ul>
        </div>
      </div>

      <div className="dashboard-box">
        <div className="dashboard-box-header">
          <h2>Ultimi clienti</h2>
          <Link to="/superadmin/tenants">Vedi tutti →</Link>
        </div>
        {stats.recentTenants?.length > 0 ? (
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {stats.recentTenants.map((t) => (
              <li key={t.id} className="dashboard-list-item">
                <span style={{ fontWeight: 600 }}>{t.nome}</span>
                <span style={{ color: "#666" }}>{t.slug} · {PIANO_LABEL[t.piano] ?? t.piano}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p style={{ margin: 0, color: "#666", fontSize: 14 }}>Nessun cliente.</p>
        )}
      </div>
    </>
  );
}
