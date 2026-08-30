import { LogOut } from "lucide-react"
import { Link, useNavigate } from "react-router-dom"
import { useAuth } from "@/app/contexts/AuthContext"
import "@/styles/superadmin-gate.css"

/**
 * Chrome visivo dell'ingresso Super Admin (fondo scuro PizzaManager, badge, Esci).
 * Usato da Ingresso e da pagine documento come Flussi.
 */
export default function SuperadminGateChrome({ children, className = "", extra }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await logout()
    navigate("/login", { replace: true })
  }

  return (
    <div className={["sa-gate", className].filter(Boolean).join(" ")}>
      <header className="sa-gate-top">
        <div className="sa-gate-brand">
          <Link to="/superadmin/ingresso" className="sa-gate-logo">
            PizzaManager
          </Link>
          <span className="sa-gate-badge">Super Admin</span>
        </div>
        <div className="sa-gate-user">
          {extra}
          <span className="sa-gate-email" title={user?.email}>
            {user?.email}
          </span>
          <button type="button" className="sa-gate-logout" onClick={() => void handleLogout()}>
            <LogOut size={18} strokeWidth={2.25} aria-hidden />
            Esci
          </button>
        </div>
      </header>
      {children}
    </div>
  )
}
