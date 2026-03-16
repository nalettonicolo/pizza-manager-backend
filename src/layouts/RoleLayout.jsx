import { Navigate } from "react-router-dom"
import { useUser } from "@/app/contexts/UserContext"

export default function RoleLayout({ allowedRoles, children }) {
  const { ruolo } = useUser()

  if (!ruolo || !allowedRoles.includes(ruolo)) {
    return <Navigate to="/login" replace />
  }

  return children
}
