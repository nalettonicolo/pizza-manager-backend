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
import {
  getDemoClienteAuthBootstrap,
  getDemoClienteCredentials,
  isDemoClienteSessionActive,
  resolveDemoClienteTenantIdFromEnv,
} from "@/utils/demoClienteSession"

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

/** getSession() — timeout generoso: con navigator.locks (tab in background) può superare 6s */
const GET_SESSION_TIMEOUT_MS = 12000
/** Oltre questo tempo il gate auth si chiude comunque (evita "Accesso in corso..." infinito) */
const AUTH_LOADING_FAILSAFE_MS = 16000
/** Evita "Caricamento profilo..." infinito se utenti_ruoli/clienti non rispondono */
const PROFILE_READY_FAILSAFE_MS = 12000
const LOAD_USER_DATA_TIMEOUT_MS = 8000
const LOAD_USER_DATA_RETRY_DELAY_MS = 400
/** Timeout corto per path demo (lock Auth spesso blocca PostgREST finché getSession non finisce). */
const DEMO_CLIENTE_QUERY_TIMEOUT_MS = 2500
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

function readDemoClienteFlag() {
  return isDemoClienteSessionActive()
}

function resolveDemoClienteTenantId() {
  return resolveDemoClienteTenantIdFromEnv()
}

/** Account «Cliente Test»: non deve mai risolversi come staff (evita redirect in cassa). */
function isDemoClienteEmail(email) {
  const demo = getDemoClienteCredentials().email
  if (!demo || !email) return false
  return String(email).trim().toLowerCase() === String(demo).trim().toLowerCase()
}

function shouldPreferClienteProfile(userEmail) {
  return readDemoClienteFlag() || isDemoClienteEmail(userEmail)
}

export function AuthProvider({ children }) {
  const demoBoot =
    typeof window !== "undefined" ? getDemoClienteAuthBootstrap() : null

  const [user, setUser] = useState(() => demoBoot?.user ?? null)
  const [tipoUtente, setTipoUtente] = useState(() => (demoBoot?.ready ? "cliente" : null))
  const [ruolo, setRuolo] = useState(null)
  const [tenantId, setTenantId] = useState(() =>
    demoBoot?.ready ? demoBoot.tenantId : null,
  )
  const [permessiAree, setPermessiAree] = useState(null) // aree operative calcolate: ruolo + accesso_* true (null = non staff / non caricato)
  /** Nome tenant dall’API Nest (`/me`, login): usato da TenantContext se `public.tenants` non è leggibile senza sessione Supabase. */
  const [nestTenantNome, setNestTenantNome] = useState(null)
  const [loading, setLoading] = useState(() => !(demoBoot?.ready))
  /** True dopo il primo tentativo di risoluzione profilo (staff/cliente/nessuno). */
  const [profileReady, setProfileReady] = useState(() => Boolean(demoBoot?.ready))
  /** Override tenant attivo solo per Super Admin (Sala QA / supporto live). */
  const [supportTenantOverride, setSupportTenantOverride] = useState(() => {
    if (typeof window === "undefined") return null
    const id = resolveSupportTenantOverride(window.location.search)
    return id || null
  })
  const retryPendingRef = useRef(false)
  const loadUserDataInProgressRef = useRef(false)
  const lastLoadedUserIdRef = useRef(demoBoot?.user?.id ?? null)
  const latestUserIdRef = useRef(demoBoot?.user?.id ?? null)
  const latestUserEmailRef = useRef(demoBoot?.user?.email ?? null)
  const retryTimeoutIdRef = useRef(null)
  const profileReadyRef = useRef(Boolean(demoBoot?.ready))
  /** Generazione load: i timeout/retry obsoleti non devono cancellare un profilo già ok. */
  const loadUserDataGenRef = useRef(0)

  useEffect(() => {
    if (demoBoot?.ready) {
      devLog("Auth", "bootstrap demo cliente (sincrono)", {
        userId: demoBoot.user?.id,
        tenant_id: demoBoot.tenantId,
      })
    }
    // solo al mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const markProfileReady = useCallback(() => {
    profileReadyRef.current = true
    setProfileReady(true)
  }, [])

  const setLoadingSafe = useCallback((value) => {
    if (value === false && retryPendingRef.current) return
    setLoading(value)
  }, [])

  /** Sblocca sempre il loading (init, logout, failsafe) senza essere bloccato da retryPending */
  const forceLoadingFalse = useCallback(() => {
    retryPendingRef.current = false
    setLoading(false)
  }, [])

  /** Failsafe: non lasciare ProtectedRoute su "Caricamento profilo..." per sempre. */
  useEffect(() => {
    if (profileReady || !user) return undefined
    const id = window.setTimeout(() => {
      if (profileReadyRef.current) return
      devWarn("Auth", "failsafe profileReady=true (profilo non risolto in tempo)")
      markProfileReady()
      forceLoadingFalse()
    }, PROFILE_READY_FAILSAFE_MS)
    return () => window.clearTimeout(id)
  }, [profileReady, user, markProfileReady, forceLoadingFalse])

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
    markProfileReady()
  }, [markProfileReady])

  // ===============================
  // LOAD USER DATA
  // ===============================

  const loadUserData = useCallback(async (userId, isRetry = false) => {
    // Già risolto: non rifare la query (SIGNED_IN da recoverAndRefresh / focus tab).
    if (
      !isRetry &&
      lastLoadedUserIdRef.current === userId &&
      profileReadyRef.current
    ) {
      devLog("Auth", "loadUserData skip: profilo già pronto", { userId })
      forceLoadingFalse()
      return
    }
    if (loadUserDataInProgressRef.current && !isRetry) {
      // Demo: la query precedente può restare bloccata dal lock Auth — interrompi e risolvi subito.
      if (readDemoClienteFlag() && !profileReadyRef.current) {
        loadUserDataGenRef.current += 1
        loadUserDataInProgressRef.current = false
      } else {
        devLog("Auth", "loadUserData skip: già in corso", { userId })
        return
      }
    }
    const gen = ++loadUserDataGenRef.current
    loadUserDataInProgressRef.current = true
    const softRefresh =
      !isRetry &&
      lastLoadedUserIdRef.current === userId &&
      profileReadyRef.current
    // Demo: non spegnere profileReady (evita di nuovo «Verifica accesso…»).
    if (!isRetry && !softRefresh && !readDemoClienteFlag()) {
      profileReadyRef.current = false
      setProfileReady(false)
    }
    devLog("Auth", "loadUserData inizio", { userId, isRetry, softRefresh })
    const isStale = () => gen !== loadUserDataGenRef.current

    try {
      // Demo / Cliente Test: priorità cliente (mai staff → cassa).
      if (shouldPreferClienteProfile(latestUserEmailRef.current)) {
        const demoTid = resolveDemoClienteTenantId()
        lastLoadedUserIdRef.current = userId
        setTipoUtente("cliente")
        setRuolo(null)
        if (demoTid) setTenantId(demoTid)
        setPermessiAree(null)
        markProfileReady()
        retryPendingRef.current = false
        forceLoadingFalse()
        loadUserDataInProgressRef.current = false
        // Non impostare pm_demo_cliente_active qui: senza stash SA il tasto Super Admin
        // mostrerebbe un errore. Il flag lo setta solo openDemoClienteArea.
        devLog("Auth", "utente CLIENTE (demo preferito)", {
          tenant_id: demoTid,
          userId,
          email: latestUserEmailRef.current,
        })

        void withTimeout(
          supabase.from("clienti").select("tenant_id").eq("id", userId).maybeSingle(),
          DEMO_CLIENTE_QUERY_TIMEOUT_MS,
          "clienti-demo-bg",
        )
          .then(({ data }) => {
            if (isStale()) return
            if (data?.tenant_id) setTenantId(data.tenant_id)
          })
          .catch(() => {})
        return
      }

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

      if (isStale()) {
        devLog("Auth", "loadUserData stale dopo utenti_ruoli", { userId, gen })
        return
      }

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
        markProfileReady()
        retryPendingRef.current = false
        setLoadingSafe(false)
        return
      }
      if (staffData && staffData.attivo === false) {
        devLog("Auth", "utente STAFF disabilitato (attivo=false), nessun accesso")
      }

      const staffTimedOut = Boolean(staffErrResolved?.message?.includes("timeout"))
      // Se un altro path ha già risolto lo stesso user, non ritentare / non cancellare.
      if (lastLoadedUserIdRef.current === userId && profileReadyRef.current) {
        retryPendingRef.current = false
        setLoadingSafe(false)
        return
      }
      if (staffTimedOut && !isRetry) {
        loadUserDataInProgressRef.current = false
        retryPendingRef.current = true
        const retryGen = gen
        retryTimeoutIdRef.current = setTimeout(() => {
          if (retryGen !== loadUserDataGenRef.current) {
            retryPendingRef.current = false
            retryTimeoutIdRef.current = null
            return
          }
          if (lastLoadedUserIdRef.current === userId && profileReadyRef.current) {
            retryPendingRef.current = false
            forceLoadingFalse()
            retryTimeoutIdRef.current = null
            return
          }
          const currentId = latestUserIdRef.current
          if (currentId) void loadUserData(currentId, true)
          else {
            retryPendingRef.current = false
            markProfileReady()
            forceLoadingFalse()
          }
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

      if (isStale()) {
        devLog("Auth", "loadUserData stale dopo clienti", { userId, gen })
        return
      }

      if (clienteErr) {
        devWarn("Auth", "clienti query error", clienteErr.message, clienteErr)
      }
      if (clienteData) {
        lastLoadedUserIdRef.current = userId
        devLog("Auth", "utente CLIENTE", { tenant_id: clienteData.tenant_id })
        setTipoUtente("cliente")
        setRuolo(null)
        setTenantId(clienteData.tenant_id)
        markProfileReady()
        retryPendingRef.current = false
        setLoadingSafe(false)
        return
      }

      devLog("Auth", "nessun profilo in utenti_ruoli/clienti per userId", userId)
    } catch (e) {
      if (!isStale()) devWarn("Auth", "loadUserData eccezione", e?.message || e, e)
    } finally {
      if (!isStale()) loadUserDataInProgressRef.current = false
    }
    if (isStale()) return
    // Non cancellare un profilo già ok (timeout in ritardo dopo successo parallelo).
    if (lastLoadedUserIdRef.current === userId && profileReadyRef.current) {
      retryPendingRef.current = false
      setLoadingSafe(false)
      return
    }
    setTipoUtente(null)
    setRuolo(null)
    setTenantId(null)
    markProfileReady()
    if (isRetry) {
      retryPendingRef.current = false
    }
    setLoadingSafe(false)
  }, [setLoadingSafe, markProfileReady, forceLoadingFalse])

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
            markProfileReady()
            latestUserIdRef.current = null
            lastLoadedUserIdRef.current = null
          }
        } finally {
          if (!cancelled) {
            clearTimeout(failsafeId)
            markProfileReady()
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
      let deferForAuthListener = false
      try {
        devLog("Auth", "getSession() in corso...")
        const sessionResult = await withTimeout(
          supabase.auth.getSession(),
          GET_SESSION_TIMEOUT_MS,
          "getSession"
        ).catch((err) => {
          devWarn("Auth", "getSession timeout o errore", err?.message ?? err)
          return { data: { session: null }, error: err, timedOut: true }
        })
        if (cancelled) return
        const error = sessionResult.error
        const timedOut = Boolean(
          sessionResult.timedOut || String(error?.message || "").includes("timeout"),
        )
        if (error) {
          devWarn("Auth", "getSession segnalazione", error?.message ?? error)
        }
        const currentUser = sessionResult.data?.session?.user ?? null
        devLog("Auth", "getSession risultato", {
          haSessione: !!sessionResult.data?.session,
          userId: currentUser?.id,
          email: currentUser?.email,
          timedOut,
        })

        // Timeout tipico con navigator.locks (tab in background / Strict Mode):
        // non forzare "non autenticato" — onAuthStateChange (INITIAL_SESSION/SIGNED_IN) è la fonte di verità.
        if (timedOut && !currentUser) {
          if (latestUserIdRef.current) {
            devLog("Auth", "getSession timeout ma user già da onAuthStateChange", {
              userId: latestUserIdRef.current,
            })
            if (!profileReadyRef.current) {
              await loadUserData(latestUserIdRef.current)
            }
          } else {
            deferForAuthListener = true
            devWarn("Auth", "getSession timeout: attendo onAuthStateChange (no logout forzato)")
          }
          return
        }

        // Non sovrascrivere con null se il listener ha già impostato l'utente.
        if (!currentUser && latestUserIdRef.current) {
          devLog("Auth", "getSession senza sessione ma user già presente da listener — skip clear")
          return
        }

        setUser(currentUser)
        latestUserIdRef.current = currentUser?.id ?? null
        latestUserEmailRef.current = currentUser?.email ?? null
        if (currentUser) {
          if (SESSION_PROPAGATION_DELAY_MS > 0) {
            await new Promise((r) => setTimeout(r, SESSION_PROPAGATION_DELAY_MS))
          }
          await loadUserData(currentUser.id)
        } else {
          markProfileReady()
          forceLoadingFalse()
        }
      } catch (err) {
        if (!cancelled) devWarn("Auth", "init eccezione", err?.message || err, err)
      } finally {
        if (!cancelled && !deferForAuthListener) {
          clearTimeout(failsafeId)
          forceLoadingFalse()
          devLog("Auth", "init completato, loading=false")
        } else if (!cancelled && deferForAuthListener) {
          devLog("Auth", "init in attesa listener (loading resta fino a failsafe / INITIAL_SESSION)")
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
          latestUserEmailRef.current = currentUser?.email ?? null
          if (retryTimeoutIdRef.current) {
            clearTimeout(retryTimeoutIdRef.current)
            retryTimeoutIdRef.current = null
          }
          if (currentUser) {
            // Stesso utente già in sessione: non rilanciare il profilo (TOKEN_REFRESHED al focus tab,
            // INITIAL_SESSION, USER_UPDATED…). Evita schermata bianca / attesa ~8s.
            if (
              lastLoadedUserIdRef.current === currentUser.id &&
              profileReadyRef.current &&
              event !== "SIGNED_OUT"
            ) {
              forceLoadingFalse()
              return
            }
            // Query profilo bloccata dal lock Auth: in demo sblocca subito senza attendere.
            if (loadUserDataInProgressRef.current && latestUserIdRef.current === currentUser.id) {
              if (readDemoClienteFlag() && !profileReadyRef.current) {
                loadUserDataGenRef.current += 1
                loadUserDataInProgressRef.current = false
                await loadUserData(currentUser.id)
              } else {
                forceLoadingFalse()
              }
              return
            }
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
            markProfileReady()
            forceLoadingFalse()
          }
        } catch (e) {
          devWarn("Auth", "onAuthStateChange errore (evita promise rejection non gestita)", e?.message ?? e, e)
          markProfileReady()
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
  }, [applyNestProfile, forceLoadingFalse, loadUserData, markProfileReady])

  // ===============================
  // AUTH ACTIONS
  // ===============================

  const login = async (email, password) => {
    devLog("Auth", "login attempt", { email })
    if (isDemoClienteEmail(email)) {
      latestUserEmailRef.current = String(email).trim()
    }
    if (isNestAuthEnabled()) {
      const result = await nestAuthLogin(email, password)
      if (result.error) {
        devWarn("Auth", "login Nest error", result.error.message, result.error)
      } else if (result.data?.user) {
        const u = result.data.user
        setUser({ id: u.id, email: u.email })
        latestUserIdRef.current = u.id
        latestUserEmailRef.current = u.email ?? null
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
    profileReadyRef.current = true
    setProfileReady(true)
    lastLoadedUserIdRef.current = null
    latestUserIdRef.current = null
    latestUserEmailRef.current = null
    try {
      sessionStorage.removeItem("pm_demo_cliente_active")
      sessionStorage.removeItem("pm_sa_session_before_demo_cliente")
      sessionStorage.removeItem("pm_sa_demo_giro")
    } catch {
      /* ignore */
    }
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