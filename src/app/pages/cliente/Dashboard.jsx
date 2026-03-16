import { Link } from "react-router-dom"

export default function ClienteDashboard() {
  return (
    <div style={{ padding: 24 }}>
      <h1>Area Cliente</h1>
      <p>Dashboard cliente – in costruzione.</p>
      <nav>
        <Link to="/cliente/ordini">Ordini</Link> | <Link to="/cliente/profilo">Profilo</Link>
      </nav>
    </div>
  )
}
