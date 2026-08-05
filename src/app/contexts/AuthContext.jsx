// 📍 src/contexts/AuthContext.jsx

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react"
import { supabase } from "@/lib/supabaseClient"
import { devLog, devWarn } from "@/lib/devLog"
import {
  computePermessiAree,
  normalizeLegacyAllAccessTrue,
  normalizeRuoloOperativo,
} from "@/utils/operativeAreaAccess"
import { PERMESSI_TUTTE_AREE } from "@/constants/testReparti"
import { getNestJwt, clearNestJwt } from "@/app/api/client.js"
import { nestAuthLogin, nestAuthMe, nestAuthLogout } from "@/app/api/authApi.js"
import { isNestAuthEnabled } from "@/lib/nestAuthMode.js"
import {
  isAuthFetchNetworkFailure,
  isSupabaseBuildConfigured,
  supabaseLoginNetworkHelpMessage,
} from "@/lib/supabaseEnv.js"
import { resolveSupportTenantOverride } from "@/utils/supportTenantOverride"

const AuthContext = createContext()

/** Enum Prisma `core.Ruolo` → stringhe ruolo usate in UI / router. */
function mapCoreRuoloToApp(ruolo) {
  const u = String(ruolo ?? "").toUpperCase()
  if (u === "SUPERADMIN") return "superadmin"
  if (u === "OWNER") return "owner"
  if (u === "ADMIN") return "admin"
  if (u === "OPERATORE") return "operatore"
  return normalizeRuoloOperativo(ruolo)
}

/** getSession() — timeout più stretto per UI più reattiva (rete lenta può comunque fallire e ripetere login) */
const GET_SESSION_TIMEOUT_MS = 6000
/** Oltre questo tempo il gate auth si chiude comunque (evita "Accesso in corso..." infinito) */
const AUTH_LOADING_FAILSAFE_MS = 14000
const LOAD_USER_DATA_TIMEOUT_MS = 8000
const LOAD_USER_DATA_RETRY_DELAY_MS = 150
/** Micro-ritardo dopo sessione: 0 = nessuna attesa artificiale tra getSession e load profilo */
const SESSION_PROPAGATION_DELAY_MS = 0

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
  /** Nome tenant dall’API Nest (`/me`, login): usato da TenantContext se `public.tenants` non è leggibile senza sessione Supabase. */
  const [nestTenantNome, setNestTenantNome] = useState(null)
  const [loading, setLoading] = useState(true)
  /** True dopo il primo tentativo di risoluzione profilo (staff/cliente/nessuno). */
  const [profileReady, setProfileReady] = useState(false)
  /** Override tenant attivo solo per Super Admin (Sala QA / supporto live). */
  const [supportTenantOverride, setSupportTenantOverride] = useState(() => {
    if (typeof window === "undefined") return null
    const id = resolveSupportTenantOverride(window.location.search)
    return id || null
  })
  const retryPendingRef = useRef(false)
  const loadUserDataInProgressRef = useRef(false)
  const lastLoadedUserIdRef = useRef(null)
  const latestUserIdRef = useRef(null)
  const retryTimeoutIdRef = useRef(null)

  const setLoadingSafe = useCallback((value) => {
    if (value === false && retryPendingRef.current) return
    setLoading(value)
  }, [])

  /** Sblocca sempre il loading (init, logout, failsafe) senza essere bloccato da retryPending */
  const forceLoadingFalse = useCallback(() => {
    retryPendingRef.current = false
    setLoading(false)
  }, [])

  useEffect(() => {
    const sync = () => {
      const id = resolveSupportTenantOverride(window.location.search)
      setSupportTenantOverride(id || null)
    }
    window.addEventListener("storage", sync)
    window.addEventListener("pm-support-tenant", sync)
    window.addEventListener("popstate", sync)
    const t = window.setInterval(sync, 2000)
    return () => {
      window.removeEventListener("storage", sync)
      window.removeEventListener("pm-support-tenant", sync)
      window.removeEventListener("popstate", sync)
      window.clearInterval(t)
    }
  }, [])

  const applyNestProfile = useCallback((profile) => {
    if (!profile?.id) return
    const ruoloNorm = mapCoreRuoloToApp(profile.ruolo)
    const staffData = {
      tenant_id: profile.tenantId,
      attivo: true,
      accesso_riepilogo: null,
      accesso_cassa: null,
      accesso_cucina: null,
      accesso_bancone: null,
      accesso_delivery: null,
      accesso_pony: null,
      accesso_pizzaiolo: null,
    }
    lastLoadedUserIdRef.current = profile.id
    setTipoUtente("staff")
    setRuolo(ruoloNorm)
    setTenantId(profile.tenantId ?? null)
    const mgmt =
      ruoloNorm === "admin" ||
      ruoloNorm === "owner" ||
      ruoloNorm === "superadmin"
    if (mgmt) {
      setPermessiAree(PERMESSI_TUTTE_AREE)
    } else {
      const normalized = normalizeLegacyAllAccessTrue(staffData)
      setPermessiAree(computePermessiAree(normalized, ruoloNorm))
    }
    setNestTenantNome(profile.tenantNome != null ? String(profile.tenantNome) : null)
    setProfileReady(true)
  }, [])

  // ===============================
  // LOAD USER DATA
  // ===============================

  const loadUserData = useCallback(async (userId, isRetry = false) => {
    if (loadUserDataInProgressRef.current && !isRetry) return
    loadUserDataInProgressRef.current = true
    if (!isRetry) setProfileReady(false)
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
        const ruoloNorm =
          staffData.ruolo != null && String(staffData.ruolo).trim() !== ""
            ? normalizeRuoloOperativo(String(staffData.ruolo).trim())
            : null
        setRuolo(ruoloNorm)
        setTenantId(staffData.tenant_id)
        const mgmt =
          ruoloNorm === "admin" ||
          ruoloNorm === "owner" ||
          ruoloNorm === "superadmin"
        if (mgmt) {
          setPermessiAree(PERMESSI_TUTTE_AREE)
        } else {
          const normalized = normalizeLegacyAllAccessTrue(staffData)
          setPermessiAree(computePermessiAree(normalized, ruoloNorm))
        }
        setProfileReady(true)
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
        setProfileReady(true)
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
    setProfileReady(true)
    if (isRetry) {
      retryPendingRef.current = false
    }
    setLoadingSafe(false)
  }, [setLoadingSafe])

  // ===============================
  // INIT SESSION
  // ===============================

  useEffect(() => {
    if (isNestAuthEnabled()) {
      devLog("Auth", "init sessione Nest (JWT)", {
        apiUrl: !!String(import.meta.env.VITE_API_URL ?? "").trim(),
      })

      let cancelled = false
      const failsafeId = setTimeout(() => {
        if (cancelled) return
        devWarn("Auth", "failsafe Nest: loading=false")
        forceLoadingFalse()
      }, AUTH_LOADING_FAILSAFE_MS)

      const initNest = async () => {
        try {
          const token = getNestJwt()
          if (!token) return
          const me = await nestAuthMe()
          if (cancelled) return
          setUser({ id: me.id, email: me.email })
          latestUserIdRef.current = me.id
          applyNestProfile(me)
        } catch (e) {
          if (!cancelled) {
            devWarn("Auth", "Nest init fallito", e?.message ?? e)
            clearNestJwt()
            setUser(null)
            setTipoUtente(null)
            setRuolo(null)
            setTenantId(null)
            setPermessiAree(null)
            setNestTenantNome(null)
            setProfileReady(true)
            latestUserIdRef.current = null
            lastLoadedUserIdRef.current = null
          }
        } finally {
          if (!cancelled) {
            clearTimeout(failsafeId)
            setProfileReady(true)
            forceLoadingFalse()
            devLog("Auth", "init Nest completato")
          }
        }
      }

      void initNest()
      return () => {
        cancelled = true
        clearTimeout(failsafeId)
      }
    }

    const supabaseConfigured = isSupabaseBuildConfigured()

    devLog("Auth", "init sessione", {
      supabaseConfigurato: supabaseConfigured,
      urlPresente: Boolean(import.meta.env.VITE_SUPABASE_URL),
      keyPresente: Boolean(import.meta.env.VITE_SUPABASE_ANON_KEY),
    })

    if (!supabaseConfigured) {
      devWarn("Auth", "Supabase non configurato (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY), loading=false")
      forceLoadingFalse()
      return
    }

    let cancelled = false
    /** Non usare un timeout breve che imposta loading=false mentre getSession() è ancora in corso:
     * su nuova scheda la sessione da localStorage può arrivare dopo >3s e ProtectedRoute mandava a /login a utenti già autenticati. */
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
          if (SESSION_PROPAGATION_DELAY_MS > 0) {
            await new Promise((r) => setTimeout(r, SESSION_PROPAGATION_DELAY_MS))
          }
          await loadUserData(currentUser.id)
        } else {
          setProfileReady(true)
          forceLoadingFalse()
        }
      } catch (err) {
        if (!cancelled) devWarn("Auth", "init eccezione", err?.message || err, err)
      } finally {
        if (!cancelled) {
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
            if (SESSION_PROPAGATION_DELAY_MS > 0) {
              await new Promise((r) => setTimeout(r, SESSION_PROPAGATION_DELAY_MS))
            }
            await loadUserData(currentUser.id)
          } else {
            lastLoadedUserIdRef.current = null
            setTipoUtente(null)
            setRuolo(null)
            setTenantId(null)
            setPermessiAree(null)
            setNestTenantNome(null)
            setProfileReady(true)
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
      clearTimeout(failsafeId)
      if (retryTimeoutIdRef.current) {
        clearTimeout(retryTimeoutIdRef.current)
        retryTimeoutIdRef.current = null
      }
      listener?.subscription?.unsubscribe?.()
    }
  }, [applyNestProfile, forceLoadingFalse, loadUserData])

  // ===============================
  // AUTH ACTIONS
  // ===============================

  const login = async (email, password) => {
    devLog("Auth", "login attempt", { email })
    if (isNestAuthEnabled()) {
      const result = await nestAuthLogin(email, password)
      if (result.error) {
        devWarn("Auth", "login Nest error", result.error.message, result.error)
      } else if (result.data?.user) {
        const u = result.data.user
        setUser({ id: u.id, email: u.email })
        latestUserIdRef.current = u.id
        applyNestProfile(u)
        devLog("Auth", "login Nest ok", { userId: u.id })
      }
      forceLoadingFalse()
      return result
    }
    if (!isSupabaseBuildConfigured()) {
      devWarn("Auth", "login: Supabase non configurato nel bundle (VITE_SUPABASE_*).")
      return {
        data: { user: null, session: null },
        error: { message: supabaseLoginNetworkHelpMessage() },
      }
    }

    try {
      const result = await supabase.auth.signInWithPassword({ email, password })

      const errMsg = String(result.error?.message ?? "")
      if (
        result.error &&
        (isAuthFetchNetworkFailure(result.error) || /failed to fetch/i.test(errMsg))
      ) {
        devWarn("Auth", "login Supabase errore di rete", errMsg || result.error, result.error)
        return {
          data: { user: null, session: null },
          error: { message: supabaseLoginNetworkHelpMessage() },
        }
      }

      if (result.error) {
        devWarn("Auth", "login error", result.error.message, result.error)
      } else {
        devLog("Auth", "login ok", { userId: result.data?.user?.id })
      }
      return result
    } catch (e) {
      if (isAuthFetchNetworkFailure(e)) {
        devWarn("Auth", "login Supabase eccezione rete", e?.message ?? e, e)
        return {
          data: { user: null, session: null },
          error: { message: supabaseLoginNetworkHelpMessage() },
        }
      }
      throw e
    }
  }

  const logout = async () => {
    devLog("Auth", "logout")
    if (isNestAuthEnabled()) {
      await nestAuthLogout()
    } else {
      try {
        /* scope local = pulisce storage su questo browser (sessione persistente) */
        await supabase.auth.signOut({ scope: "local" })
      } catch (e) {
        devWarn("Auth", "signOut errore (prosegui pulizia stato locale)", e?.message ?? e, e)
      }
    }
    setUser(null)
    setTipoUtente(null)
    setRuolo(null)
    setTenantId(null)
    setPermessiAree(null)
    setNestTenantNome(null)
    setProfileReady(true)
    lastLoadedUserIdRef.current = null
    latestUserIdRef.current = null
    forceLoadingFalse()
  }

  /** Dopo link reset password (flusso recovery Supabase). Con login Nest non disponibile finché non c’è endpoint dedicato. */
  const updatePassword = async (newPassword) => {
    if (isNestAuthEnabled()) {
      return {
        data: null,
        error: {
          message:
            "Reimposta password da questo schermo non è disponibile con login Nest. Usa il flusso dedicato sul backend quando sarà attivo.",
        },
      }
    }
    return supabase.auth.updateUser({ password: newPassword })
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        tipoUtente,
        ruolo,
        /** Tenant effettivo: per Super Admin può essere override Sala QA. */
        tenantId:
          ruolo === "superadmin" && supportTenantOverride
            ? supportTenantOverride
            : tenantId,
        /** Tenant dal profilo auth (senza override supporto). */
        authTenantId: tenantId,
        supportTenantOverride,
        isSupportTenantMode: Boolean(ruolo === "superadmin" && supportTenantOverride),
        permessiAree,
        nestTenantNome,
        loading,
        profileReady,
        login,
        logout,
        updatePassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}