import { Link } from "react-router-dom"

export default function ClienteOrdiniPage() {
  return (
    <div style={{ maxWidth: 560, margin: "0 auto", padding: "24px 16px 48px" }}>
      <h1 style={{ fontSize: 22, marginBottom: 12 }}>I miei ordini</h1>
      <p style={{ color: "#64748b", lineHeight: 1.6, marginBottom: 20 }}>
        Qui potrai consultare lo storico ordini collegati al tuo account. Funzione in arrivo con il completamento degli ordini
        online da vetrina.
      </p>
      <Link to="/cliente/dashboard" style={{ color: "#c0392b", fontWeight: 600 }}>
        ← Torna all’area cliente
      </Link>
    </div>
  )
}
