// 📍 src/contexts/AuthContext.jsx

import { createContext, useContext, useEffect, useState, useRef } from "react"
import { supabase } from "@/lib/supabaseClient"
import { devLog, devWarn } from "@/lib/devLog"
import { computePermessiAree, normalizeLegacyAllAccessTrue } from "@/utils/operativeAreaAccess"

const AuthContext = createContext()

const SESSION_CHECK_TIMEOUT_MS = 6000
/** getSession() può restare in attesa su rete lenta / tablet */
const GET_SESSION_TIMEOUT_MS = 10000
/** Oltre questo tempo il gate auth si chiude comunque (evita "Accesso in corso..." infinito) */
const AUTH_LOADING_FAILSAFE_MS = 20000
const LOAD_USER_DATA_TIMEOUT_MS = 12000
const LOAD_USER_DATA_RETRY_DELAY_MS = 500
const SESSION_PROPAGATION_DELAY_MS = 200

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timeout dopo ${ms}ms`)), ms)
    ),
  ])
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [tipoUtente, setTipoUtente] = useState(null) // "staff" | "cliente"
  const [ruolo, setRuolo] = useState(null)
  const [tenantId, setTenantId] = useState(null)
  const [permessiAree, setPermessiAree] = useState(null) // aree operative calcolate: ruolo + accesso_* true (null = non staff / non caricato)
  const [loading, setLoading] = useState(true)
  const retryPendingRef = useRef(false)
  const loadUserDataInProgressRef = useRef(false)
  const lastLoadedUserIdRef = useRef(null)
  const latestUserIdRef = useRef(null)
  const retryTimeoutIdRef = useRef(null)

  const setLoadingSafe = (value) => {
    if (value === false && retryPendingRef.current) return
    setLoading(value)
  }

  /** Sblocca sempre il loading (init, logout, failsafe) senza essere bloccato da retryPending */
  const forceLoadingFalse = () => {
    retryPendingRef.current = false
    setLoading(false)
  }

  // ===============================
  // LOAD USER DATA
  // ===============================

  const loadUserData = async (userId, isRetry = false) => {
    if (loadUserDataInProgressRef.current && !isRetry) return
    loadUserDataInProgressRef.current = true
    devLog("Auth", "loadUserData inizio", { userId, isRetry })
    try {
      const staffPromise = supabase
        .from("utenti_ruoli")
        .select("ruolo, tenant_id, attivo, accesso_riepilogo, accesso_cassa, accesso_cucina, accesso_bancone, accesso_delivery, accesso_pony, accesso_pizzaiolo")
        .eq("user_id", userId)
        .maybeSingle()

      const { data: staffDataRaw, error: staffErr } = await withTimeout(
        staffPromise,
        LOAD_USER_DATA_TIMEOUT_MS,
        "utenti_ruoli"
      ).catch((err) => {
        devWarn("Auth", "utenti_ruoli query TIMEOUT o errore", err?.message ?? err)
        return { data: null, error: err }
      })

      let staffData = staffDataRaw
      let staffErrResolved = staffErr
      if (staffErr && staffErr.code === "42703") {
        const fallback = await supabase.from("utenti_ruoli").select("ruolo, tenant_id, attivo").eq("user_id", userId).maybeSingle()
        if (!fallback.error && fallback.data) {
          staffData = {
            ...fallback.data,
            attivo: fallback.data.attivo !== false,
            accesso_riepilogo: null,
            accesso_cassa: null,
            accesso_cucina: null,
            accesso_bancone: null,
            accesso_delivery: null,
            accesso_pony: null,
            accesso_pizzaiolo: null,
          }
          staffErrResolved = null
        }
      } else if (staffErr) {
        staffData = null
      }

      devLog("Auth", "utenti_ruoli query done", { ok: !staffErrResolved, hasData: !!staffData, error: staffErrResolved?.message })

      if (staffErrResolved) {
        devWarn("Auth", "utenti_ruoli query error", staffErrResolved.message, staffErrResolved)
      }
      if (!staffData && !staffErrResolved) {
        devWarn("Auth", "utenti_ruoli: nessuna riga per questo user. Verifica che l'utente sia presente in public.utenti_ruoli (user_id, ruolo, tenant_id).")
      }
      if (staffData && staffData.attivo !== false) {
        lastLoadedUserIdRef.current = userId
        devLog("Auth", "utente STAFF", { ruolo: staffData.ruolo, tenant_id: staffData.tenant_id })
        setTipoUtente("staff")
        setRuolo(
          staffData.ruolo != null && String(staffData.ruolo).trim() !== ""
            ? String(staffData.ruolo).toLowerCase().trim()
            : null
        )
        setTenantId(staffData.tenant_id)
        const normalized = normalizeLegacyAllAccessTrue(staffData)
        const ruoloForPermessi =
          staffData.ruolo != null && String(staffData.ruolo).trim() !== ""
            ? String(staffData.ruolo).toLowerCase().trim()
            : null
        setPermessiAree(computePermessiAree(normalized, ruoloForPermessi))
        retryPendingRef.current = false
        setLoadingSafe(false)
        return
      }
      if (staffData && staffData.attivo === false) {
        devLog("Auth", "utente STAFF disabilitato (attivo=false), nessun accesso")
      }

      if (staffErrResolved && !isRetry && staffErrResolved?.message?.includes("timeout")) {
        loadUserDataInProgressRef.current = false
        retryPendingRef.current = true
        retryTimeoutIdRef.current = setTimeout(() => {
          const currentId = latestUserIdRef.current
          if (currentId) loadUserData(currentId, true)
          retryTimeoutIdRef.current = null
        }, LOAD_USER_DATA_RETRY_DELAY_MS)
        return
      }

      // 2️⃣ Controllo CLIENTE – con timeout
      devLog("Auth", "clienti query start")
      const clientePromise = supabase
        .from("clienti")
        .select("*")
        .eq("id", userId)
        .maybeSingle()

      const { data: clienteData, error: clienteErr } = await withTimeout(
        clientePromise,
        LOAD_USER_DATA_TIMEOUT_MS,
        "clienti"
      ).catch((err) => {
        devWarn("Auth", "clienti query TIMEOUT o errore", err?.message ?? err)
        return { data: null, error: err }
      })

      if (clienteErr) {
        devWarn("Auth", "clienti query error", clienteErr.message, clienteErr)
      }
      if (clienteData) {
        lastLoadedUserIdRef.current = userId
        devLog("Auth", "utente CLIENTE", { tenant_id: clienteData.tenant_id })
        setTipoUtente("cliente")
        setRuolo(null)
        setTenantId(clienteData.tenant_id)
        retryPendingRef.current = false
        setLoadingSafe(false)
        return
      }

      devLog("Auth", "nessun profilo in utenti_ruoli/clienti per userId", userId)
    } catch (e) {
      devWarn("Auth", "loadUserData eccezione", e?.message || e, e)
    } finally {
      loadUserDataInProgressRef.current = false
    }
    setTipoUtente(null)
    setRuolo(null)
    setTenantId(null)
    if (isRetry) {
      retryPendingRef.current = false
    }
    setLoadingSafe(false)
  }

  // ===============================
  // INIT SESSION
  // ===============================

  useEffect(() => {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? ""
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? ""
    const isSupabaseConfigured = Boolean(supabaseUrl && supabaseKey)

    devLog("Auth", "init sessione", {
      supabaseConfigurato: isSupabaseConfigured,
      urlPresente: !!supabaseUrl,
      keyPresente: !!supabaseKey,
    })

    if (!isSupabaseConfigured) {
      devWarn("Auth", "Supabase non configurato (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY), loading=false")
      forceLoadingFalse()
      return
    }

    let cancelled = false
    const timeoutId = setTimeout(() => {
      if (cancelled) return
      devLog("Auth", "timeout verifica sessione, forzo loading=false")
      forceLoadingFalse()
    }, SESSION_CHECK_TIMEOUT_MS)

    const failsafeId = setTimeout(() => {
      if (cancelled) return
      devWarn("Auth", "failsafe: loading=false dopo attesa massima (evita schermata bloccata)")
      forceLoadingFalse()
    }, AUTH_LOADING_FAILSAFE_MS)

    const init = async () => {
      try {
        devLog("Auth", "getSession() in corso...")
        const { data, error } = await withTimeout(
          supabase.auth.getSession(),
          GET_SESSION_TIMEOUT_MS,
          "getSession"
        ).catch((err) => {
          devWarn("Auth", "getSession timeout o errore", err?.message ?? err)
          return { data: { session: null }, error: err }
        })
        if (cancelled) return
        if (error) {
          devWarn("Auth", "getSession segnalazione", error?.message ?? error)
        }
        const currentUser = data?.session?.user ?? null
        devLog("Auth", "getSession risultato", {
          haSessione: !!data?.session,
          userId: currentUser?.id,
          email: currentUser?.email,
        })
        setUser(currentUser)
        latestUserIdRef.current = currentUser?.id ?? null
        if (currentUser) {
          await new Promise((r) => setTimeout(r, SESSION_PROPAGATION_DELAY_MS))
          await loadUserData(currentUser.id)
        } else {
          forceLoadingFalse()
        }
      } catch (err) {
        if (!cancelled) devWarn("Auth", "init eccezione", err?.message || err, err)
      } finally {
        if (!cancelled) {
          clearTimeout(timeoutId)
          clearTimeout(failsafeId)
          forceLoadingFalse()
          devLog("Auth", "init completato, loading=false")
        }
      }
    }

    init()

    const { data: listener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        try {
          if (cancelled) return
          devLog("Auth", "onAuthStateChange", event, { userId: session?.user?.id, email: session?.user?.email })
          const currentUser = session?.user ?? null
          setUser(currentUser)
          latestUserIdRef.current = currentUser?.id ?? null
          if (retryTimeoutIdRef.current) {
            clearTimeout(retryTimeoutIdRef.current)
            retryTimeoutIdRef.current = null
          }
          if (currentUser) {
            if (event === "INITIAL_SESSION" && lastLoadedUserIdRef.current === currentUser.id) {
              forceLoadingFalse()
              return
            }
            loadUserDataInProgressRef.current = false
            await new Promise((r) => setTimeout(r, SESSION_PROPAGATION_DELAY_MS))
            await loadUserData(currentUser.id)
          } else {
            lastLoadedUserIdRef.current = null
            setTipoUtente(null)
            setRuolo(null)
            setTenantId(null)
            setPermessiAree(null)
            forceLoadingFalse()
          }
        } catch (e) {
          devWarn("Auth", "onAuthStateChange errore (evita promise rejection non gestita)", e?.message ?? e, e)
          forceLoadingFalse()
        }
      }
    )

    return () => {
      cancelled = true
      clearTimeout(timeoutId)
      clearTimeout(failsafeId)
      if (retryTimeoutIdRef.current) {
        clearTimeout(retryTimeoutIdRef.current)
        retryTimeoutIdRef.current = null
      }
      listener?.subscription?.unsubscribe?.()
    }
  }, [])

  // ===============================
  // AUTH ACTIONS
  // ===============================

  const login = async (email, password) => {
    devLog("Auth", "login attempt", { email })
    const result = await supabase.auth.signInWithPassword({ email, password })
    if (result.error) {
      devWarn("Auth", "login error", result.error.message, result.error)
    } else {
      devLog("Auth", "login ok", { userId: result.data?.user?.id })
    }
    return result
  }

  const logout = async () => {
    devLog("Auth", "logout")
    await supabase.auth.signOut()
    setUser(null)
    setTipoUtente(null)
    setRuolo(null)
    setTenantId(null)
    setPermessiAree(null)
    forceLoadingFalse()
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        tipoUtente,
        ruolo,
        tenantId,
        permessiAree,
        loading,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}