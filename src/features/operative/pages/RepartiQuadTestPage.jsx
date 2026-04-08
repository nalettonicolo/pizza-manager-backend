import { useMemo, useState } from "react"
import { Link, Navigate, useNavigate } from "react-router-dom"
import { useAuth } from "@/app/contexts/AuthContext"
import { isQuadRepartiTestEmail } from "@/constants/quadRepartiTest"

const PANES = [
  { path: "/operative/pizzaioli", label: "Pizzaioli", position: "In alto a sinistra" },
  { path: "/operative/bancone", label: "Bancone", position: "In alto a destra" },
  { path: "/operative/cucina", label: "Cucina", position: "In basso a sinistra" },
  { path: "/operative/delivery", label: "Delivery / pony", position: "In basso a destra" },
]

export default function RepartiQuadTestPage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [reloadKey, setReloadKey] = useState(0)

  const origin = typeof window !== "undefined" ? window.location.origin : ""
  /** pm_embed=1: le singole viste non reindirizzano alla griglia 4×4 (iframe / Edge). */
  const frames = useMemo(
    () =>
      PANES.map((p) => ({
        ...p,
        src: `${origin}${p.path}?pm_embed=1`,
      })),
    [origin],
  )

  if (!isQuadRepartiTestEmail(user?.email)) {
    return <Navigate to="/operative/dashboard" replace />
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        minHeight: 0,
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
          Pizzaioli · Bancone · Cucina · Delivery (sessione condivisa)
        </span>
        <Link
          to="/operative/dashboard"
          style={{ fontSize: 13, color: "#c0392b", fontWeight: 600, marginLeft: 8 }}
        >
          Riepilogo classico
        </Link>
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

      <div
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
        {frames.map((f) => (
          <div
            key={f.path}
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
                padding: "4px 8px",
                fontSize: 11,
                fontWeight: 700,
                color: "#334155",
                background: "#f8fafc",
                borderBottom: "1px solid #e2e8f0",
              }}
            >
              {f.position}: {f.label}
            </div>
            <iframe
              key={`${f.path}-${reloadKey}`}
              title={f.label}
              src={f.src}
              style={{
                flex: 1,
                width: "100%",
                minHeight: 0,
                border: "none",
              }}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
