import { useAuth } from "@/app/contexts/AuthContext"

export default function RoleGuard({ allowedRoles = [], children }) {
  const { role } = useAuth()

  if (!allowedRoles.includes(role)) return null

  return children
}
