import { createContext, useContext, useEffect, useState } from "react"
import { supabase } from "@/lib/supabaseClient"
import { useAuth } from "./AuthContext"

const TenantContext = createContext()

export function TenantProvider({ children }) {
  const { tenantId, user, loading: authLoading } = useAuth()

  const [tenantData, setTenantData] = useState(null)
  const [loading, setLoading] = useState(true)

  const isAuthenticated = !!user

  // ====================================
  // CARICA DATI TENANT
  // ====================================

  const loadTenantData = async () => {
    if (!tenantId) {
      setTenantData(null)
      setLoading(false)
      return
    }

    setLoading(true)

    const { data, error } = await supabase
      .from("tenants")
      .select("id, nome, slug, piano, attivo, logo_url, parametri_operativi, orari_settimana")
      .eq("id", tenantId)
      .single()

    if (error) {
      console.error("Errore caricamento tenant:", error)
      setTenantData(null)
    } else {
      setTenantData(data)
    }

    setLoading(false)
  }

  // ====================================
  // REAGISCE A CAMBIO AUTH
  // ====================================

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      loadTenantData()
    }

    if (!isAuthenticated) {
      setTenantData(null)
      setLoading(false)
    }
  }, [tenantId, authLoading, isAuthenticated])

  const refreshTenant = async () => {
    await loadTenantData()
  }

  return (
    <TenantContext.Provider
      value={{
        tenantId,
        tenantData,
        loading,
        refreshTenant,
      }}
    >
      {children}
    </TenantContext.Provider>
  )
}

export function useTenant() {
  return useContext(TenantContext)
}
