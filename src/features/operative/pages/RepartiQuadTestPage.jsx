import { lazy, Suspense, useState } from "react"
import { Link, Navigate, useNavigate, useLocation } from "react-router-dom"
import { useAuth } from "@/app/contexts/AuthContext"
import { isQuadRepartiTestEmail } from "@/constants/quadRepartiTest"
import { isSuperAdminRole } from "@/utils/superAdminAccess"
import { isDemoGiroSearch } from "@/utils/demoGiro"
import { withPreservedSupportSearch } from "@/utils/supportTenantOverride"
import { RepartiQuadTestProvider } from "@/features/operative/contexts/RepartiQuadTestContext"

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

/** Reparti disponibili per ciascuno dei 4 riquadri: l'utente sceglie liberamente cosa vedere dove. */
const AVAILABLE_PANES = [
  { key: "cassa", label: "Cassa", El: CassaPage },
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

  const canAccessQuad =
    isQuadRepartiTestEmail(user?.email) || isSuperAdminRole(ruolo) || inDemo
  if (!canAccessQuad) {
    return (
      <Navigate
        to={withPreservedSupportSearch("/operative/dashboard", location.search)}
        replace
      />
    )
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        minHeight: "100%",
        flex: 1,
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          flexShrink: 0,
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 10,
          padding: "10px 12px",
          borderBottom: "1px solid #e2e8f0",
          background: "#fff",
        }}
      >
        <strong style={{ fontSize: 14, color: "#0f172a" }}>Test 4 reparti</strong>
        <span style={{ fontSize: 12, color: "#64748b" }}>
          Scegli il reparto in ciascun riquadro (sessione condivisa, senza iframe)
        </span>
        <Link
          to={withPreservedSupportSearch("/operative/cassa", location.search)}
          style={{ fontSize: 13, color: "#0f766e", fontWeight: 600, marginLeft: 8 }}
        >
          Torna a Cassa
        </Link>
        <Link
          to={withPreservedSupportSearch("/operative/dashboard", location.search)}
          style={{ fontSize: 13, color: "#c0392b", fontWeight: 600, marginLeft: 8 }}
        >
          Riepilogo
        </Link>
        {inDemo ? (
          <button
            type="button"
            onClick={() => navigate("/superadmin/ingresso", { replace: true })}
            style={{
              padding: "6px 12px",
              fontSize: 13,
              fontWeight: 600,
              border: "1px solid #fecaca",
              borderRadius: 6,
              background: "#fef2f2",
              color: "#b91c1c",
              cursor: "pointer",
            }}
          >
            Esci demo
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => setReloadKey((k) => k + 1)}
          style={{
            marginLeft: "auto",
            padding: "6px 12px",
            fontSize: 13,
            border: "1px solid #cbd5e1",
            borderRadius: 6,
            background: "#fff",
            cursor: "pointer",
          }}
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
        <div
          className="reparti-quad-grid"
          style={{
            flex: 1,
            minHeight: 0,
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gridTemplateRows: "1fr 1fr",
            gap: 6,
            padding: 6,
            background: "#e2e8f0",
          }}
        >
          {selection.map((key, index) => {
            const f = PANE_BY_KEY.get(key) || AVAILABLE_PANES[0]
            const Comp = f.El
            return (
              <div
                key={`slot-${index}-${f.key}-${reloadKey}`}
                style={{
                  position: "relative",
                  minHeight: 0,
                  minWidth: 0,
                  background: "#fff",
                  borderRadius: 8,
                  overflow: "hidden",
                  border: "1px solid #cbd5e1",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <div
                  style={{
                    flexShrink: 0,
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "4px 6px",
                    fontSize: 11,
                    fontWeight: 700,
                    color: "#334155",
                    background: "#f8fafc",
                    borderBottom: "1px solid #e2e8f0",
                  }}
                >
                  <select
                    value={f.key}
                    onChange={(e) => updatePaneSelection(index, e.target.value)}
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: "#334155",
                      padding: "2px 4px",
                      borderRadius: 4,
                      border: "1px solid #cbd5e1",
                      background: "#fff",
                    }}
                  >
                    {AVAILABLE_PANES.map((p) => (
                      <option key={p.key} value={p.key}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div
                  className="reparti-quad-panel-body"
                  style={{
                    flex: 1,
                    minHeight: 0,
                    overflow: "auto",
                    WebkitOverflowScrolling: "touch",
                  }}
                >
                  <Suspense fallback={<PanelFallback />}>
                    <Comp />
                  </Suspense>
                </div>
              </div>
            )
          })}
        </div>
      </RepartiQuadTestProvider>
    </div>
  )
}
