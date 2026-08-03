import { Navigate, useLocation } from "react-router-dom"
import { useUser } from "@/app/contexts/UserContext"
import { isSuperAdminRole, normalizeAppRuolo } from "@/utils/superAdminAccess"

export default function RoleLayout({ allowedRoles, children }) {
  const { ruolo } = useUser()
  const location = useLocation()

  const ruoloNorm = normalizeAppRuolo(ruolo)

  if (!ruoloNorm) {
    return (
      <div className="min-h-[200px] flex items-center justify-center">
        <span className="text-gray-400 text-sm">Accesso in corso...</span>
      </div>
    )
  }

  if (isSuperAdminRole(ruoloNorm)) {
    return children
  }

  const allowed = allowedRoles.some(
    (r) => (r && typeof r === "string" ? r.toLowerCase().trim() : "") === ruoloNorm,
  )

  if (!allowed) {
    return <Navigate to={`/login${location.search || ""}`} state={{ from: location }} replace />
  }

  return children
}
