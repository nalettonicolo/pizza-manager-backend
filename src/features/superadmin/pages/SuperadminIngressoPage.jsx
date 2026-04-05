import { Link } from "react-router-dom";
import { useAuth } from "@/app/contexts/AuthContext";
import { ENABLE_TEST_REPARTI } from "@/constants/testReparti";

const cardStyle = {
  display: "block",
  padding: 28,
  borderRadius: 12,
  border: "1px solid #e2e8f0",
  background: "#fff",
  textDecoration: "none",
  color: "inherit",
  boxShadow: "0 1px 3px rgba(0,0,0,.06)",
  transition: "box-shadow .2s, border-color .2s",
};

export default function SuperadminIngressoPage() {
  const { user, logout } = useAuth();

  return (
    <>
      <header className="superadmin-fixed-bar" role="banner">
        <div style={{ display: "flex", alignItems: "center", minWidth: 0, flexShrink: 0 }}>
          <span className="superadmin-bar-logo">PizzaManager</span>
        </div>
        <div className="superadmin-bar-right" style={{ flex: 1, justifyContent: "flex-end", minWidth: 0 }}>
          <span className="superadmin-bar-account" title={user?.email || undefined}>
            {user?.email ?? "—"}
          </span>
          <button type="button" className="superadmin-bar-logout" onClick={() => void logout()}>
            Esci
          </button>
        </div>
      </header>

      <h1 className="dashboard-page-title">Dove vuoi entrare?</h1>
      <p style={{ margin: "0 0 28px", fontSize: 15, color: "#64748b", maxWidth: 560, lineHeight: 1.6 }}>
        Scegli l&apos;ambiente: anteprima e flussi <strong>home pizzeria</strong> (come vede il cliente / demo) oppure la{" "}
        <strong>console Super Admin</strong> (clienti, catalogo, deploy, piani).
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
          gap: 20,
          maxWidth: 900,
        }}
      >
        <Link
          to="/superadmin/home-pizzeria"
          style={cardStyle}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = "#fdba74";
            e.currentTarget.style.boxShadow = "0 8px 24px rgba(234,88,12,.12)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "#e2e8f0";
            e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,.06)";
          }}
        >
          <span style={{ fontSize: 36, display: "block", marginBottom: 12 }} aria-hidden>
            🍕
          </span>
          <h2 style={{ margin: "0 0 8px", fontSize: 20, color: "#0f172a" }}>Home pizzeria</h2>
          <p style={{ margin: 0, fontSize: 14, color: "#64748b", lineHeight: 1.55 }}>
            Benvenuto, scelta punto vendita, anteprima webapp (vista simile al titolare).
          </p>
          <span style={{ display: "inline-block", marginTop: 16, fontWeight: 700, color: "#ea580c" }}>Entra →</span>
        </Link>

        <Link
          to="/superadmin/dashboard"
          style={cardStyle}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = "#fdba74";
            e.currentTarget.style.boxShadow = "0 8px 24px rgba(234,88,12,.12)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "#e2e8f0";
            e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,.06)";
          }}
        >
          <span style={{ fontSize: 36, display: "block", marginBottom: 12 }} aria-hidden>
            ⚙️
          </span>
          <h2 style={{ margin: "0 0 8px", fontSize: 20, color: "#0f172a" }}>Area Super Admin</h2>
          <p style={{ margin: 0, fontSize: 14, color: "#64748b", lineHeight: 1.55 }}>
            Riepilogo, clienti, catalogo servizi, deploy, piani, guide, sviluppo.
          </p>
          <span style={{ display: "inline-block", marginTop: 16, fontWeight: 700, color: "#ea580c" }}>Entra →</span>
        </Link>
      </div>

      {ENABLE_TEST_REPARTI && (
        <div className="dashboard-box" style={{ marginTop: 32, maxWidth: 900 }}>
          <h2 style={{ marginTop: 0, fontSize: 16 }}>Strumenti di test</h2>
          <p style={{ margin: "0 0 12px", fontSize: 14, color: "#64748b" }}>
            Pannello con tutte le schermate operative in contemporanea (solo ambiente di test).
          </p>
          <Link to="/superadmin/test-reparti" className="btn-primary-dashboard" style={{ textDecoration: "none", display: "inline-block" }}>
            Apri pannello test reparti →
          </Link>
        </div>
      )}
    </>
  );
}
