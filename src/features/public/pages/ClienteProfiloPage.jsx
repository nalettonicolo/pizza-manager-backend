import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { supabase } from "@/lib/supabaseClient"
import { useAuth } from "@/app/contexts/AuthContext"
import Loader from "@/components/feedback/Loader"
import { getIsSaaSClient } from "@/utils/saasHost"

export default function ClienteProfiloPage() {
  const { user } = useAuth()
  const [row, setRow] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user?.id) {
      setLoading(false)
      return
    }
    let c = false
    supabase
      .from("clienti")
      .select("nome, email, telefono, indirizzo, tenant_id")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!c) {
          if (!error) setRow(data)
          setLoading(false)
        }
      })
    return () => {
      c = true
    }
  }, [user?.id])

  if (loading) return <Loader />

  return (
    <div style={{ maxWidth: 560, margin: "0 auto", padding: "24px 16px 48px" }}>
      <h1 style={{ fontSize: 22, marginBottom: 16 }}>Profilo</h1>
      <dl style={{ fontSize: 14, lineHeight: 1.7, marginBottom: 24 }}>
        <dt style={{ color: "#64748b", fontWeight: 600 }}>Email (accesso)</dt>
        <dd style={{ margin: "0 0 12px" }}>{user?.email || "—"}</dd>
        <dt style={{ color: "#64748b", fontWeight: 600 }}>Nome</dt>
        <dd style={{ margin: "0 0 12px" }}>{row?.nome || "—"}</dd>
        <dt style={{ color: "#64748b", fontWeight: 600 }}>Telefono</dt>
        <dd style={{ margin: "0 0 12px" }}>{row?.telefono || "—"}</dd>
        <dt style={{ color: "#64748b", fontWeight: 600 }}>Indirizzo</dt>
        <dd style={{ margin: "0 0 12px" }}>{row?.indirizzo || "—"}</dd>
      </dl>
      <p style={{ fontSize: 13, color: "#94a3b8", marginBottom: 16 }}>
        Per modificare i dati contatta la pizzeria.
        {!getIsSaaSClient() ? (
          <>
            {" "}
            La password si reimposta da <Link to="/password-dimenticata">Password dimenticata</Link>.
          </>
        ) : null}
      </p>
      <Link to="/cliente/dashboard" style={{ color: "#c0392b", fontWeight: 600 }}>
        ← Torna all’area cliente
      </Link>
    </div>
  )
}
