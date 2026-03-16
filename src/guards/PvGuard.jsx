import { Navigate } from "react-router-dom"
import { usePv } from "@/app/contexts/PvContext"

export default function PvGuard({ children }) {
  const { activePv, loading } = usePv()

  if (loading) return null

  if (!activePv) {
    return <Navigate to="/select-pv" replace />
  }

  return children
}
