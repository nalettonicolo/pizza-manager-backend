import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react"
import { supabase } from "@/lib/supabaseClient"
import { devWarn } from "@/lib/devLog"
import { isNestAuthEnabled } from "@/lib/nestAuthMode.js"
import { getNestJwt } from "@/app/api/client.js"
import { nestTenantPuntiVendita } from "@/app/api/tenantApi.js"
import { useAuth } from "@/app/contexts/AuthContext"
import { useTenant } from "@/app/contexts/TenantContext"
const PvContext = createContext()

export function PvProvider({ children }) {
  const { user, ruolo, loading: authLoading } = useAuth()
  const { tenantId, tenantData } = useTenant()

  const [activePv, setActivePv] = useState(null)
  const [pvList, setPvList] = useState([])
  const [loading, setLoading] = useState(true)
  const [rpcContextAvailable, setRpcContextAvailable] = useState(true)
  const pvLoadInFlightRef = useRef(false)

  const isAuthenticated = !!user

  // ======================================
  // CARICA PUNTI VENDITA
  // ======================================

  const applyPvRows = useCallback(
    (data) => {
      if (!Array.isArray(data) || data.length === 0) {
        setPvList([])
        setActivePv(null)
        return
      }

      setPvList(data)

      if (ruolo !== "superadmin") {
        const ruoloNorm = (ruolo && String(ruolo).toLowerCase().trim()) || ""
        const saved = localStorage.getItem("active_pv")
        const valid = saved && data.some((p) => String(p.id) === String(saved))

        if (ruoloNorm === "admin" && data.length > 1) {
          if (valid) {
            setActivePv(String(saved))
          } else {
            setActivePv(null)
            localStorage.removeItem("active_pv")
          }
        } else {
          const nextId = valid ? saved : data[0].id
          setActivePv(String(nextId))
          if (!valid) {
            localStorage.setItem("active_pv", String(nextId))
          }
        }
        return
      }

      const saved = localStorage.getItem("active_pv")
      if (saved && data.some((p) => String(p.id) === String(saved))) {
        setActivePv(saved)
      } else if (data.length === 1) {
        const only = data[0].id
        setActivePv(only)
        localStorage.setItem("active_pv", String(only))
      }
    },
    [ruolo]
  )

  const loadPv = useCallback(async () => {
    if (!tenantId) {
      setLoading(false)
      return
    }

    if (pvLoadInFlightRef.current) {
      return
    }
    pvLoadInFlightRef.current = true

    try {
      if (isNestAuthEnabled() && getNestJwt()) {
        try {
          const rows = await nestTenantPuntiVendita()
          if (Array.isArray(rows)) {
            applyPvRows(rows)
            return
          }
        } catch (e) {
          devWarn(
            "PvContext",
            "GET /api/tenant/punti-vendita fallito, fallback Supabase",
            e?.message ?? e
          )
        }
      }

      const { data, error } = await supabase
        .from("punti_vendita")
        .select("*")
        .eq("tenant_id", tenantId)

      if (!error && data) {
        applyPvRows(data)
      } else {
        if (error) {
          console.error("[PvContext] punti_vendita:", error.message || error)
        }
        setPvList([])
        setActivePv(null)
      }
    } finally {
      pvLoadInFlightRef.current = false
      setLoading(false)
    }
  }, [tenantId, applyPvRows])

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
    void setDbContext().catch(() => {})
  }, [tenantId, activePv, rpcContextAvailable, useSetAppContext])

  // ======================================
  // INIT
  // ======================================

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      void loadPv().catch((err) => {
        console.error("[PvContext] loadPv:", err)
      })
    }

    if (!isAuthenticated) {
      setActivePv(null)
      setPvList([])
      pvLoadInFlightRef.current = false
      setLoading(false)
    }
  }, [tenantId, tenantData, authLoading, isAuthenticated, loadPv])

  const selectPv = (pvId) => {
    if (pvId == null || pvId === "") return
    localStorage.setItem("active_pv", String(pvId))
    setActivePv(String(pvId))
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
