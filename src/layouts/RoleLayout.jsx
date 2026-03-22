import { Navigate } from "react-router-dom"
import { useUser } from "@/app/contexts/UserContext"

export default function RoleLayout({ allowedRoles, children }) {
  const { ruolo } = useUser()

  const ruoloNorm = ruolo && typeof ruolo === "string" ? ruolo.toLowerCase().trim() : ""
  const allowed = allowedRoles.some(
    (r) => (r && typeof r === "string" ? r.toLowerCase().trim() : "") === ruoloNorm
  )

  if (!ruoloNorm || !allowed) {
    return <Navigate to="/login" replace />
  }

  return children
}
