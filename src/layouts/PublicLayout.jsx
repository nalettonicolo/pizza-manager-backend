import { useEffect, useMemo, useState } from "react"
import { Outlet, Link, useLocation } from "react-router-dom"
import CookieBanner from "@/features/public/components/CookieBanner"
import PwaInstallBanner from "@/features/public/components/PwaInstallBanner"
import {
  applyPublicPwaManifest,
  removePublicPwaManifest,
  registerPublicServiceWorker,
} from "@/utils/publicPwaManifest"
import OrdineOnlineDisattivoModal from "@/features/public/components/OrdineOnlineDisattivoModal"
import ClienteHeaderAccount from "@/features/public/components/ClienteHeaderAccount"
import AgenteChatWidget from "@/features/public/components/AgenteChatWidget"
import { useAuth } from "@/app/contexts/AuthContext"
import { adminHomeWithSupportSearch } from "@/constants/adminTenantHome"
import { getIsSaaSClient } from "@/utils/saasHost"
import { getPublicTenantInfo } from "@/features/services/publicService"
import { PublicCartProvider } from "@/app/contexts/PublicCartContext"
import { readOrdiniOnlineVetrinaAllowed } from "@/utils/ordiniOnlineAttivi"
import { applyTenantFavicon } from "@/utils/tenantFavicon"
import { applyTenantDocumentTitle } from "@/utils/tenantDocumentTitle"
import { isSuperAdminRole, normalizeAppRuolo } from "@/utils/superAdminAccess"
import SaHomeButton from "@/components/SaHomeButton"
import ThemeToggle from "@/components/ThemeToggle"
import { isDemoGiroSearch, isDemoGiroSessionActive } from "@/utils/demoGiro"
import { withPreservedSupportSearch } from "@/utils/supportTenantOverride"
import { setCurrentTenantId } from "@/utils/currentTenantContext"
import logoPizzaManager from "@/assets/logo/logo-pizzamanager.png"
import "@/styles/public-layout.css"

const DISMISS_KEY = "pm_ordine_online_modal_dismiss"

export default function PublicLayout() {
  const isSaaS = getIsSaaSClient()
  const { pathname, search } = useLocation()
  const isLanding = isSaaS && pathname === "/"
  /** Pagina vendita online: nav centrale (landing la mostra solo su `/`). */
  const isVetrinaPage = pathname === "/negozio" || pathname === "/preview"
  const customerAuthQuery = (() => {
    const qs = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search)
    qs.set("cliente", "1")
    qs.set("return_to", `${pathname}${search || ""}`)
    return `?${qs.toString()}`
  })()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [tenantName, setTenantName] = useState("")
  const [publicTenantId, setPublicTenantId] = useState(null)
  const [publicParametri, setPublicParametri] = useState(null)
  /** Riga tenant (licenza / piano) per gate ordini online vetrina */
  const [publicTenantRow, setPublicTenantRow] = useState(null)
  const { user, ruolo, tipoUtente, tenantId: authTenantId, loading: authLoading } = useAuth()
  const clienteLoggato = tipoUtente === "cliente" && Boolean(user)
  const [modalDismissed, setModalDismissed] = useState(() =>
    typeof sessionStorage !== "undefined" && sessionStorage.getItem(DISMISS_KEY) === "1",
  )
  const ruoloNorm = normalizeAppRuolo(ruolo)
  const staffAdminOnVetrina =
    Boolean(user) &&
    tipoUtente === "staff" &&
    (isSuperAdminRole(ruolo) || ruoloNorm === "admin" || ruoloNorm === "owner")
  const vetrinaAccediTo =
    isVetrinaPage && staffAdminOnVetrina
      ? adminHomeWithSupportSearch(search)
      : isVetrinaPage
        ? `/login${customerAuthQuery}`
        : "/login"

  useEffect(() => {
    let cancelled = false
    if (isLanding) {
      setTenantName("")
      setPublicTenantId(null)
      setPublicParametri(null)
      setPublicTenantRow(null)
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
          setPublicTenantRow(tenant && typeof tenant === "object" ? tenant : null)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setTenantName("")
          setPublicTenantId(null)
          setPublicParametri(null)
          setPublicTenantRow(null)
        }
      })
    return () => {
      cancelled = true
    }
  }, [isLanding, search])

  // Tenant della vetrina visitata, noto anche fuori da React per il listener globale
  // window.onerror/unhandledrejection in main.jsx — solo per visitatori anonimi: se c'è già una
  // sessione autenticata (staff/cliente), TenantContext resta la fonte di verità.
  useEffect(() => {
    if (!authTenantId) setCurrentTenantId(publicTenantId)
  }, [publicTenantId, authTenantId])

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
    if (readOrdiniOnlineVetrinaAllowed(publicParametri, publicTenantRow)) return false
    if (modalDismissed) return false
    return true
  }, [authLoading, isLanding, publicTenantId, tipoUtente, authTenantId, publicParametri, publicTenantRow, modalDismissed])
  const vetrinaOrdiniOnlineEnabled = useMemo(
    () => readOrdiniOnlineVetrinaAllowed(publicParametri, publicTenantRow),
    [publicParametri, publicTenantRow],
  )

  const dismissOrdineOnlineModal = () => {
    try {
      sessionStorage.setItem(DISMISS_KEY, "1")
    } catch {
      /* ignore */
    }
    setModalDismissed(true)
  }

  const logoLabel = isLanding ? "PizzaManager" : (tenantName || "PizzaManager")
  const logoUrl = isLanding ? logoPizzaManager : (publicTenantRow?.logo_url ?? null)

  useEffect(() => {
    void applyTenantFavicon(logoUrl || logoPizzaManager)
  }, [logoUrl])

  useEffect(() => {
    applyTenantDocumentTitle(isLanding ? null : tenantName)
  }, [isLanding, tenantName])

  // Manifest PWA solo sulle pagine pubbliche (vetrina/checkout/area cliente) — mai su
  // admin/superadmin/operative, che hanno le loro schermate dedicate (es. manifest-rider).
  useEffect(() => {
    applyPublicPwaManifest()
    registerPublicServiceWorker()
    return () => removePublicPwaManifest()
  }, [])

  const prefetchLogin = () => {
    void import("@/features/public/pages/Login")
  }

  const prefetchRegistrazione = () => {
    void import("@/features/public/pages/ClienteRegistrazionePage")
  }

  return (
    <PublicCartProvider tenantId={publicTenantId}>
      <div className={`public-layout-root${clienteLoggato && isVetrinaPage ? " public-layout-root--cliente-menu" : ""}`}>
      <header className={`public-layout-header${isSaaS ? " public-layout-header--saas" : ""}`}>
        <Link to="/" className="public-layout-logo">
          {logoUrl ? (
            <img src={logoUrl} alt="" className="public-layout-logo-img" width={40} height={40} />
          ) : null}
          <span className="public-layout-logo-text">{logoLabel}</span>
        </Link>
        {isVetrinaPage && !clienteLoggato ? (
          <nav className="public-layout-nav-vetrina" aria-label="Menu vetrina">
            <a href="#public-menu" className="public-layout-header-link">
              Menù
            </a>
            <Link to="/contatti" className="public-layout-header-link">
              Contatti
            </Link>
            <Link to="/support" className="public-layout-header-link">
              Supporto
            </Link>
          </nav>
        ) : null}
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
          <ThemeToggle />
          {(isDemoGiroSearch(search) || isDemoGiroSessionActive()) &&
          isSuperAdminRole(ruolo) &&
          tipoUtente === "staff" ? (
            <Link
              to={withPreservedSupportSearch("/operative/dashboard", search)}
              className="public-layout-btn public-layout-btn--outline"
              title="Torna all’hub demo operativa"
            >
              Hub demo
            </Link>
          ) : null}
          {isSuperAdminRole(ruolo) ? <SaHomeButton compact /> : null}
          {clienteLoggato ? (
            <>
              <ClienteHeaderAccount />
              {isVetrinaPage && vetrinaOrdiniOnlineEnabled ? (
                <Link
                  to={`/ordina${search || ""}`}
                  className="public-layout-btn public-layout-btn--primary"
                  title="Vai al checkout per la consegna a domicilio"
                >
                  Completa l&apos;ordine
                </Link>
              ) : null}
            </>
          ) : (
            <>
              <Link
                to={vetrinaAccediTo}
                className="public-layout-btn public-layout-btn--outline"
                onMouseEnter={staffAdminOnVetrina ? undefined : prefetchLogin}
                onFocus={staffAdminOnVetrina ? undefined : prefetchLogin}
              >
                {staffAdminOnVetrina && isVetrinaPage ? "Admin" : "Accedi"}
              </Link>
              {isVetrinaPage && !vetrinaOrdiniOnlineEnabled ? null : (
                <Link
                  to={isVetrinaPage ? `/registrazione${search || ""}` : isSaaS ? "/contatti#prova-gratuita" : "/registrazione"}
                  className="public-layout-btn public-layout-btn--primary"
                  onMouseEnter={isSaaS ? undefined : prefetchRegistrazione}
                  onFocus={isSaaS ? undefined : prefetchRegistrazione}
                >
                  {isVetrinaPage ? "Crea account" : isSaaS ? "Registrati ora" : "Crea account"}
                </Link>
              )}
            </>
          )}
        </div>
      </header>

      <PwaInstallBanner />

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
          <span className="public-layout-footer-copy">© 2026 PizzaManager di Naletto Nicolò</span>
        </div>
      </footer>

      <CookieBanner />

      {/* Assistente marketing: solo sito pubblico SaaS, non sulla vetrina ordini del singolo tenant. */}
      {isSaaS && !isVetrinaPage ? <AgenteChatWidget modalita="marketing" /> : null}
      {/* Assistente cliente: sulla vetrina di un tenant, per menu/orari/tempi di attesa — mai domande fuori tema. */}
      {isVetrinaPage && publicTenantId ? <AgenteChatWidget modalita="cliente" tenantId={publicTenantId} /> : null}

      <OrdineOnlineDisattivoModal open={showOrdineOnlineModal} onDismiss={dismissOrdineOnlineModal} localeNome={tenantName} />
      </div>
    </PublicCartProvider>
  )
}
