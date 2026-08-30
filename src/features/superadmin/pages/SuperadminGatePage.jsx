import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { Store, LayoutDashboard, Presentation, UserRound } from "lucide-react"
import { getTenants } from "@/features/superadmin/services/superadminService"
import { setSupportTenantOverride, withSupportTenantQuery } from "@/utils/supportTenantOverride"
import { withDemoGiroQuery, setDemoGiroSessionActive, clearDemoGiroSession } from "@/utils/demoGiro"
import { openDemoClienteArea } from "@/utils/demoClienteSession"
import SuperadminGateChrome from "@/features/superadmin/components/SuperadminGateChrome"

/** Hub iniziale demo: panoramica reparti + admin tenant. */
const DEMO_START_PATH = "/operative/dashboard"
const DEMO_CLIENTE_PATH = "/preview"

/**
 * Pagina post-login Super Admin: tre destinazioni — Amministrazione | Vetrina | Area demo.
 */
export default function SuperadminGatePage() {
  const navigate = useNavigate()
  const [demoStarting, setDemoStarting] = useState(false)
  const [previewStarting, setPreviewStarting] = useState(false)
  const [clienteStarting, setClienteStarting] = useState(false)
  const [demoError, setDemoError] = useState(null)

  const resolveDemoTenantId = async () => {
    const envId = String(import.meta.env.VITE_PUBLIC_DEMO_TENANT_ID || "").trim()
    if (envId) return envId
    const rows = await getTenants()
    const first = (rows || []).find((t) => t?.attivo !== false && t?.id)
    return first?.id ? String(first.id) : ""
  }

  const applySupportTenant = (tenantId) => {
    setSupportTenantOverride(tenantId)
    try {
      window.dispatchEvent(new Event("pm-support-tenant"))
    } catch {
      /* ignore */
    }
  }

  const busy = demoStarting || previewStarting || clienteStarting

  const startDemoGiro = async () => {
    setDemoError(null)
    setDemoStarting(true)
    try {
      const tenantId = await resolveDemoTenantId()
      if (!tenantId) {
        setDemoError("Nessun locale di prova disponibile. Contatta chi gestisce la piattaforma.")
        return
      }
      applySupportTenant(tenantId)
      setDemoGiroSessionActive(true)
      navigate(withDemoGiroQuery(DEMO_START_PATH, tenantId, { stepIndex: 0 }))
    } catch (e) {
      setDemoError(e?.message || "Avvio demo non riuscito.")
    } finally {
      setDemoStarting(false)
    }
  }

  const startSoloVetrina = async () => {
    setDemoError(null)
    setPreviewStarting(true)
    try {
      const tenantId = await resolveDemoTenantId()
      if (!tenantId) {
        setDemoError("Nessun locale di prova disponibile. Contatta chi gestisce la piattaforma.")
        return
      }
      applySupportTenant(tenantId)
      clearDemoGiroSession()
      navigate(withSupportTenantQuery("/preview", tenantId))
    } catch (e) {
      setDemoError(e?.message || "Apertura vetrina non riuscita.")
    } finally {
      setPreviewStarting(false)
    }
  }

  const startAreaCliente = async () => {
    setDemoError(null)
    setClienteStarting(true)
    try {
      const tenantId = await resolveDemoTenantId()
      if (!tenantId) {
        setDemoError("Nessun locale di prova disponibile. Contatta chi gestisce la piattaforma.")
        return
      }
      applySupportTenant(tenantId)
      setDemoGiroSessionActive(true)
      const login = await openDemoClienteArea(tenantId, DEMO_CLIENTE_PATH)
      if (!login.ok) {
        setDemoError(login.error)
        return
      }
    } catch (e) {
      setDemoError(e?.message || "Apertura area cliente non riuscita.")
    } finally {
      setClienteStarting(false)
    }
  }

  return (
    <SuperadminGateChrome>
      <main className="sa-gate-main">
        <p className="sa-gate-kicker">Accesso riservato</p>
        <h1 className="sa-gate-title">Dove vuoi andare?</h1>
        <p className="sa-gate-lede">
          Tre destinazioni. Resta loggato come Super Admin: non serve rifare l’accesso.
        </p>

        {demoError ? (
          <p role="alert" className="sa-gate-error">
            {demoError}
          </p>
        ) : null}

        <div className="sa-gate-triptych" role="navigation" aria-label="Destinazioni Super Admin">
          {/* SINISTRA — Amministrazione */}
          <Link to="/superadmin/dashboard" className="sa-gate-card sa-gate-card--admin sa-gate-card--tri">
            <span className="sa-gate-icon" aria-hidden>
              <LayoutDashboard size={40} strokeWidth={1.75} />
            </span>
            <span className="sa-gate-card-label">Amministrazione</span>
            <span className="sa-gate-card-desc">
              Console piattaforma: clienti, piani, go-live, documentazione e Chek-Sviluppi.
            </span>
          </Link>

          {/* CENTRO — Vetrina */}
          <button
            type="button"
            className="sa-gate-card sa-gate-card--preview sa-gate-card--tri"
            disabled={busy}
            onClick={() => void startSoloVetrina()}
          >
            <span className="sa-gate-icon" aria-hidden>
              <Store size={40} strokeWidth={1.75} />
            </span>
            <span className="sa-gate-card-label">
              {previewStarting ? "Apertura vetrina…" : "Vetrina"}
            </span>
            <span className="sa-gate-card-desc">
              Menù online del locale di prova, come lo vede chi visita il sito (senza entrare come cliente).
            </span>
          </button>

          {/* DESTRA — Area demo */}
          <div className="sa-gate-card sa-gate-card--demo-wrap sa-gate-card--tri">
            <span className="sa-gate-icon" aria-hidden>
              <Presentation size={40} strokeWidth={1.75} />
            </span>
            <span className="sa-gate-card-label">Area demo</span>
            <span className="sa-gate-card-desc">
              Giro operativo sul locale di prova (cassa, forno, cucina…) e, se serve, entrata come Cliente Test.
            </span>
            <div className="sa-gate-demo-actions">
              <button
                type="button"
                className="sa-gate-demo-btn sa-gate-demo-btn--primary"
                disabled={busy}
                onClick={() => void startDemoGiro()}
              >
                {demoStarting ? "Avvio…" : "Apri demo reparti"}
              </button>
              <button
                type="button"
                className="sa-gate-demo-btn"
                disabled={busy}
                onClick={() => void startAreaCliente()}
              >
                <UserRound size={16} strokeWidth={2.25} aria-hidden />
                {clienteStarting ? "Accesso…" : "Entra come Cliente Test"}
              </button>
            </div>
          </div>
        </div>
      </main>
    </SuperadminGateChrome>
  )
}
