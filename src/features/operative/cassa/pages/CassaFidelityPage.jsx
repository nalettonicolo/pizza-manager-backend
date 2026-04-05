import { Navigate, Link } from "react-router-dom"
import { useAuth } from "@/app/contexts/AuthContext"
import { useTenantServizi } from "@/app/hooks/useTenantServizi"
import FidelityCardPage from "@/features/admin/pages/FidelityCardPage"

/** Fidelity da area operativa Cassa (stesso modulo admin, route dedicata). */
export default function CassaFidelityPage() {
  const { hasServizio, enforcementActive } = useTenantServizi()
  const { permessiAree } = useAuth()
  const okCassa = permessiAree?.cassa === true

  if (!okCassa) {
    return <Navigate to="/operative/cassa" replace />
  }

  const fidelityManca = enforcementActive && !hasServizio("fidelity_card")
  if (fidelityManca) {
    return (
      <div style={{ maxWidth: 560 }}>
        <p style={{ margin: "0 0 12px 0" }}>
          <Link to="/operative/cassa" style={{ color: "#1565c0", fontSize: 14 }}>
            ← Torna a Cassa
          </Link>
        </p>
        <h2 className="dashboard-page-title" style={{ marginBottom: 12 }}>
          Fidelity Card
        </h2>
        <p style={{ color: "#64748b", lineHeight: 1.6 }}>
          Il servizio non è attivo sul piano di questo locale (o è stato escluso dai servizi abilitati). Un
          amministratore può abilitarlo dal Super Admin, piano / catalogo servizi (<code>fidelity_card</code>).
        </p>
      </div>
    )
  }

  return (
    <div>
      <p style={{ margin: "0 0 12px 0" }}>
        <Link to="/operative/cassa" style={{ color: "#1565c0", fontSize: 14 }}>
          ← Torna a Cassa
        </Link>
      </p>
      <FidelityCardPage />
    </div>
  )
}
