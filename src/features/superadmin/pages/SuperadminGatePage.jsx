import { Link, useNavigate } from "react-router-dom"
import { Store, LayoutDashboard, LogOut } from "lucide-react"
import { useAuth } from "@/app/contexts/AuthContext"
import "@/styles/superadmin-gate.css"

/**
 * Ingresso privacy Super Admin: solo 2 destinazioni (vetrina / console).
 * Nessuna barra con elenco clienti o moduli piattaforma.
 */
export default function SuperadminGatePage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await logout()
    navigate("/login", { replace: true })
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
          Scegli un&apos;area. L&apos;elenco clienti e gli strumenti piattaforma restano solo nella console
          amministrazione.
        </p>

        <div className="sa-gate-cards">
          <Link to="/preview" className="sa-gate-card sa-gate-card--preview">
            <span className="sa-gate-icon" aria-hidden>
              <Store size={40} strokeWidth={1.75} />
            </span>
            <span className="sa-gate-card-label">Anteprima sito</span>
            <span className="sa-gate-card-desc">Apri la vetrina / menu online del locale</span>
          </Link>

          <Link to="/superadmin/dashboard" className="sa-gate-card sa-gate-card--admin">
            <span className="sa-gate-icon" aria-hidden>
              <LayoutDashboard size={40} strokeWidth={1.75} />
            </span>
            <span className="sa-gate-card-label">Amministrazione</span>
            <span className="sa-gate-card-desc">Console piattaforma, clienti e supporto</span>
          </Link>
        </div>
      </main>
    </div>
  )
}
