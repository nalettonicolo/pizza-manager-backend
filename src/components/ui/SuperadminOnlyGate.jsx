import { Navigate, useLocation } from "react-router-dom"
import { useAuth } from "@/app/contexts/AuthContext"
import { canAccessQuadReparti } from "@/constants/quadRepartiTest"
import { isDemoGiroSearch } from "@/utils/demoGiro"

/**
 * Strumenti interni che non diventano funzionalità del tenant (es. Test 4 reparti).
 * Super Admin, account pizzaiolo/pizzaioli @pizzamanager.it e Demo live passano;
 * un tenant viene rimandato via, come se la route non esistesse.
 *
 * @param {{ redirectTo?: string, children: React.ReactNode }} props
 */
export default function SuperadminOnlyGate({ redirectTo = "/operative/dashboard", children }) {
  const { ruolo, user } = useAuth()
  const location = useLocation()
  const inDemo = isDemoGiroSearch(location.search)
  if (canAccessQuadReparti({ email: user?.email, ruolo, inDemo })) return children
  return <Navigate to={redirectTo} replace />
}
