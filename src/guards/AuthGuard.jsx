import { Navigate } from "react-router-dom"
import { useAuth } from "@/app/contexts/AuthContext"

export default function AuthGuard({ children }) {
  const { user, loading } = useAuth()

  if (loading) return null

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return children
}
