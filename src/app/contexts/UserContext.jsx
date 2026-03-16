import { createContext, useContext, useMemo, useCallback } from "react"
import { useAuth } from "@/app/contexts/AuthContext"
import { getRolePermissions } from "@/utils/permissions"

const UserContext = createContext()

export function UserProvider({ children }) {
  const { user, profile, ruolo } = useAuth()

  const isAuthenticated = !!user

  // =====================================
  // PERMESSI DERIVATI DAL RUOLO PRINCIPALE
  // =====================================

  const permissions = useMemo(() => {
    if (!ruolo) return {}
    return getRolePermissions(ruolo)
  }, [ruolo])

  const hasPermission = useCallback(
    (key) => {
      if (!isAuthenticated) return false
      return permissions[key] === true
    },
    [permissions, isAuthenticated]
  )

  return (
    <UserContext.Provider
      value={{
        profile,
        ruolo,
        permissions,
        hasPermission,
        isAuthenticated,
      }}
    >
      {children}
    </UserContext.Provider>
  )
}

export function useUser() {
  return useContext(UserContext)
}
