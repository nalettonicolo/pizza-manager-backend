import { useEffect, useState } from "react"
import { useTenant } from "@/app/contexts/TenantContext"
import { getDashboardStats } from "@/features/admin/services/adminService"
import DashboardNavCards from "@/components/dashboard/DashboardNavCards"
import { formatPrice } from "@/utils/format"

const ADMIN_NAV = [
  { to: "/admin/dashboard", label: "Riepilogo", description: "KPI giornalieri (ordini, fatturato, utenti)" },
  { to: "/admin/guida", label: "Guida utente", description: "Manuale operativo aggiornato con l’app" },
  { to: "/admin/pubblicazione", label: "Pubblicazione sito", description: "Deploy e dominio del menu online (in evoluzione)" },
  { to: "/admin/report", label: "Report vendite", description: "Totali ordini, fatturato, prodotto top" },
  { to: "/admin/menu", label: "Menu", description: "Categorie, listini, allergeni" },
  { to: "/admin/menu/ingredienti", label: "Magazzino", description: "Ingredienti, quantità, costi unitari" },
  { to: "/admin/menu/pizze", label: "Pizze e prezzi", description: "Composizione e ricavi" },
  { to: "/admin/dipendenti", label: "Dipendenti", description: "Utenti del locale e ruoli" },
  { to: "/admin/ruoli", label: "Ruoli e permessi", description: "Accesso alle aree operative" },
  { to: "/admin/settings", label: "Impostazioni", description: "Dati pizzeria, orari, parametri" },
]

export default function Dashboard() {
  const { tenantId } = useTenant()
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!tenantId) {
      setLoading(false)
      return
    }

    async function loadStats() {
      try {
        setLoading(true)
        setError(null)
        const data = await getDashboardStats(tenantId)
        setStats(data)
      } catch (err) {
        console.error(err)
        setError("Errore caricamento statistiche")
        setStats({
          ordersCount: "—",
          revenue: "—",
          activeUsers: "—",
          recentOrders: [],
        })
      } finally {
        setLoading(false)
      }
    }

    loadStats()
  }, [tenantId])

  return (
    <>
      <h1 className="dashboard-page-title">Riepilogo</h1>

      <DashboardNavCards items={ADMIN_NAV} columns={4} />

      <p style={{ margin: "20px 0 0", fontSize: 13, color: "#64748b", maxWidth: 640 }}>
        KPI avanzati (ticket medio, pizze vendute, fasce orarie) e margini analitici sono in roadmap; il report attuale resta su totali e best seller.
      </p>

      {loading ? (
        <div className="dashboard-loading">
          <div className="skeleton" />
          <div className="skeleton-row" />
        </div>
      ) : (
        <>
          {error && <p className="dashboard-error-msg">{error}</p>}
          <div className="stat-cards cols-3">
            <div className="stat-card">
              <p className="stat-label">Ordini oggi</p>
              <p className="stat-value">{stats?.ordersCount ?? "—"}</p>
            </div>
            <div className="stat-card">
              <p className="stat-label">Fatturato oggi</p>
              <p className="stat-value">€ {formatPrice(stats?.revenue)}</p>
            </div>
            <div className="stat-card">
              <p className="stat-label">Utenti attivi</p>
              <p className="stat-value">{stats?.activeUsers ?? "—"}</p>
            </div>
          </div>
        </>
      )}
    </>
  )
}
