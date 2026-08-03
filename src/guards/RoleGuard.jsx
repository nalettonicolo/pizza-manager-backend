import { Navigate } from "react-router-dom"
import { useUser } from "@/app/contexts/UserContext"
import { isSuperAdminRole, normalizeAppRuolo } from "@/utils/superAdminAccess"

export default function RoleGuard({ allowedRoles, children }) {
  const { ruolo } = useUser()
  const ruoloNorm = normalizeAppRuolo(ruolo)

  if (isSuperAdminRole(ruoloNorm)) {
    return children
  }

  if (!allowedRoles.map((r) => normalizeAppRuolo(r)).includes(ruoloNorm)) {
    return <Navigate to="/" replace />
  }

  return children
}
