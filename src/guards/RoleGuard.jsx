import { Navigate } from "react-router-dom"
import { useUser } from "@/app/contexts/UserContext"

export default function RoleGuard({ allowedRoles, children }) {
  const { ruolo } = useUser()

  if (!allowedRoles.includes(ruolo)) {
    return <Navigate to="/" replace />
  }

  return children
}
