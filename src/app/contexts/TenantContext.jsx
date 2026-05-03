import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react"
import { supabase } from "@/lib/supabaseClient"
import { logSupabaseError } from "@/utils/logSupabaseError"
import { devWarn } from "@/lib/devLog"
import { isNestAuthEnabled } from "@/lib/nestAuthMode.js"
import { getNestJwt } from "@/app/api/client.js"
import { nestTenantMe } from "@/app/api/tenantApi.js"
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

function buildSyntheticTenantRow(tenantId, nomeHint) {
  const nome =
    nomeHint != null && String(nomeHint).trim() !== ""
      ? String(nomeHint).trim()
      : "Pizzeria"
  return {
    id: tenantId,
    nome,
    piano: "free",
    attivo: true,
    parametri_operativi: {},
    logo_url: null,
    orari_settimana: null,
    stripe_customer_id: null,
    stripe_subscription_id: null,
    created_at: null,
  }
}

export function TenantProvider({ children }) {
  const { tenantId, user, nestTenantNome, loading: authLoading } = useAuth()

  const [tenantData, setTenantData] = useState(null)
  const [loading, setLoading] = useState(true)
  const tenantDataIdRef = useRef(null)
  const loadInFlightRef = useRef(false)

  const isAuthenticated = !!user

  // ====================================
  // CARICA DATI TENANT
  // ====================================

  const nestSynthWarnedRef = useRef(false)

  const loadTenantData = useCallback(async () => {
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
      if (isNestAuthEnabled() && getNestJwt()) {
        try {
          const nestRow = await nestTenantMe()
          if (
            nestRow &&
            nestRow.id &&
            String(nestRow.id) === String(tenantId)
          ) {
            setTenantData(nestRow)
            tenantDataIdRef.current = tenantId
            return
          }
        } catch (e) {
          devWarn(
            "TenantContext",
            "GET /api/tenant/me fallito, fallback Supabase/sintetico",
            e?.message ?? e
          )
        }
      }

      // select("*") evita PGRST204 se la vista public.tenants non espone ancora tutte le colonne.
      // maybeSingle: 0 righe → data null senza PGRST116 (.single() fallirebbe se l'id non è in admin.tenants).
      const { data, error } = await supabase.from("tenants").select("*").eq("id", tenantId).maybeSingle()

      let resolved = data
      if (error) {
        if (isPgrst116ZeroRows(error)) {
          warnTenantRowMissing(tenantId)
          resolved = null
        } else {
          logSupabaseError("TenantContext.loadTenantData", error, {
            tenantId,
            operation: "from(tenants).select(*).eq(id).maybeSingle",
          })
          resolved = null
        }
      } else if (!data) {
        warnTenantRowMissing(tenantId)
        resolved = null
      }

      if (
        !resolved &&
        isNestAuthEnabled() &&
        nestTenantNome != null &&
        String(nestTenantNome).trim() !== ""
      ) {
        if (!nestSynthWarnedRef.current) {
          nestSynthWarnedRef.current = true
          devWarn(
            "TenantContext",
            "Fallback tenant da API Nest: lettura public.tenants via Supabase anon senza sessione Auth può essere vuota (RLS). Menu/PV potrebbero mancare dati finché non c’è migrazione API o sessione Supabase allineata."
          )
        }
        resolved = buildSyntheticTenantRow(tenantId, nestTenantNome)
      }

      const pendingNestNomeHint =
        resolved == null &&
        isNestAuthEnabled() &&
        (nestTenantNome == null || String(nestTenantNome).trim() === "")

      setTenantData(resolved)

      if (pendingNestNomeHint) {
        tenantDataIdRef.current = null
      } else {
        tenantDataIdRef.current = tenantId
      }
    } finally {
      setLoading(false)
      loadInFlightRef.current = false
    }
  }, [tenantId, nestTenantNome])

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
      nestSynthWarnedRef.current = false
      setTenantData(null)
      tenantDataIdRef.current = null
      loadInFlightRef.current = false
      setLoading(false)
    }
  }, [authLoading, isAuthenticated, loadTenantData])

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
