import { Navigate } from "react-router-dom";
import { useTenantServizi } from "@/app/hooks/useTenantServizi";

/**
 * Reindirizza a incassi se il tenant ha solo `contabilita_semplice` (senza `contabilita_locale`).
 */
export default function ContabilitaFullRoutesGate({ children }) {
  const { contabilitaMode } = useTenantServizi();
  if (contabilitaMode === "semplice") {
    return <Navigate to="/admin/contabilita/incassi" replace />;
  }
  return children;
}
