import { useMemo } from "react";
import { Navigate, Link } from "react-router-dom";
import DashboardNavCards from "@/components/dashboard/DashboardNavCards";
import { useTenantServizi } from "@/app/hooks/useTenantServizi";
import { useAuth } from "@/app/contexts/AuthContext";
import { useOperativeSaDemoAccess } from "@/app/hooks/useOperativeSaDemoAccess";
import { isOperativeAreaPermitted } from "@/utils/operativePathEligibility";
import { isQuadRepartiTestEmail } from "@/constants/quadRepartiTest";
import { OPERATIVE_AREA_NAV } from "@/constants/operativeNav";

/** Card home: una voce per area operativa principale (non sottovoci cassa / turni). */
function buildWorkAreaCards() {
  const seen = new Set();
  const out = [];
  for (const item of OPERATIVE_AREA_NAV) {
    if (item.areaKey === "riepilogo") continue;
    if (item.to !== "/operative/cassa" && String(item.to).startsWith("/operative/cassa/")) continue;
    if (item.to === "/operative/turni") continue;
    if (seen.has(item.areaKey)) continue;
    seen.add(item.areaKey);
    const descriptions = {
      cassa: "Incassi e ordini",
      cucina: "Preparazione e task cucina",
      bancone: "Comande pronte e ritiri",
      pizzaiolo: "Forno e cottura",
      delivery: "Consegne a domicilio",
    };
    out.push({
      to: item.to,
      label: item.label,
      description: descriptions[item.areaKey] || "",
      servizioId: item.servizioId,
      areaKey: item.areaKey,
    });
  }
  return out;
}

const WORK_AREA_CARDS = Object.freeze(buildWorkAreaCards());

export default function OperativeDashboard() {
  const { user } = useAuth();
  const { hasServizio } = useTenantServizi();
  const { permessiAreeEffective, fullDemoAccess } = useOperativeSaDemoAccess();

  const items = useMemo(
    () =>
      WORK_AREA_CARDS.filter((item) => {
        if (item.servizioId && !hasServizio(item.servizioId) && !fullDemoAccess) return false;
        return isOperativeAreaPermitted(item.areaKey, permessiAreeEffective);
      }),
    [hasServizio, permessiAreeEffective, fullDemoAccess],
  );

  if (isQuadRepartiTestEmail(user?.email)) {
    return <Navigate to="/operative/pizzaiolo-ingresso" replace />;
  }

  return (
    <>
      <h1 className="dashboard-page-title">Aree di lavoro</h1>
      <p style={{ margin: "0 0 20px 0", fontSize: 14, color: "#666" }}>
        Scegli dove lavorare: cassa, cucina, bancone, forno o delivery.
      </p>
      {items.length ? (
        <DashboardNavCards items={[...items]} columns={3} />
      ) : (
        <div style={{ fontSize: 14, color: "#64748b", lineHeight: 1.55, maxWidth: 480 }}>
          <p style={{ margin: "0 0 8px" }}>
            Non risulta abilitata nessuna area operativa per il tuo utente.
          </p>
          <p style={{ margin: 0 }}>
            Chiedi all’amministratore di abilitarle in{" "}
            <Link to="/admin/utenti" style={{ color: "#1565c0", fontWeight: 600 }}>
              Admin → Dipendenti
            </Link>{" "}
            (Ruolo operativo / aree consentite).
          </p>
        </div>
      )}
    </>
  );
}
