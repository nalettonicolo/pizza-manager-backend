import { Link } from "react-router-dom"
import { useAuth } from "@/app/contexts/AuthContext"
import { getPublicTenantInfo } from "@/features/services/publicService"
import { useEffect, useState } from "react"

export default function ClienteDashboardPage() {
  const { user, logout } = useAuth()
  const [nomePizzeria, setNomePizzeria] = useState("")

  useEffect(() => {
    getPublicTenantInfo().then((t) => setNomePizzeria((t?.nome || "").trim()))
  }, [])

  return (
    <div style={{ maxWidth: 560, margin: "0 auto", padding: "24px 16px 48px" }}>
      <h1 style={{ fontSize: 22, marginBottom: 8 }}>Il tuo account</h1>
      <p style={{ color: "#64748b", marginBottom: 24, fontSize: 14 }}>
        {nomePizzeria ? <>Collegato a <strong>{nomePizzeria}</strong>.</> : "Area riservata clienti."}
      </p>
      <p style={{ fontSize: 14, marginBottom: 20 }}>
        Accesso come <strong>{user?.email}</strong>
      </p>
      <nav style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <Link
          to="/"
          style={{
            padding: "12px 16px",
            borderRadius: 8,
            background: "#0f172a",
            color: "#fff",
            textDecoration: "none",
            fontWeight: 600,
            textAlign: "center",
          }}
        >
          Vai al menù
        </Link>
        <Link
          to="/cliente/ordini"
          style={{
            padding: "12px 16px",
            borderRadius: 8,
            border: "1px solid #e2e8f0",
            color: "#0f172a",
            textDecoration: "none",
            fontWeight: 600,
            textAlign: "center",
          }}
        >
          I miei ordini
        </Link>
        <Link
          to="/cliente/profilo"
          style={{
            padding: "12px 16px",
            borderRadius: 8,
            border: "1px solid #e2e8f0",
            color: "#0f172a",
            textDecoration: "none",
            fontWeight: 600,
            textAlign: "center",
          }}
        >
          Profilo
        </Link>
        <button
          type="button"
          onClick={() => void logout()}
          style={{
            padding: "12px 16px",
            borderRadius: 8,
            border: "1px solid #fecaca",
            background: "#fef2f2",
            color: "#991b1b",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Esci
        </button>
      </nav>
    </div>
  )
}
