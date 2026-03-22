import { Outlet, Link } from "react-router-dom"
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
        © {new Date().getFullYear()} PizzaManager
      </footer>
    </div>
  )
}
