import { useEffect, useState } from "react"
import { useTenant } from "@/app/contexts/TenantContext"
import { getDashboardStats } from "@/features/admin/services/adminService"
import DashboardNavCards from "@/components/dashboard/DashboardNavCards"
import { formatPrice } from "@/utils/format"

const ADMIN_NAV = [
  { to: "/admin/dashboard", label: "Riepilogo", description: "Ordini e fatturato" },
  { to: "/admin/menu", label: "Menu", description: "Prodotti e categorie" },
  { to: "/admin/report", label: "Report", description: "Statistiche e resoconti" },
  { to: "/admin/settings", label: "Impostazioni", description: "Configurazione pizzeria" },
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
