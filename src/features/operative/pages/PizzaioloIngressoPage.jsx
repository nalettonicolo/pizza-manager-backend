import { Link, Navigate } from "react-router-dom"
import { useAuth } from "@/app/contexts/AuthContext"
import { isQuadRepartiTestEmail } from "@/constants/quadRepartiTest"

/**
 * Account test pizzaiolo@pizzamanager.it: dopo login scegli schermata Pizzaiolo a tutto schermo
 * oppure vista Test 4 reparti.
 */
export default function PizzaioloIngressoPage() {
  const { user } = useAuth()

  if (!isQuadRepartiTestEmail(user?.email)) {
    return <Navigate to="/operative/pizzaioli" replace />
  }

  return (
    <div className="dashboard-content" style={{ maxWidth: 520, margin: "32px auto", padding: "0 16px" }}>
      <h1 className="dashboard-page-title" style={{ marginBottom: 8 }}>
        Pizzaiolo — modalità
      </h1>
      <p style={{ margin: "0 0 28px", fontSize: 14, color: "#64748b", lineHeight: 1.55 }}>
        Scegli come aprire l’area: schermata standard a tutto schermo per lavorare sul flusso Pizzaiolo, oppure la griglia
        di test con quattro reparti affiancati.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <Link
          to="/operative/pizzaioli"
          className="public-layout-btn public-layout-btn--primary"
          style={{
            display: "block",
            textAlign: "center",
            padding: "16px 20px",
            fontSize: 16,
            textDecoration: "none",
            borderRadius: 10,
          }}
        >
          Schermata Pizzaiolo
        </Link>
        <Link
          to="/operative/test-reparti-quad"
          className="public-layout-btn public-layout-btn--outline"
          style={{
            display: "block",
            textAlign: "center",
            padding: "16px 20px",
            fontSize: 16,
            textDecoration: "none",
            borderRadius: 10,
            fontWeight: 700,
          }}
        >
          Test (4 schermate)
        </Link>
      </div>
      <p style={{ marginTop: 28, fontSize: 13, color: "#94a3b8" }}>
        <Link to="/operative/dashboard" style={{ color: "#c0392b", fontWeight: 600 }}>
          Riepilogo aree
        </Link>
        {" · "}
        Account dedicato allo sviluppo / prova multi-reparto.
      </p>
    </div>
  )
}
