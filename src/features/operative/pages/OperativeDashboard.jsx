import { useMemo } from "react"
import { Navigate, Link, useLocation } from "react-router-dom"
import DashboardNavCards from "@/components/dashboard/DashboardNavCards"
import { useTenantServizi } from "@/app/hooks/useTenantServizi"
import { useAuth } from "@/app/contexts/AuthContext"
import { useOperativeSaDemoAccess } from "@/app/hooks/useOperativeSaDemoAccess"
import { isOperativeAreaPermitted } from "@/utils/operativePathEligibility"
import { isQuadRepartiTestEmail } from "@/constants/quadRepartiTest"
import { OPERATIVE_AREA_NAV } from "@/constants/operativeNav"
import { DEMO_GIRO_ADMIN_LINKS } from "@/utils/demoGiro"
import { ADMIN_TENANT_HOME } from "@/constants/adminTenantHome"
import { withPreservedSupportSearch } from "@/utils/supportTenantOverride"
import { openDemoClienteArea, resolveDemoClienteTenantIdFromEnv } from "@/utils/demoClienteSession"

/** Card home: una voce per area operativa principale (non sottovoci cassa / turni). */
function buildWorkAreaCards() {
  const seen = new Set()
  const out = []
  for (const item of OPERATIVE_AREA_NAV) {
    if (item.areaKey === "riepilogo") continue
    if (item.to !== "/operative/cassa" && String(item.to).startsWith("/operative/cassa/")) continue
    if (item.to === "/operative/turni") continue
    if (seen.has(item.to)) continue
    seen.add(item.to)
    const descriptions = {
      cassa: "Incassi e ordini",
      cucina: "Preparazione e task cucina",
      bancone: "Comande pronte e ritiri",
      pizzaiolo: "Forno e cottura",
      delivery: "Consegne a domicilio e pony",
    }
    out.push({
      to: item.to,
      label: item.label,
      description: descriptions[item.areaKey] || item.description || "",
      servizioId: item.servizioId,
      areaKey: item.areaKey,
    })
  }
  return out
}

const WORK_AREA_CARDS = Object.freeze(buildWorkAreaCards())

export default function OperativeDashboard() {
  const { user } = useAuth()
  const location = useLocation()
  const { hasServizio } = useTenantServizi()
  const { permessiAreeEffective, fullDemoAccess, inDemoLive } = useOperativeSaDemoAccess()

  const items = useMemo(
    () =>
      WORK_AREA_CARDS.filter((item) => {
        if (item.servizioId && !hasServizio(item.servizioId) && !fullDemoAccess) return false
        return isOperativeAreaPermitted(item.areaKey, permessiAreeEffective)
      }).map((item) => ({
        ...item,
        to: withPreservedSupportSearch(item.to, location.search),
      })),
    [hasServizio, permessiAreeEffective, fullDemoAccess, location.search],
  )

  const adminItems = useMemo(() => {
    if (!inDemoLive && !fullDemoAccess) return []
    return DEMO_GIRO_ADMIN_LINKS.filter((l) => l.group === "admin").map((l) => ({
      to: withPreservedSupportSearch(
        l.path === "/admin/home" ? ADMIN_TENANT_HOME : l.path,
        location.search,
      ),
      label: l.label,
      description: l.description || "",
    }))
  }, [inDemoLive, fullDemoAccess, location.search])

  const wowItems = useMemo(() => {
    if (!inDemoLive) return []
    const strumenti = DEMO_GIRO_ADMIN_LINKS.filter((l) => l.group === "strumenti")
    return [
      ...strumenti.map((l) => {
        const to = withPreservedSupportSearch(l.path, location.search)
        const base = {
          to,
          label: l.label,
          description: l.description || "",
        }
        if (l.demoClienteLogin) {
          return {
            ...base,
            onClick: async () => {
              const tid =
                resolveDemoClienteTenantIdFromEnv() ||
                String(import.meta.env.VITE_PUBLIC_DEMO_TENANT_ID || "").trim()
              if (!tid) {
                window.alert("Tenant demo non configurato.")
                return
              }
              const login = await openDemoClienteArea(tid, "/preview")
              if (!login.ok) window.alert(login.error || "Apertura area cliente non riuscita.")
            },
          }
        }
        return base
      }),
      {
        to: withPreservedSupportSearch("/operative/test-reparti-quad", location.search),
        label: "4 reparti insieme",
        description: "Pizzaioli, bancone, cucina e delivery in contemporanea",
      },
    ]
  }, [inDemoLive, location.search])

  if (isQuadRepartiTestEmail(user?.email)) {
    return <Navigate to="/operative/pizzaiolo-ingresso" replace />
  }

  return (
    <>
      <h1 className="dashboard-page-title">{inDemoLive ? "Demo live" : "Aree di lavoro"}</h1>
      {inDemoLive ? (
        <div
          style={{
            margin: "0 0 22px",
            padding: "14px 16px",
            borderRadius: 10,
            border: "1px solid #fdba74",
            background: "linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%)",
            maxWidth: 720,
          }}
        >
          <p style={{ margin: "0 0 6px", fontSize: 15, fontWeight: 700, color: "#9a3412" }}>
            Un locale completo: sala, forno, consegne e gestione.
          </p>
          <p style={{ margin: 0, fontSize: 13, color: "#9a3412", lineHeight: 1.55 }}>
            Scegli un reparto operativo, apri l’<strong>Admin del locale</strong> (menu, dipendenti, impostazioni) oppure
            mostra i <strong>4 reparti insieme</strong> — tutto senza cambiare account.
          </p>
        </div>
      ) : (
        <p style={{ margin: "0 0 20px 0", fontSize: 14, color: "#666" }}>
          Scegli dove lavorare: cassa, cucina, bancone, forno o delivery.
        </p>
      )}

      {inDemoLive ? (
        <h2 style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 700, color: "#334155" }}>
          Reparti operativi
        </h2>
      ) : null}
      {items.length ? (
        <DashboardNavCards items={[...items]} columns={3} />
      ) : (
        <div style={{ fontSize: 14, color: "#64748b", lineHeight: 1.55, maxWidth: 480 }}>
          <p style={{ margin: "0 0 8px" }}>Non risulta abilitata nessuna area operativa per il tuo utente.</p>
          <p style={{ margin: 0 }}>
            Chiedi all’amministratore di abilitarle in{" "}
            <Link to="/admin/utenti" style={{ color: "#1565c0", fontWeight: 600 }}>
              Admin → Dipendenti
            </Link>{" "}
            (Ruolo operativo / aree consentite).
          </p>
        </div>
      )}

      {adminItems.length ? (
        <section style={{ marginTop: 28 }}>
          <h2 style={{ margin: "0 0 6px", fontSize: 15, fontWeight: 700, color: "#334155" }}>
            Admin del locale
          </h2>
          <p style={{ margin: "0 0 12px", fontSize: 13, color: "#64748b", maxWidth: 560 }}>
            Apri <strong>Gestione locale</strong> per il pannello completo; oppure vai diretto a menu, ordini,
            impostazioni o staff.
          </p>
          <DashboardNavCards items={adminItems} columns={3} />
        </section>
      ) : null}

      {wowItems.length ? (
        <section style={{ marginTop: 28 }}>
          <h2 style={{ margin: "0 0 6px", fontSize: 15, fontWeight: 700, color: "#334155" }}>
            Cosa mostrare al cliente
          </h2>
          <p style={{ margin: "0 0 12px", fontSize: 13, color: "#64748b", maxWidth: 560 }}>
            Vista multi-reparto, area cliente e vetrina online: il flusso completo dalla comanda al domicilio.
          </p>
          <DashboardNavCards items={wowItems} columns={3} />
        </section>
      ) : null}
    </>
  )
}
