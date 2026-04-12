import { useMemo, useEffect, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import DashboardNavCards from "@/components/dashboard/DashboardNavCards"
import { useAuth } from "@/app/contexts/AuthContext"
import { useTenant } from "@/app/contexts/TenantContext"
import { usePv } from "@/app/contexts/PvContext"
import { usePlan } from "@/app/hooks/usePlan"
import { getTenantVenditeInsights } from "@/features/admin/services/adminService"

const HOME_NAV = [
  { to: "/select-pv", label: "Scegli punto vendita", description: "Seleziona la pizzeria" },
  { to: "/preview", label: "Anteprima", description: "Vedi l’app in anteprima" },
]

export default function Home() {
  const navigate = useNavigate()
  const { ruolo } = useAuth()
  const { tenantData, tenantId } = useTenant()
  const [venditeInsights, setVenditeInsights] = useState(null)
  const { pvList, selectPv } = usePv()
  const { plan, isPro, isEnterprise } = usePlan()
  const homeNavItems = useMemo(
    () => HOME_NAV.filter((item) => item.to !== "/select-pv" || pvList.length > 1),
    [pvList],
  )

  const isAdmin = ruolo === "admin"

  const activePvs = useMemo(
    () => (pvList || []).filter((p) => p && p.attivo !== false),
    [pvList],
  )
  const showPanoramicaGruppo = isAdmin && activePvs.length > 1

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
        <h1 className="dashboard-page-title admin-tenant-home-title">Benvenuto</h1>

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
                <dt>Sede attiva</dt>
                <dd>{activePvs[0].nome}</dd>
              </div>
            )}
          </dl>
          <p className="admin-home-nav-hint">
            Menu, Magazzino, Contabilità, Impostazioni, Dipendenti e le altre sezioni sono nella{" "}
            <strong>barra blu in alto</strong>. Qui sotto trovi solo l’anteprima sito e, se serve, il cambio sede.
          </p>
          <p className="admin-home-nav-hint admin-home-nav-hint--secondary">
            Documentazione operativa: <Link to="/admin/manuale">Manuale utente</Link>
            {" · "}
            <Link to="/admin/report">Report</Link>
            {activePvs.length > 1 ? (
              <>
                {" · "}
                <Link to="/select-pv">Cambia sede</Link>
              </>
            ) : null}
          </p>
        </div>

        {showPanoramicaGruppo && (
          <section className="dashboard-box admin-home-pv-strip">
            <h2 className="admin-home-section-title">Sedi attive</h2>
            <p className="admin-home-section-lede">
              Scegli il punto vendita con cui lavorare in questa sessione.
            </p>
            <div className="admin-home-pv-grid">
              {activePvs.map((pv) => (
                <button
                  key={pv.id}
                  type="button"
                  onClick={() => {
                    selectPv(pv.id)
                    navigate("/admin/home")
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

        <section className="admin-home-quick-section" aria-label="Anteprima e strumenti">
          <h2 className="admin-home-section-title">Strumenti</h2>
          <DashboardNavCards items={homeNavItems} columns={2} />
        </section>

        {venditeInsights && venditeInsights.ordiniAnalizzati > 0 && (
          <section className="dashboard-box admin-home-stats">
            <h3 className="admin-home-section-title">Statistiche vendite (campione recente)</h3>
            <p className="admin-home-stats-note">
              Basate sugli ultimi {venditeInsights.ordiniAnalizzati} ordini del locale (quantità per prodotto e clienti con più ordini).
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
        <DashboardNavCards items={homeNavItems} columns={2} />
      </div>
    </div>
  )
}
