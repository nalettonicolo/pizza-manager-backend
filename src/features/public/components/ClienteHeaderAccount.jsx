import { useEffect, useRef, useState } from "react"
import { Link, useLocation } from "react-router-dom"
import { useAuth } from "@/app/contexts/AuthContext"
import { listClienteOrdini } from "@/features/public/services/clienteAuthService"
import ClienteOrdineRecallModal from "@/features/public/components/ClienteOrdineRecallModal"
import {
  resolveClienteOrdiniPath,
  resolveClienteProfiloPath,
  resolveClienteVetrinaPath,
} from "@/utils/clienteVetrinaPath"
import {
  hasDemoSaStash,
  isDemoClienteSessionActive,
  restoreDemoSaSession,
  finalizeDemoSaRestore,
  clearDemoClienteSessionFlags,
  getDemoClienteCredentials,
  readCachedSupabaseUser,
  DEMO_CLIENTE_FLAG_KEY,
  DEMO_CLIENTE_QUERY,
} from "@/utils/demoClienteSession"
import { setDemoGiroSessionActive, withDemoGiroQuery } from "@/utils/demoGiro"
import { SUPPORT_TENANT_QUERY, resolveSupportTenantOverride } from "@/utils/supportTenantOverride"
import {
  clienteStatoOrdineLabel,
  clienteTipoOrdineLabel,
} from "@/utils/clienteOrdineStato"
import { formatPrice } from "@/utils/format"
import { PmMark } from "@/components/SaHomeButton"

function formatOrdineQuando(iso) {
  if (!iso) return "—"
  try {
    return new Date(iso).toLocaleString("it-IT", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    })
  } catch {
    return String(iso)
  }
}

function displayClienteNome(user) {
  const meta = user?.user_metadata && typeof user.user_metadata === "object" ? user.user_metadata : {}
  const nome = String(meta.nome || "").trim()
  if (nome) return nome
  const email = String(user?.email || "").trim()
  if (email.includes("@")) return email.split("@")[0]
  return "Il tuo account"
}

/**
 * Header vetrina: nome → profilo; tasto ultimi 3 ordini + modale ripeti.
 */
export default function ClienteHeaderAccount() {
  const { user, logout } = useAuth()
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [restoringSa, setRestoringSa] = useState(false)
  const [recallOrdineId, setRecallOrdineId] = useState(null)
  const rootRef = useRef(null)
  const isDemoCliente = isDemoClienteSessionActive()
  const canReturnToSa = isDemoCliente && hasDemoSaStash()
  const demoClienteQuery =
    new URLSearchParams(location.search || "").get(DEMO_CLIENTE_QUERY) === "1"
  const nome = displayClienteNome(user)
  const profiloTo = resolveClienteProfiloPath(location.search, { edit: true })
  const ordiniTo = resolveClienteOrdiniPath(location.search)

  // Login esterno Cliente Test: togli flag demo residuo (senza stash SA).
  useEffect(() => {
    if (canReturnToSa || demoClienteQuery) return
    if (!isDemoCliente) return
    try {
      sessionStorage.removeItem(DEMO_CLIENTE_FLAG_KEY)
    } catch {
      /* ignore */
    }
    setDemoGiroSessionActive(false)
  }, [isDemoCliente, canReturnToSa, demoClienteQuery])

  useEffect(() => {
    if (!open) return undefined
    const onDoc = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false)
    }
    const onKey = (e) => {
      if (e.key === "Escape" && !recallOrdineId) setOpen(false)
    }
    document.addEventListener("mousedown", onDoc)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onDoc)
      document.removeEventListener("keydown", onKey)
    }
  }, [open, recallOrdineId])

  useEffect(() => {
    if (!open || loaded || !user?.id) return undefined
    let c = false
    setLoading(true)
    listClienteOrdini({ limit: 3, offset: 0 }).then(({ data }) => {
      if (c) return
      setOrders(Array.isArray(data) ? data.slice(0, 3) : [])
      setLoaded(true)
      setLoading(false)
    })
    return () => {
      c = true
    }
  }, [open, loaded, user?.id])

  async function backToSa() {
    setRestoringSa(true)
    try {
      if (!hasDemoSaStash()) {
        window.alert(
          "Sessione Super Admin non trovata. Esci, accedi di nuovo come Super Admin e apri Area cliente dalla demo.",
        )
        return
      }
      const r = await restoreDemoSaSession()
      if (!r.ok) {
        window.alert(r.error)
        return
      }
      // Verifica che la sessione SA sia effettivamente attiva prima di navigare (evita redirect a
      // /login con sessione ancora "cliente"). Lettura sincrona da localStorage invece di
      // supabase.auth.getSession(): con più tab/sessioni aperte in contemporanea (tipico qui,
      // demo Super Admin + Cliente Test) getSession() può restare bloccato per secondi sul lock
      // interno di supabase-js (navigator.locks) — stesso motivo per cui demoClienteSession.js usa
      // già questa lettura diretta altrove. supabase.auth.setSession() (appena chiamato dentro
      // restoreDemoSaSession) scrive su storage prima di risolvere, quindi il valore è già fresco.
      const cachedUser = readCachedSupabaseUser()
      const demoEmail = String(getDemoClienteCredentials().email || "").toLowerCase()
      if (!cachedUser?.id) {
        window.alert("Ripristino Super Admin incompleto (nessuna sessione). Riprova.")
        return
      }
      if (cachedUser.email && demoEmail && String(cachedUser.email).toLowerCase() === demoEmail) {
        window.alert("Sessione ancora su Cliente Test. Riprova «Super Admin» tra un attimo.")
        return
      }
      setDemoGiroSessionActive(true)
      let tenantId = null
      try {
        const qs = new URLSearchParams(location.search.startsWith("?") ? location.search.slice(1) : location.search)
        tenantId = qs.get(SUPPORT_TENANT_QUERY) || qs.get("tenant") || null
      } catch {
        /* ignore */
      }
      if (!tenantId) tenantId = resolveSupportTenantOverride() || null
      if (!tenantId) {
        tenantId = String(import.meta.env.VITE_PUBLIC_DEMO_TENANT_ID || "").trim() || null
      }
      try {
        sessionStorage.removeItem(DEMO_CLIENTE_FLAG_KEY)
      } catch {
        /* ignore */
      }
      let dest = withDemoGiroQuery("/operative/dashboard", tenantId)
      // _qa_console=1 è pensato per il giro DEMO da dentro Sala QA (stesso ruolo per tutta la
      // sessione): qui invece la sessione cambia identità (da Cliente Test a Super Admin), e quel
      // flag può far rimandare a Sala QA invece che all'hub Demo live. Non serve per l'hub: basta
      // _demo_giro=1 (già presente) a farlo riconoscere come "Demo live".
      try {
        const u = new URL(dest, window.location.origin)
        u.searchParams.delete("_qa_console")
        dest = `${u.pathname}${u.search}`
      } catch {
        /* mantieni dest così com'è se l'URL non è valido */
      }
      finalizeDemoSaRestore()
      // Reload completo (non navigate()): la sessione è appena cambiata (Cliente Test → Super
      // Admin) con supabase.auth.setSession(); un reload rilegge subito la sessione nuova da
      // storage, mentre una navigazione client-side rischia di far leggere ad AuthContext ancora
      // il ruolo "cliente" per un istante (onAuthStateChange è asincrono) — e le guardie di
      // /operative/dashboard rimandano indietro in Area cliente prima che il ruolo si aggiorni.
      window.location.replace(dest)
    } finally {
      setRestoringSa(false)
    }
  }

  async function exitBrokenDemoCliente() {
    clearDemoClienteSessionFlags()
    try {
      await logout()
    } catch {
      /* ignore */
    }
    window.location.assign("/login")
  }

  const menuTo = resolveClienteVetrinaPath(location.search)

  return (
    <div className="cliente-header-account" ref={rootRef}>
      {canReturnToSa ? (
        <button
          type="button"
          className="sa-home-btn sa-home-btn--compact cliente-header-account__sa"
          disabled={restoringSa}
          onClick={() => void backToSa()}
          title="Torna all’hub DEMO (aree di lavoro)"
        >
          <PmMark size={16} />
          <span className="sa-home-btn-label">{restoringSa ? "Uscita…" : "DEMO"}</span>
        </button>
      ) : isDemoCliente && demoClienteQuery ? (
        <button
          type="button"
          className="public-layout-btn public-layout-btn--outline cliente-header-account__sa"
          onClick={() => void exitBrokenDemoCliente()}
          title="Manca la sessione Super Admin salvata: esci e rientra dalla demo"
        >
          Esci (riapri demo)
        </button>
      ) : null}
      <Link
        to={menuTo}
        className="public-layout-btn public-layout-btn--outline cliente-header-account__orders-btn"
        title="Torna al menù"
      >
        Menù
      </Link>
      <Link
        to={profiloTo}
        className="cliente-header-account__name"
        title="Modifica i tuoi dati"
        aria-label={`Modifica i dati di ${nome}`}
      >
        {nome}
      </Link>
      <div className="cliente-header-account__orders-wrap">
        <button
          type="button"
          className="public-layout-btn public-layout-btn--outline cliente-header-account__orders-btn"
          aria-expanded={open}
          aria-haspopup="dialog"
          onClick={() => setOpen((v) => !v)}
        >
          Ultimi ordini
        </button>
        {open ? (
          <div className="cliente-header-account__panel" role="dialog" aria-label="Ultimi ordini">
            <p className="cliente-header-account__panel-title">Ultimi 3 ordini</p>
            {loading ? (
              <p className="cliente-header-account__empty">Caricamento…</p>
            ) : orders.length === 0 ? (
              <p className="cliente-header-account__empty">
                Nessun ordine ancora. Ordina dal menù e lo troverai qui.
              </p>
            ) : (
              <ul className="cliente-header-account__list">
                {orders.map((o) => {
                  const id = o.id
                  return (
                    <li key={id}>
                      <button
                        type="button"
                        className="cliente-header-account__item"
                        onClick={() => {
                          setOpen(false)
                          setRecallOrdineId(id)
                        }}
                      >
                        <span className="cliente-header-account__item-top">
                          <strong>#{o.numero ?? "—"}</strong>
                          <span>{formatPrice(Number(o.totale ?? 0))}</span>
                        </span>
                        <span className="cliente-header-account__item-meta">
                          {formatOrdineQuando(o.created_at)} · {clienteTipoOrdineLabel(o.tipo_ordine)} ·{" "}
                          {clienteStatoOrdineLabel(o.stato)}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
            <Link
              to={ordiniTo}
              className="cliente-header-account__all"
              onClick={() => setOpen(false)}
            >
              Vedi tutti gli ordini
            </Link>
          </div>
        ) : null}
      </div>
      {!isDemoCliente ? (
        <button
          type="button"
          className="cliente-header-account__logout"
          onClick={() => void logout()}
        >
          Esci
        </button>
      ) : null}
      {recallOrdineId ? (
        <ClienteOrdineRecallModal
          ordineId={recallOrdineId}
          onClose={() => setRecallOrdineId(null)}
        />
      ) : null}
    </div>
  )
}
