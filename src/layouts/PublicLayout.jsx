import { useEffect, useMemo, useState } from "react"
import { Outlet, Link, useLocation } from "react-router-dom"
import CookieBanner from "@/features/public/components/CookieBanner"
import OrdineOnlineDisattivoModal from "@/features/public/components/OrdineOnlineDisattivoModal"
import { useAuth } from "@/app/contexts/AuthContext"
import { getIsSaaSClient } from "@/utils/saasHost"
import { getPublicTenantInfo } from "@/features/services/publicService"
import { PublicCartProvider } from "@/app/contexts/PublicCartContext"
import { readOrdiniOnlineAttivi } from "@/utils/ordiniOnlineAttivi"
import "@/styles/public-layout.css"

const DISMISS_KEY = "pm_ordine_online_modal_dismiss"

export default function PublicLayout() {
  const isSaaS = getIsSaaSClient()
  const { pathname, search } = useLocation()
  const isLanding = isSaaS && pathname === "/"
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [tenantName, setTenantName] = useState("")
  const [publicTenantId, setPublicTenantId] = useState(null)
  const [publicParametri, setPublicParametri] = useState(null)
  const { tipoUtente, tenantId: authTenantId, loading: authLoading } = useAuth()
  const [modalDismissed, setModalDismissed] = useState(() =>
    typeof sessionStorage !== "undefined" && sessionStorage.getItem(DISMISS_KEY) === "1",
  )

  useEffect(() => {
    let cancelled = false
    if (isLanding) {
      setTenantName("")
      setPublicTenantId(null)
      setPublicParametri(null)
      return () => {
        cancelled = true
      }
    }
    getPublicTenantInfo({ search })
      .then((tenant) => {
        if (!cancelled) {
          setTenantName((tenant?.nome || "").trim())
          setPublicTenantId(tenant?.id ?? null)
          const po = tenant?.parametri_operativi
          setPublicParametri(po && typeof po === "object" ? po : null)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setTenantName("")
          setPublicTenantId(null)
          setPublicParametri(null)
        }
      })
    return () => {
      cancelled = true
    }
  }, [isLanding, search])

  useEffect(() => {
    setMobileNavOpen(false)
  }, [pathname, search])

  useEffect(() => {
    if (!mobileNavOpen) return undefined
    const onKey = (e) => {
      if (e.key === "Escape") setMobileNavOpen(false)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [mobileNavOpen])

  useEffect(() => {
    if (!isLanding || !mobileNavOpen) return undefined
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = prev
    }
  }, [isLanding, mobileNavOpen])

  const showOrdineOnlineModal = useMemo(() => {
    if (authLoading || isLanding || !publicTenantId) return false
    if (tipoUtente !== "cliente" || !authTenantId) return false
    if (String(authTenantId) !== String(publicTenantId)) return false
    if (readOrdiniOnlineAttivi(publicParametri)) return false
    if (modalDismissed) return false
    return true
  }, [authLoading, isLanding, publicTenantId, tipoUtente, authTenantId, publicParametri, modalDismissed])

  const dismissOrdineOnlineModal = () => {
    try {
      sessionStorage.setItem(DISMISS_KEY, "1")
    } catch {
      /* ignore */
    }
    setModalDismissed(true)
  }

  const logoLabel = isLanding ? "PizzaManager" : (tenantName || "PizzaManager")

  const prefetchLogin = () => {
    void import("@/features/public/pages/Login")
  }

  const prefetchRegistrazione = () => {
    void import("@/features/public/pages/ClienteRegistrazionePage")
  }

  return (
    <div className="public-layout-root">
      <header className={`public-layout-header${isSaaS ? " public-layout-header--saas" : ""}`}>
        <Link to="/" className="public-layout-logo">
          {logoLabel}
        </Link>
        {isLanding ? (
          <>
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
            <button
              type="button"
              className="public-layout-mobile-menu-btn"
              aria-expanded={mobileNavOpen}
              aria-controls="public-landing-nav-mobile"
              aria-label={mobileNavOpen ? "Chiudi menu" : "Apri menu sezioni"}
              onClick={() => setMobileNavOpen((o) => !o)}
            >
              <span className="public-layout-mobile-menu-icon" aria-hidden>
                <span />
                <span />
                <span />
              </span>
            </button>
            {mobileNavOpen ? (
              <>
                <div
                  className="public-layout-nav-mobile-backdrop"
                  role="presentation"
                  onClick={() => setMobileNavOpen(false)}
                />
                <nav id="public-landing-nav-mobile" className="public-layout-nav-mobile-panel" aria-label="Sezioni sito">
                  <a href="/#perche" className="public-layout-nav-mobile-link" onClick={() => setMobileNavOpen(false)}>
                    Perché noi
                  </a>
                  <a href="/#funzionalita" className="public-layout-nav-mobile-link" onClick={() => setMobileNavOpen(false)}>
                    Funzionalità
                  </a>
                  <a href="/#piani" className="public-layout-nav-mobile-link" onClick={() => setMobileNavOpen(false)}>
                    Piani
                  </a>
                  <Link to="/support" className="public-layout-nav-mobile-link" onClick={() => setMobileNavOpen(false)}>
                    Supporto
                  </Link>
                  <Link to="/contatti" className="public-layout-nav-mobile-link" onClick={() => setMobileNavOpen(false)}>
                    Contatti
                  </Link>
                </nav>
              </>
            ) : null}
          </>
        ) : null}
        <div className="public-layout-header-trailing">
          <Link
            to="/login"
            className="public-layout-btn public-layout-btn--outline"
            onMouseEnter={prefetchLogin}
            onFocus={prefetchLogin}
          >
            Accedi
          </Link>
          <Link
            to={isSaaS ? "/contatti#prova-gratuita" : "/registrazione"}
            className="public-layout-btn public-layout-btn--primary"
            onMouseEnter={isSaaS ? undefined : prefetchRegistrazione}
            onFocus={isSaaS ? undefined : prefetchRegistrazione}
          >
            {isSaaS ? "Registrati ora" : "Crea account"}
          </Link>
        </div>
      </header>

      <main className="public-layout-main">
        <PublicCartProvider tenantId={publicTenantId}>
          <Outlet />
        </PublicCartProvider>
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

      <OrdineOnlineDisattivoModal open={showOrdineOnlineModal} onDismiss={dismissOrdineOnlineModal} localeNome={tenantName} />
    </div>
  )
}
