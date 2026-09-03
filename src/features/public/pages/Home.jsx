import { useMemo, useEffect, useState, useCallback } from "react"
import { Link, useNavigate, useLocation } from "react-router-dom"
import DashboardNavCards from "@/components/dashboard/DashboardNavCards"
import Modal from "@/components/dashboard/Modal"
import { useAuth } from "@/app/contexts/AuthContext"
import { useTenant } from "@/app/contexts/TenantContext"
import { usePv } from "@/app/contexts/PvContext"
import { usePlan } from "@/app/hooks/usePlan"
import { useTenantServizi } from "@/app/hooks/useTenantServizi"
import { getTenantVenditeInsights } from "@/features/admin/services/adminService"
import { isSuperAdminRole, normalizeAppRuolo } from "@/utils/superAdminAccess"
import { withPreservedSupportSearch } from "@/utils/supportTenantOverride"
import { isDemoGiroSearch } from "@/utils/demoGiro"
import { ADMIN_HOME_SECTIONS } from "@/constants/adminTenantNav"

export default function Home() {
  const navigate = useNavigate()
  const location = useLocation()
  const { ruolo } = useAuth()
  const { tenantData, tenantId } = useTenant()
  const [venditeInsights, setVenditeInsights] = useState(null)
  const [menuSection, setMenuSection] = useState(null)
  const { pvList, selectPv } = usePv()
  const { plan, isPro, isEnterprise } = usePlan()
  const { hasServizio, enforcementActive } = useTenantServizi()
  const inDemoLive = isDemoGiroSearch(location.search)
  const ruoloNorm = normalizeAppRuolo(ruolo)
  const isAdmin = ruoloNorm === "admin" || ruoloNorm === "owner" || isSuperAdminRole(ruolo)

  const activePvs = useMemo(
    () => (pvList || []).filter((p) => p && p.attivo !== false),
    [pvList],
  )
  const showPanoramicaGruppo = isAdmin && activePvs.length > 1

  const sectionBlocks = useMemo(() => {
    const withSearch = (to) => withPreservedSupportSearch(to, location.search)
    return ADMIN_HOME_SECTIONS.map((section) => {
      const items = section.items
        .filter((item) => {
          if (item.contabilita) {
            if (enforcementActive) {
              return hasServizio("contabilita_locale") || hasServizio("contabilita_semplice")
            }
            return true
          }
          return !item.servizioId || hasServizio(item.servizioId)
        })
        .map((item) => ({
          to: withSearch(item.to),
          label: item.label,
          description: item.description,
        }))
      return { ...section, items }
    }).filter((s) => s.items.length > 0)
  }, [location.search, hasServizio, enforcementActive])

  const toolItems = useMemo(() => {
    const withSearch = (to) => withPreservedSupportSearch(to, location.search)
    const items = [
      {
        to: withSearch("/preview"),
        label: "Vetrina online",
        description: "Anteprima del menù pubblico",
      },
    ]
    if (pvList.length > 1) {
      items.unshift({
        to: withSearch("/select-pv"),
        label: "Cambia sede",
        description: "Seleziona il punto vendita attivo",
      })
    }
    if (inDemoLive) {
      items.push({
        to: withSearch("/operative/dashboard"),
        label: "Torna alla demo",
        description: "Hub reparti operativi",
      })
    }
    return items
  }, [location.search, pvList.length, inDemoLive])

  const closeMenu = useCallback(() => setMenuSection(null), [])

  const openSectionMenu = useCallback((title, items) => {
    setMenuSection({ title, items })
  }, [])

  const goToItem = useCallback(
    (to) => {
      setMenuSection(null)
      navigate(to)
    },
    [navigate],
  )

  useEffect(() => {
    if (!isAdmin || !tenantId) {
      setVenditeInsights(null)
      return
    }
    let cancelled = false
    const t = window.setTimeout(() => {
      getTenantVenditeInsights(tenantId)
        .then((d) => {
          if (!cancelled) setVenditeInsights(d)
        })
        .catch(() => {
          if (!cancelled) setVenditeInsights(null)
        })
    }, 1)
    return () => {
      cancelled = true
      window.clearTimeout(t)
    }
  }, [isAdmin, tenantId])

  const pianoLabel =
    plan === "PRO"
      ? "Pro"
      : plan === "ENTERPRISE"
        ? "Enterprise"
        : plan === "TRIAL"
          ? "Prova (14 giorni)"
          : plan === "FREE"
            ? "Free (legacy)"
            : plan

  if (isAdmin) {
    return (
      <div className="admin-tenant-home">
        <h1 className="dashboard-page-title admin-tenant-home-title">
          {inDemoLive ? "Admin del locale" : "Gestione locale"}
        </h1>
        <p className="admin-home-lede">
          {inDemoLive
            ? "Pannello del gestore: da qui configuri menu, staff e impostazioni del tenant demo."
            : "Scegli un’area qui sotto, oppure usa la barra in alto per passare da una sezione all’altra."}
        </p>

        <div className="dashboard-box admin-home-summary">
          <dl className="admin-home-summary-dl">
            <div>
              <dt>Locale</dt>
              <dd>{tenantData?.nome ?? "—"}</dd>
            </div>
            {(isPro || isEnterprise) && (
              <div>
                <dt>Piano</dt>
                <dd>{pianoLabel}</dd>
              </div>
            )}
            {activePvs.length === 1 && (
              <div>
                <dt>Sede</dt>
                <dd>{activePvs[0].nome}</dd>
              </div>
            )}
            {inDemoLive ? (
              <div>
                <dt>Modalità</dt>
                <dd>Demo live</dd>
              </div>
            ) : null}
          </dl>
        </div>

        {showPanoramicaGruppo && (
          <section className="dashboard-box admin-home-pv-strip">
            <h2 className="admin-home-section-title">Sedi attive</h2>
            <p className="admin-home-section-lede">Scegli il punto vendita con cui lavorare in questa sessione.</p>
            <div className="admin-home-pv-grid">
              {activePvs.map((pv) => (
                <button
                  key={pv.id}
                  type="button"
                  onClick={() => {
                    selectPv(pv.id)
                    navigate(withPreservedSupportSearch("/admin/home", location.search))
                  }}
                  className="admin-home-pv-btn"
                >
                  <span className="admin-home-pv-btn-name">{pv.nome || "Sede"}</span>
                  <span className="admin-home-pv-btn-hint">Imposta contesto</span>
                </button>
              ))}
            </div>
          </section>
        )}

        {sectionBlocks.map((section) => (
          <section key={section.id} className="admin-home-quick-section" aria-labelledby={`admin-sec-${section.id}`}>
            <div className="admin-home-section-head">
              <h2 id={`admin-sec-${section.id}`} className="admin-home-section-title">
                {section.title}
              </h2>
              <button
                type="button"
                className="admin-home-section-menu-btn"
                onClick={() => openSectionMenu(section.title, section.items)}
                aria-haspopup="dialog"
              >
                Menu
              </button>
            </div>
            {section.lede ? <p className="admin-home-section-lede">{section.lede}</p> : null}
            <DashboardNavCards items={section.items} columns={3} variant="hub" />
          </section>
        ))}

        <section className="admin-home-quick-section" aria-labelledby="admin-sec-tools">
          <div className="admin-home-section-head">
            <h2 id="admin-sec-tools" className="admin-home-section-title">
              Strumenti
            </h2>
            <button
              type="button"
              className="admin-home-section-menu-btn"
              onClick={() => openSectionMenu("Strumenti", toolItems)}
              aria-haspopup="dialog"
            >
              Menu
            </button>
          </div>
          <p className="admin-home-section-lede">Anteprima sito e documentazione.</p>
          <DashboardNavCards items={toolItems} columns={3} variant="hub" />
        </section>

        {venditeInsights && venditeInsights.ordiniAnalizzati > 0 && (
          <section className="dashboard-box admin-home-stats">
            <h3 className="admin-home-section-title">Statistiche vendite (campione recente)</h3>
            <p className="admin-home-stats-note">
              Basate sugli ultimi {venditeInsights.ordiniAnalizzati} ordini del locale (quantità per prodotto e clienti
              con più ordini).
            </p>
            <div className="admin-home-stats-grid">
              <div>
                <h4 className="admin-home-stats-subtitle">Pizze / prodotti più venduti</h4>
                <ol className="admin-home-stats-list">
                  {venditeInsights.topProducts.map((p) => (
                    <li key={p.id}>
                      {p.nome} — <span className="admin-home-stats-em">{p.qty}</span> pz.
                    </li>
                  ))}
                </ol>
              </div>
              <div>
                <h4 className="admin-home-stats-subtitle">Clienti con più ordini</h4>
                <ol className="admin-home-stats-list">
                  {venditeInsights.clientiTop.map((c, i) => (
                    <li key={i}>
                      {c.label} — <span className="admin-home-stats-em">{c.ordini}</span> ord.
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </section>
        )}

        <Modal
          open={Boolean(menuSection)}
          onClose={closeMenu}
          title={menuSection ? `${menuSection.title} — scegli` : ""}
          closeOnOverlayClick
        >
          {menuSection ? (
            <ul className="admin-home-section-menu-list">
              {menuSection.items.map((item) => (
                <li key={`${item.to}-${item.label}`}>
                  <button
                    type="button"
                    className="admin-home-section-menu-item"
                    onClick={() => goToItem(item.to)}
                  >
                    <span className="admin-home-section-menu-item-label">{item.label}</span>
                    {item.description ? (
                      <span className="admin-home-section-menu-item-desc">{item.description}</span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </Modal>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-xl font-semibold text-gray-900 mb-2">Benvenuto</h1>
        <p className="text-sm text-gray-500 mb-4">
          {tenantData?.nome ? `Pizzeria: ${tenantData.nome}` : "Scegli dove andare."}
        </p>
        {(isPro || isEnterprise) && (
          <p className="text-xs text-gray-500 mb-4">
            Piano: <span className="font-medium text-gray-700">{pianoLabel}</span>
          </p>
        )}
        <DashboardNavCards items={toolItems} columns={2} />
        <p style={{ marginTop: 16, fontSize: 13, color: "#64748b" }}>
          Per l’area gestione serve un account amministratore del locale.{" "}
          <Link to="/login" style={{ fontWeight: 600, color: "#1565c0" }}>
            Accedi
          </Link>
        </p>
      </div>
    </div>
  )
}
