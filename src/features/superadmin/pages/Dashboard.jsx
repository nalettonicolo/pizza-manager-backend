import { useEffect, useState } from "react"
import { useTenant } from "@/app/contexts/TenantContext"
import { getDashboardStats } from "@/features/admin/services/adminService"
import { formatPrice } from "@/utils/format"

export default function Dashboard() {
  const { tenantId } = useTenant()
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!tenantId) return

    async function loadStats() {
      try {
        setLoading(true)
        const data = await getDashboardStats(tenantId)
        setStats(data)
      } catch {
        setError("Errore nel caricamento dashboard")
      } finally {
        setLoading(false)
      }
    }

    loadStats()
  }, [tenantId])

  if (loading) return <div className="p-6">Caricamento...</div>
  if (error) return <div className="p-6 text-red-500">{error}</div>
  if (!stats) return null

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

        <div className="bg-white shadow rounded-lg p-4">
          <h2 className="text-sm text-gray-500">Ordini Oggi</h2>
          <p className="text-2xl font-bold">{stats.ordersCount}</p>
        </div>

        <div className="bg-white shadow rounded-lg p-4">
          <h2 className="text-sm text-gray-500">Fatturato Oggi</h2>
          <p className="text-2xl font-bold">€ {formatPrice(stats.revenue)}</p>
        </div>

        <div className="bg-white shadow rounded-lg p-4">
          <h2 className="text-sm text-gray-500">Utenti Attivi</h2>
          <p className="text-2xl font-bold">{stats.activeUsers}</p>
        </div>

      </div>
    </div>
  )
}