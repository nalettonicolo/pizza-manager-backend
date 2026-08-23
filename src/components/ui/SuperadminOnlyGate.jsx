import { Navigate } from "react-router-dom"
import { useAuth } from "@/app/contexts/AuthContext"

/**
 * Per pagine che non sono "in arrivo" per il cliente — sono strumenti interni che NON
 * diventeranno mai una funzionalità del tenant (es. Test 4 reparti). A differenza di
 * ComingSoonGate (mostra "presto disponibile"), qui un tenant non vede nemmeno un messaggio:
 * viene rimandato altrove, come se la route non esistesse — stesso trattamento già usato per
 * l'account di test in PizzaioloIngressoPage.jsx.
 *
 * @param {{ redirectTo?: string, children: React.ReactNode }} props
 */
export default function SuperadminOnlyGate({ redirectTo = "/operative/dashboard", children }) {
  const { ruolo } = useAuth()
  if (ruolo !== "superadmin") return <Navigate to={redirectTo} replace />
  return children
}
