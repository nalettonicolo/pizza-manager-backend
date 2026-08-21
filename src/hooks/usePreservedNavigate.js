import { useCallback } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { withPreservedSupportSearch } from "@/utils/supportTenantOverride"

/** navigate() che mantiene support_tenant / _demo_giro (demo SA). */
export function usePreservedNavigate() {
  const navigate = useNavigate()
  const location = useLocation()
  return useCallback(
    (to, options) => {
      navigate(withPreservedSupportSearch(to, location.search), options)
    },
    [navigate, location.search],
  )
}
