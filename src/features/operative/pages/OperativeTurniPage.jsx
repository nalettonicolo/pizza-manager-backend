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
        Apertura e chiusura turno sul punto vendita attivo. I dati sono salvati su Supabase (tabella{" "}
        <code style={{ fontSize: 12, background: "#f1f5f9", padding: "2px 6px", borderRadius: 4 }}>turni_operatori</code>
        ) con riconciliazione in chiusura.
      </p>
      {!activePv && (
        <p style={{ marginBottom: 16, fontSize: 14, color: "#b45309" }}>
          Nessun punto vendita attivo: verifica la configurazione dei punti vendita per il tenant.
        </p>
      )}
      <TurnoControl tenantId={tenantId} puntoVenditaId={activePv} pvList={pvList} />
    </div>
  );
}
