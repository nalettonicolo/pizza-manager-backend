import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { Store, LayoutDashboard, LogOut, Presentation } from "lucide-react"
import { useAuth } from "@/app/contexts/AuthContext"
import { getTenants } from "@/features/superadmin/services/superadminService"
import { setSupportTenantOverride } from "@/utils/supportTenantOverride"
import { DEMO_GIRO_STEPS, withDemoGiroQuery } from "@/utils/demoGiro"
import "@/styles/superadmin-gate.css"

/**
 * Ingresso privacy Super Admin: vetrina / console / giro demo (senza altri login).
 */
export default function SuperadminGatePage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [demoStarting, setDemoStarting] = useState(false)
  const [demoError, setDemoError] = useState(null)

  const handleLogout = async () => {
    await logout()
    navigate("/login", { replace: true })
  }

  const startDemoGiro = async () => {
    setDemoError(null)
    setDemoStarting(true)
    try {
      const envId = String(import.meta.env.VITE_PUBLIC_DEMO_TENANT_ID || "").trim()
      let tenantId = envId
      if (!tenantId) {
        const rows = await getTenants()
        const first = (rows || []).find((t) => t?.attivo !== false && t?.id)
        tenantId = first?.id ? String(first.id) : ""
      }
      if (!tenantId) {
        setDemoError("Nessun tenant disponibile per la demo. Imposta VITE_PUBLIC_DEMO_TENANT_ID o crea un cliente attivo.")
        return
      }
      setSupportTenantOverride(tenantId)
      try {
        window.dispatchEvent(new Event("pm-support-tenant"))
      } catch {
        /* ignore */
      }
      const first = DEMO_GIRO_STEPS[0]
      navigate(withDemoGiroQuery(first.path, tenantId, { stepIndex: 0 }))
    } catch (e) {
      setDemoError(e?.message || "Avvio demo non riuscito.")
    } finally {
      setDemoStarting(false)
    }
  }

  return (
    <div className="sa-gate">
      <header className="sa-gate-top">
        <div className="sa-gate-brand">
          <span className="sa-gate-logo">PizzaManager</span>
          <span className="sa-gate-badge">Super Admin</span>
        </div>
        <div className="sa-gate-user">
          <span className="sa-gate-email" title={user?.email}>
            {user?.email}
          </span>
          <button type="button" className="sa-gate-logout" onClick={() => void handleLogout()}>
            <LogOut size={18} strokeWidth={2.25} aria-hidden />
            Esci
          </button>
        </div>
      </header>

      <main className="sa-gate-main">
        <p className="sa-gate-kicker">Accesso riservato</p>
        <h1 className="sa-gate-title">Dove vuoi andare?</h1>
        <p className="sa-gate-lede">
          Resta loggato come Super Admin. La demo apre la Cassa del locale: usa la sidebar e «4 schermate» per
          mostrare i reparti reali, senza altri accessi.
        </p>

        {demoError ? (
          <p role="alert" style={{ color: "#b91c1c", marginBottom: 16, fontSize: 14 }}>
            {demoError}
          </p>
        ) : null}

        <div className="sa-gate-cards">
          <button
            type="button"
            className="sa-gate-card sa-gate-card--preview"
            disabled={demoStarting}
            onClick={() => void startDemoGiro()}
            style={{ cursor: demoStarting ? "wait" : "pointer", textAlign: "left", width: "100%", font: "inherit" }}
          >
            <span className="sa-gate-icon" aria-hidden>
              <Presentation size={40} strokeWidth={1.75} />
            </span>
            <span className="sa-gate-card-label">
              {demoStarting ? "Avvio demo…" : "Demo live"}
            </span>
            <span className="sa-gate-card-desc">
              Entra in Cassa con dati reali. Naviga dalla barra laterale: Cassa, Pizzaioli, Cucina, Bancone, Delivery e
              «4 schermate».
            </span>
          </button>

          <Link to="/preview" className="sa-gate-card sa-gate-card--preview">
            <span className="sa-gate-icon" aria-hidden>
              <Store size={40} strokeWidth={1.75} />
            </span>
            <span className="sa-gate-card-label">Solo vetrina</span>
            <span className="sa-gate-card-desc">Apre solo il menù online (senza ciclo guidato).</span>
          </Link>

          <Link to="/superadmin/dashboard" className="sa-gate-card sa-gate-card--admin">
            <span className="sa-gate-icon" aria-hidden>
              <LayoutDashboard size={40} strokeWidth={1.75} />
            </span>
            <span className="sa-gate-card-label">Amministrazione</span>
            <span className="sa-gate-card-desc">Console piattaforma, clienti e Sala QA</span>
          </Link>
        </div>
      </main>
    </div>
  )
}
