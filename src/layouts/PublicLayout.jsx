import { Outlet, Link } from "react-router-dom"
import CookieBanner from "@/features/public/components/CookieBanner"
import "@/styles/public-layout.css"

export default function PublicLayout() {
  return (
    <div className="public-layout-root">
      <header className="public-layout-header">
        <Link to="/" className="public-layout-logo">
          PizzaManager
        </Link>
        <Link to="/contatti" className="public-layout-header-link">
          Contatti
        </Link>
      </header>

      <main className="public-layout-main">
        <Outlet />
      </main>

      <footer className="public-layout-footer">
        <div className="public-layout-footer-inner">
          <nav className="public-layout-footer-legal" aria-label="Informative legali">
            <Link to="/privacy">Privacy policy</Link>
            <Link to="/cookie">Cookie policy</Link>
            <Link to="/termini">Termini e condizioni</Link>
          </nav>
          <span className="public-layout-footer-copy">
            © {new Date().getFullYear()} PizzaManager
          </span>
        </div>
      </footer>

      <CookieBanner />
    </div>
  )
}
