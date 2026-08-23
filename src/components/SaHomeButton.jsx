import { Link, useNavigate } from "react-router-dom"
import { clearDemoGiroSession } from "@/utils/demoGiro"
import { clearSupportTenantOverride } from "@/utils/supportTenantOverride"

const SA_HOME = "/superadmin/ingresso"

/** Marchio tipografico PizzaManager (logo.svg vuoto nel repo). */
export function PmMark({ size = 18 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      aria-hidden
      focusable="false"
    >
      <rect x="1" y="1" width="30" height="30" rx="8" fill="#c0392b" />
      <path
        d="M9 23V9h6.2c3.4 0 5.5 1.85 5.5 4.55 0 1.85-.95 3.25-2.55 3.95L22 23h-3.35l-3.4-5.05H12.2V23H9zm3.2-7.85h2.85c1.7 0 2.7-.85 2.7-2.2s-1-2.15-2.7-2.15H12.2v4.35z"
        fill="#fff"
      />
    </svg>
  )
}

/**
 * Torna all’ingresso Super Admin oppure, in demo operativa, all’hub DEMO.
 * @param {{ className?: string, compact?: boolean, mode?: 'ingresso'|'demoHub' }} props
 */
export default function SaHomeButton({ className = "", compact = false, mode = "ingresso" }) {
  const isDemoHub = mode === "demoHub"
  const navigate = useNavigate()

  if (isDemoHub) {
    return (
      <Link
        to="/operative/dashboard"
        onClick={(e) => {
          // Mantieni il giro demo; preserva query support/_demo_giro se presenti.
          // Navigazione client-side (niente reload pagina intera: altrimenti ogni
          // ritorno all'hub demo ricarica da zero bundle/sessione/dati tenant).
          try {
            const qs = new URLSearchParams(window.location.search)
            if (!qs.get("_demo_giro")) qs.set("_demo_giro", "1")
            const tid = qs.get("support_tenant") || String(import.meta.env.VITE_PUBLIC_DEMO_TENANT_ID || "").trim()
            if (tid && !qs.get("support_tenant")) qs.set("support_tenant", tid)
            const next = `/operative/dashboard?${qs.toString()}`
            e.preventDefault()
            navigate(next)
          } catch {
            /* Link default */
          }
        }}
        className={`sa-home-btn${compact ? " sa-home-btn--compact" : ""}${className ? ` ${className}` : ""}`}
        title="Torna all’hub DEMO (aree di lavoro)"
        aria-label="Torna all’hub DEMO"
      >
        <PmMark size={compact ? 16 : 18} />
        <span className="sa-home-btn-label">DEMO</span>
      </Link>
    )
  }

  return (
    <Link
      to={SA_HOME}
      onClick={() => {
        // Pulizia completa: sessionStorage (giro demo) E localStorage (override
        // tenant supporto) — altrimenti il tenant di supporto resta "appiccicato"
        // (letto da resolveSupportTenantOverride) e rimanda di nuovo in area demo.
        clearDemoGiroSession()
        clearSupportTenantOverride()
      }}
      className={`sa-home-btn${compact ? " sa-home-btn--compact" : ""}${className ? ` ${className}` : ""}`}
      title="Torna alla home Super Admin"
      aria-label="Torna alla home Super Admin"
    >
      <PmMark size={compact ? 16 : 18} />
      <span className="sa-home-btn-label">{compact ? "Home SA" : "Home Super Admin"}</span>
    </Link>
  )
}
