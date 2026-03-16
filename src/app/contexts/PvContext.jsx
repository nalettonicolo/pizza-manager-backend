import { createContext, useContext, useEffect, useState } from "react"
import { supabase } from "@/lib/supabaseClient"
import { useAuth } from "@/app/contexts/AuthContext"
import { useTenant } from "@/app/contexts/TenantContext"

const PvContext = createContext()

export function PvProvider({ children }) {
  const { user, ruolo, loading: authLoading } = useAuth()
  const { tenantId } = useTenant()

  const [activePv, setActivePv] = useState(null)
  const [pvList, setPvList] = useState([])
  const [loading, setLoading] = useState(true)
  const [rpcContextAvailable, setRpcContextAvailable] = useState(true)

  const isAuthenticated = !!user

  // ======================================
  // CARICA PUNTI VENDITA
  // ======================================

  const loadPv = async () => {
    if (!tenantId) {
      setLoading(false)
      return
    }

    const { data, error } = await supabase
      .from("punti_vendita")
      .select("*")
      .eq("tenant_id", tenantId)

    if (!error && data) {
      setPvList(data)

      if (ruolo !== "superadmin") {
        // prende il primo disponibile
        if (data.length > 0) {
          setActivePv(data[0].id)
        }
      } else {
        const saved = localStorage.getItem("active_pv")
        if (saved) setActivePv(saved)
      }
    }

    setLoading(false)
  }

  // ======================================
  // SET DB CONTEXT (RLS)
  // RPC set_app_context deve esistere in Supabase; se non c'è, non chiamare (evita 404).
  // Per riattivare: creare la funzione in Supabase e impostare useSetAppContext = true.
  // ======================================
  const useSetAppContext = false

  useEffect(() => {
    if (!useSetAppContext || !tenantId || !activePv || !rpcContextAvailable) return
    const setDbContext = async () => {
      const { error } = await supabase.rpc("set_app_context", {
        tenant: tenantId,
        punto_vendita: activePv,
      })
      if (error) {
        setRpcContextAvailable(false)
      }
    }
    setDbContext()
  }, [tenantId, activePv, rpcContextAvailable])

  // ======================================
  // INIT
  // ======================================

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      loadPv()
    }

    if (!isAuthenticated) {
      setActivePv(null)
      setPvList([])
      setLoading(false)
    }
  }, [tenantId, authLoading, isAuthenticated])

  const selectPv = (pvId) => {
    if (ruolo !== "superadmin") return

    localStorage.setItem("active_pv", pvId)
    setActivePv(pvId)
  }

  return (
    <PvContext.Provider
      value={{
        activePv,
        pvList,
        selectPv,
        loading,
      }}
    >
      {children}
    </PvContext.Provider>
  )
}

export function usePv() {
  return useContext(PvContext)
}
