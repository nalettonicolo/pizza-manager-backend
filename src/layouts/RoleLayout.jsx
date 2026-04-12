import { Navigate, useLocation } from "react-router-dom"
import { useUser } from "@/app/contexts/UserContext"
import { isViewportLayoutPreviewSearch } from "@/utils/viewportLayoutPreview"

export default function RoleLayout({ allowedRoles, children }) {
  const { ruolo } = useUser()
  const location = useLocation()

  const ruoloNorm = ruolo && typeof ruolo === "string" ? ruolo.toLowerCase().trim() : ""
  let allowed = allowedRoles.some(
    (r) => (r && typeof r === "string" ? r.toLowerCase().trim() : "") === ruoloNorm
  )
  if (!allowed && ruoloNorm === "superadmin" && isViewportLayoutPreviewSearch(location.search)) {
    allowed = true
  }

  if (!ruoloNorm || !allowed) {
    return <Navigate to="/login" replace />
  }

  return children
}
