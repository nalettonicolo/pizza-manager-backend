import { useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { ENABLE_TEST_REPARTI } from "@/constants/testReparti";

const REPARTI = [
  { path: "/operative/dashboard", label: "Riepilogo" },
  { path: "/operative/cassa", label: "Cassa" },
  { path: "/operative/cucina", label: "Cucina" },
  { path: "/operative/bancone", label: "Bancone" },
  { path: "/operative/pizzaioli", label: "Pizzaioli" },
  { path: "/operative/delivery", label: "Delivery" },
  { path: "/operative/turni", label: "Turni" },
  { path: "/operative/cassa/prodotti-esauriti", label: "Prodotti esauriti" },
];

export default function TestRepartiPanelPage() {
  const [key, setKey] = useState(0);
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  const urls = useMemo(
    () => REPARTI.map((r) => ({ ...r, src: `${origin}${r.path}` })),
    [origin],
  );

  if (!ENABLE_TEST_REPARTI) {
    return <Navigate to="/superadmin/dashboard" replace />;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 56px - 48px)", minHeight: 480 }}>
      <div
        style={{
          flexShrink: 0,
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 12,
          marginBottom: 12,
          paddingBottom: 12,
          borderBottom: "1px solid #e2e8f0",
        }}
      >
        <Link
          to="/superadmin/dashboard"
          style={{
            padding: "8px 14px",
            background: "#d35400",
            color: "#fff",
            borderRadius: 6,
            textDecoration: "none",
            fontWeight: 600,
            fontSize: 13,
          }}
        >
          ← Ingresso
        </Link>
        <h1 style={{ margin: 0, fontSize: 18, color: "#0f172a" }}>Pannello test reparti</h1>
        <span style={{ fontSize: 13, color: "#64748b" }}>
          Tutte le schermate caricate insieme (iframe). Uso solo per test.
        </span>
        <button
          type="button"
          onClick={() => setKey((k) => k + 1)}
          style={{
            marginLeft: "auto",
            padding: "8px 14px",
            border: "1px solid #cbd5e1",
            borderRadius: 6,
            background: "#fff",
            cursor: "pointer",
            fontSize: 13,
          }}
        >
          Ricarica tutte le viste
        </button>
      </div>

      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: "grid",
          gridTemplateColumns: "repeat(2, 1fr)",
          gridTemplateRows: "repeat(4, minmax(180px, 1fr))",
          gap: 8,
        }}
      >
        {urls.map((item) => (
          <div
            key={`${item.path}-${key}`}
            style={{
              display: "flex",
              flexDirection: "column",
              minHeight: 0,
              border: "1px solid #cbd5e1",
              borderRadius: 8,
              overflow: "hidden",
              background: "#f8fafc",
            }}
          >
            <div
              style={{
                flexShrink: 0,
                padding: "6px 10px",
                fontSize: 12,
                fontWeight: 700,
                color: "#334155",
                background: "#e2e8f0",
                borderBottom: "1px solid #cbd5e1",
              }}
            >
              {item.label}
            </div>
            <iframe
              title={item.label}
              src={item.src}
              style={{ flex: 1, width: "100%", minHeight: 0, border: "none" }}
              sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
