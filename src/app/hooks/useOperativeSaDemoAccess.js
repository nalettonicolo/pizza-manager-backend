import { useMemo } from "react"
import { useLocation } from "react-router-dom"
import { useAuth } from "@/app/contexts/AuthContext"
import {
  canEditTenantParametriInOperative,
  isSaDemoOrSupportContext,
  resolveOperativePermessiAree,
} from "@/utils/operativeSaDemoAccess"
import { isSuperAdminRole } from "@/utils/superAdminAccess"
import { isDemoGiroSearch } from "@/utils/demoGiro"

/**
 * Accesso pieno Super Admin in Demo live / support: permessi aree + edit parametri.
 */
export function useOperativeSaDemoAccess() {
  const { ruolo, permessiAree } = useAuth()
  const location = useLocation()
  const search = location.search || ""

  return useMemo(() => {
    const isSa = isSuperAdminRole(ruolo)
    const inDemoLive = isDemoGiroSearch(search)
    const inSaDemoOrSupport = isSaDemoOrSupportContext(ruolo, search)
    const permessiAreeEffective = resolveOperativePermessiAree(ruolo, permessiAree, search)
    const canEditParametri = (staffFlag) =>
      canEditTenantParametriInOperative(ruolo, staffFlag, search)

    return {
      isSa,
      inDemoLive,
      inSaDemoOrSupport,
      /** true: mostrare tutte le potenzialità (nav completa, edit, niente gate staff) */
      fullDemoAccess: isSa || inSaDemoOrSupport,
      permessiAreeEffective,
      canEditParametri,
    }
  }, [ruolo, permessiAree, search])
}
