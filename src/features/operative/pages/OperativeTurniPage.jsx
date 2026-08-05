import { useAuth } from "@/app/contexts/AuthContext";
import { useTenant } from "@/app/contexts/TenantContext";
import { usePv } from "@/app/contexts/PvContext";
import TurnoControl from "@/components/TurnoControl";

export default function OperativeTurniPage() {
  const { user } = useAuth();
  const { tenantId } = useTenant();
  const { activePv, pvList } = usePv();

  if (!user?.id || !tenantId) {
    return <p style={{ padding: 16, fontSize: 14, color: "#64748b" }}>Caricamento contesto sessione…</p>;
  }

  return (
    <div style={{ maxWidth: 560 }}>
      <h1 className="dashboard-page-title">Turni cassa</h1>
      <p style={{ margin: "0 0 20px 0", fontSize: 14, color: "#64748b" }}>
        Apri e chiudi il turno sul punto vendita attivo. In chiusura puoi indicare il fondo contato e allinearlo
        agli incassi del turno.
      </p>
      {!activePv && (
        <p style={{ marginBottom: 16, fontSize: 14, color: "#b45309" }}>
          Nessun punto vendita attivo: seleziona o configura un punto vendita per questa pizzeria.
        </p>
      )}
      <TurnoControl tenantId={tenantId} puntoVenditaId={activePv} pvList={pvList} />
    </div>
  );
}
