import { createContext, useContext, useEffect, useRef, useState } from "react"
import { supabase } from "@/lib/supabaseClient"
import { logSupabaseError } from "@/utils/logSupabaseError"
import { useAuth } from "./AuthContext"

const TenantContext = createContext()

/** PostgREST .single() con 0 righe → PGRST116 (con maybeSingle() non dovrebbe comparire). */
function isPgrst116ZeroRows(err) {
  return (
    err?.code === "PGRST116" &&
    /0 rows/i.test(String(err.details ?? err.message ?? ""))
  )
}

function warnTenantRowMissing(tenantId) {
  console.warn(
    "[TenantContext] Nessuna riga in public.tenants per questo tenantId. Inserisci la stessa UUID in admin.tenants (allineata a utenti_ruoli.tenant_id).",
    tenantId
  )
}

export function TenantProvider({ children }) {
  const { tenantId, user, loading: authLoading } = useAuth()

  const [tenantData, setTenantData] = useState(null)
  const [loading, setLoading] = useState(true)
  const tenantDataIdRef = useRef(null)
  const loadInFlightRef = useRef(false)

  const isAuthenticated = !!user

  // ====================================
  // CARICA DATI TENANT
  // ====================================

  const loadTenantData = async () => {
    if (!tenantId) {
      setTenantData(null)
      tenantDataIdRef.current = null
      setLoading(false)
      return
    }

    if (tenantDataIdRef.current === tenantId) {
      setLoading(false)
      return
    }
    if (loadInFlightRef.current) {
      return
    }
    loadInFlightRef.current = true
    setLoading(true)

    try {
      // select("*") evita PGRST204 se la vista public.tenants non espone ancora tutte le colonne.
      // maybeSingle: 0 righe → data null senza PGRST116 (.single() fallirebbe se l'id non è in admin.tenants).
      const { data, error } = await supabase.from("tenants").select("*").eq("id", tenantId).maybeSingle()

      if (error) {
        if (isPgrst116ZeroRows(error)) {
          warnTenantRowMissing(tenantId)
          setTenantData(null)
        } else {
          logSupabaseError("TenantContext.loadTenantData", error, {
            tenantId,
            operation: "from(tenants).select(*).eq(id).maybeSingle",
          })
          setTenantData(null)
        }
      } else if (!data) {
        warnTenantRowMissing(tenantId)
        setTenantData(null)
      } else {
        setTenantData(data)
      }

      tenantDataIdRef.current = tenantId
    } finally {
      setLoading(false)
      loadInFlightRef.current = false
    }
  }

  // ====================================
  // REAGISCE A CAMBIO AUTH
  // ====================================

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      void loadTenantData().catch((err) => {
        console.error("[TenantContext] loadTenantData:", err)
      })
    }

    if (!isAuthenticated) {
      setTenantData(null)
      tenantDataIdRef.current = null
      loadInFlightRef.current = false
      setLoading(false)
    }
  }, [tenantId, authLoading, isAuthenticated])

  const refreshTenant = async () => {
    tenantDataIdRef.current = null
    loadInFlightRef.current = false
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
