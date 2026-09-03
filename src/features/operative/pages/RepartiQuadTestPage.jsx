import { lazy, Suspense, useEffect, useState } from "react"
import { Link, Navigate, useNavigate, useLocation } from "react-router-dom"
import { useAuth } from "@/app/contexts/AuthContext"
import { CassaHeaderContext } from "@/app/contexts/CassaHeaderContext"
import { canAccessQuadReparti } from "@/constants/quadRepartiTest"
import { isDemoGiroSearch } from "@/utils/demoGiro"
import { withPreservedSupportSearch } from "@/utils/supportTenantOverride"
import { RepartiQuadTestProvider } from "@/features/operative/contexts/RepartiQuadTestContext"
import ScaledOperativeViewport from "@/features/operative/components/ScaledOperativeViewport"

/**
 * Stessa SPA dei route operativi, senza iframe: in Edge (Tracking Prevention) gli iframe
 * spesso non possono usare localStorage → sessione Supabase assente e comparsa di login / errori auth.
 *
 * Non usare MemoryRouter (o altri Router) qui: React Router 6 vieta Router annidati dentro BrowserRouter
 * e in produzione l’invariant fallisce con Error senza messaggio → schermata bianca.
 */
const PizzaioloDashboard = lazy(() => import("@/features/operative/pizzaiolo/pages/Dashboard"))
const Cucina = lazy(() => import("@/features/operative/cucina/pages/Cucina"))
const Bancone = lazy(() => import("@/features/operative/bancone/pages/Bancone"))
const DeliveryDashboard = lazy(() => import("@/features/operative/delivery/pages/DeliveryDashboard"))
const CassaPage = lazy(() => import("@/features/operative/cassa/pages/CassaPage"))

/** Nel test 4 reparti: tutte le delivery di oggi per fascia oraria; la route full screen resta sul flusso PRONTO. */
function DeliveryQuadTestPane() {
  return <DeliveryDashboard mode="quadTestBySlot" />
}

/** Cassa nel riquadro: toolbar reale (In negozio, Delivery, Ordini…) dentro il viewport in scala. */
function QuadCassaPane() {
  const [toolbar, setToolbar] = useState(null)
  return (
    <CassaHeaderContext.Provider value={{ setContent: setToolbar, setSidebar: () => {} }}>
      <div className="reparti-quad-cassa-shell">
        {toolbar ? <div className="reparti-quad-cassa-toolbar">{toolbar}</div> : null}
        <CassaPage />
      </div>
    </CassaHeaderContext.Provider>
  )
}

/** Reparti disponibili per ciascuno dei 4 riquadri: l'utente sceglie liberamente cosa vedere dove. */
const AVAILABLE_PANES = [
  { key: "cassa", label: "Cassa", El: QuadCassaPane },
  { key: "pizzaioli", label: "Pizzaioli", El: PizzaioloDashboard },
  { key: "bancone", label: "Bancone", El: Bancone },
  { key: "cucina", label: "Cucina", El: Cucina },
  { key: "delivery", label: "Delivery / pony", El: DeliveryQuadTestPane },
]
const PANE_BY_KEY = new Map(AVAILABLE_PANES.map((p) => [p.key, p]))

const DEFAULT_SELECTION = ["pizzaioli", "bancone", "cucina", "delivery"]
const SELECTION_STORAGE_KEY = "pm_reparti_quad_test_selection_v1"

function loadStoredSelection() {
  try {
    const raw = window.localStorage.getItem(SELECTION_STORAGE_KEY)
    const arr = raw ? JSON.parse(raw) : null
    if (!Array.isArray(arr) || arr.length !== 4) return DEFAULT_SELECTION
    return arr.map((k) => (PANE_BY_KEY.has(k) ? k : DEFAULT_SELECTION[0]))
  } catch {
    return DEFAULT_SELECTION
  }
}

function PanelFallback() {
  return (
    <div style={{ padding: 16, fontSize: 13, color: "#64748b" }}>Caricamento reparto…</div>
  )
}

export default function RepartiQuadTestPage() {
  const { user, logout, ruolo } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [reloadKey, setReloadKey] = useState(0)
  const [selection, setSelection] = useState(loadStoredSelection)
  const [expandedIndex, setExpandedIndex] = useState(null)
  const inDemo = isDemoGiroSearch(location.search)

  function updatePaneSelection(index, key) {
    setSelection((prev) => {
      const next = prev.map((k, i) => (i === index ? key : k))
      try {
        window.localStorage.setItem(SELECTION_STORAGE_KEY, JSON.stringify(next))
      } catch {
        /* ignore */
      }
      return next
    })
  }

  useEffect(() => {
    if (expandedIndex == null) return
    const onKey = (e) => {
      if (e.key === "Escape") setExpandedIndex(null)
    }
    document.addEventListener("keydown", onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.removeEventListener("keydown", onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [expandedIndex])

  const canAccessQuad = canAccessQuadReparti({ email: user?.email, ruolo, inDemo })
  if (!canAccessQuad) {
    return (
      <Navigate
        to={withPreservedSupportSearch("/operative/dashboard", location.search)}
        replace
      />
    )
  }

  return (
    <div className="reparti-quad-page">
      <div className="reparti-quad-topbar">
        <strong className="reparti-quad-topbar-title">Test 4 reparti</strong>
        <span className="reparti-quad-topbar-hint">
          Ogni riquadro mostra la schermata operativa reale. Usa Ingrandisci per vederla più grande.
        </span>
        <Link
          to={withPreservedSupportSearch("/operative/cassa", location.search)}
          className="reparti-quad-topbar-link reparti-quad-topbar-link--cassa"
        >
          Torna a Cassa
        </Link>
        <Link
          to={withPreservedSupportSearch("/operative/dashboard", location.search)}
          className="reparti-quad-topbar-link reparti-quad-topbar-link--riepilogo"
        >
          Riepilogo
        </Link>
        {inDemo ? (
          <button
            type="button"
            onClick={() => navigate("/superadmin/ingresso", { replace: true })}
            className="reparti-quad-topbar-demo-exit"
          >
            Esci demo
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => setReloadKey((k) => k + 1)}
          className="reparti-quad-topbar-reload"
        >
          Ricarica tutte le viste
        </button>
        <button
          type="button"
          className="btn-logout btn-logout-red"
          style={{ padding: "6px 14px", fontSize: 13 }}
          onClick={() => void logout().then(() => navigate("/login", { replace: true }))}
        >
          Esci
        </button>
      </div>

      <RepartiQuadTestProvider>
        {expandedIndex != null ? (
          <button
            type="button"
            className="reparti-quad-expand-backdrop"
            aria-label="Chiudi vista ingrandita"
            onClick={() => setExpandedIndex(null)}
          />
        ) : null}
        <div className="reparti-quad-grid">
          {selection.map((key, index) => {
            const f = PANE_BY_KEY.get(key) || AVAILABLE_PANES[0]
            const Comp = f.El
            const expanded = expandedIndex === index
            return (
              <div key={`slot-${index}`} className="reparti-quad-slot">
                <div
                  className={`reparti-quad-pane${expanded ? " reparti-quad-pane--expanded" : ""}`}
                  role={expanded ? "dialog" : undefined}
                  aria-modal={expanded ? true : undefined}
                  aria-label={expanded ? `${f.label} — vista ingrandita` : undefined}
                >
                  <div className="reparti-quad-pane-chrome">
                    <select
                      value={f.key}
                      onChange={(e) => updatePaneSelection(index, e.target.value)}
                      aria-label={`Reparto riquadro ${index + 1}`}
                    >
                      {AVAILABLE_PANES.map((p) => (
                        <option key={p.key} value={p.key}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                    {expanded ? (
                      <button
                        type="button"
                        className="reparti-quad-expand-btn"
                        onClick={() => setExpandedIndex(null)}
                      >
                        Chiudi
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="reparti-quad-expand-btn"
                        onClick={() => setExpandedIndex(index)}
                        title={`Apri ${f.label} più grande`}
                      >
                        Ingrandisci
                      </button>
                    )}
                  </div>
                  <div className="reparti-quad-panel-body">
                    <ScaledOperativeViewport>
                      <Suspense fallback={<PanelFallback />}>
                        <Comp key={`${index}-${f.key}-${reloadKey}`} />
                      </Suspense>
                    </ScaledOperativeViewport>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </RepartiQuadTestProvider>
    </div>
  )
}
