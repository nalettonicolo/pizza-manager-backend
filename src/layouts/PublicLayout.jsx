import { useEffect, useState } from "react"
import { Outlet, Link, useLocation } from "react-router-dom"
import CookieBanner from "@/features/public/components/CookieBanner"
import { getIsSaaSClient } from "@/utils/saasHost"
import { getPublicTenantInfo } from "@/features/services/publicService"
import "@/styles/public-layout.css"

export default function PublicLayout() {
  const isSaaS = getIsSaaSClient()
  const { pathname } = useLocation()
  const isLanding = isSaaS && pathname === "/"
  const [tenantName, setTenantName] = useState("")

  useEffect(() => {
    let cancelled = false
    if (isLanding) {
      setTenantName("")
      return () => { cancelled = true }
    }
    getPublicTenantInfo()
      .then((tenant) => {
        if (!cancelled) setTenantName((tenant?.nome || "").trim())
      })
      .catch(() => {
        if (!cancelled) setTenantName("")
      })
    return () => { cancelled = true }
  }, [isLanding])

  const logoLabel = isLanding ? "PizzaManager" : (tenantName || "PizzaManager")

  return (
    <div className="public-layout-root">
      <header className={`public-layout-header${isSaaS ? " public-layout-header--saas" : ""}`}>
        <Link to="/" className="public-layout-logo">
          {logoLabel}
        </Link>
        {isLanding ? (
          <nav className="public-layout-nav-center" aria-label="Sezioni">
            <a href="/#perche" className="public-layout-header-link">
              Perché noi
            </a>
            <a href="/#funzionalita" className="public-layout-header-link">
              Funzionalità
            </a>
            <a href="/#piani" className="public-layout-header-link">
              Piani
            </a>
            <Link to="/support" className="public-layout-header-link">
              Supporto
            </Link>
            <Link to="/contatti" className="public-layout-header-link">
              Contatti
            </Link>
          </nav>
        ) : null}
        <div className="public-layout-header-trailing">
          <Link to="/login" className="public-layout-btn public-layout-btn--outline">
            Accedi
          </Link>
          <Link to={isSaaS ? "/contatti#prova-gratuita" : "/login"} className="public-layout-btn public-layout-btn--primary">
            Registrati ora
          </Link>
        </div>
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
            {isSaaS ? <Link to="/support">Supporto</Link> : null}
          </nav>
          <span className="public-layout-footer-copy">
            © {new Date().getFullYear()} {isSaaS ? "PizzaManager" : "Menu online"}
          </span>
        </div>
      </footer>

      <CookieBanner />
    </div>
  )
}
