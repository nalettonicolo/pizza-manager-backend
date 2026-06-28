import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import AdminModuleShell from "@/features/admin/components/AdminModuleShell";
import { useTenant } from "@/app/contexts/TenantContext";
import {
  listNotificheOutbox,
  notificheOutboxTableReachable,
  retryNotificheOutboxItem,
} from "@/features/admin/services/adminService";

const STATUS_OPTIONS = [
  { value: "", label: "Tutti gli stati" },
  { value: "in_coda", label: "In coda" },
  { value: "in_elaborazione", label: "In elaborazione" },
  { value: "inviato", label: "Inviato" },
  { value: "fallito", label: "Fallito" },
  { value: "annullato", label: "Annullato" },
];

function statusColor(stato) {
  switch (stato) {
    case "in_coda":
      return "#92400e";
    case "in_elaborazione":
      return "#1e40af";
    case "inviato":
      return "#166534";
    case "fallito":
      return "#991b1b";
    default:
      return "#64748b";
  }
}

export default function NotificheOutboxMonitorPage() {
  const { tenantId } = useTenant();
  const [rows, setRows] = useState([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [dbOk, setDbOk] = useState(null);
  const [retryBusy, setRetryBusy] = useState(null);

  const load = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    setErr(null);
    try {
      const reachable = await notificheOutboxTableReachable(tenantId);
      setDbOk(reachable);
      if (!reachable) {
        setRows([]);
        return;
      }
      const list = await listNotificheOutbox(tenantId, 150);
      setRows(list);
    } catch (e) {
      setErr(e?.message || "Errore caricamento notifiche");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    if (!statusFilter) return rows;
    return rows.filter((r) => r.stato === statusFilter);
  }, [rows, statusFilter]);

  const counts = useMemo(() => {
    const c = { in_coda: 0, fallito: 0, inviato: 0 };
    for (const r of rows) {
      if (r.stato === "in_coda" || r.stato === "in_elaborazione") c.in_coda += 1;
      if (r.stato === "fallito") c.fallito += 1;
      if (r.stato === "inviato") c.inviato += 1;
    }
    return c;
  }, [rows]);

  async function handleRetry(id) {
    setRetryBusy(id);
    try {
      await retryNotificheOutboxItem(id);
      await load();
    } catch (e) {
      setErr(e?.message || "Retry non riuscito");
    } finally {
      setRetryBusy(null);
    }
  }

  return (
    <AdminModuleShell
      title="Coda notifiche"
      lead="Coda interna per avvisi staff (es. nuovo ordine web). Il worker Edge instrada per canale (email, SMS, WhatsApp, in-app). Gli adapter di invio sono predisposti ma da completare con le API del tenant."
      specTitle="Architettura"
      specChildren={
        <p style={{ margin: 0 }}>
          Adapter stub: <code>supabase/functions/_shared/notifications/adapters/</code>. Documentazione:{" "}
          <code>docs/NOTIFICHE_INTEGRAZIONE.md</code>. Percorso consigliato senza API esterne:{" "}
          <strong>stampa comanda automatica</strong> + schermate operative. Canale e destinatari in Admin →
          Impostazioni → Parametri (ordini web).
        </p>
      }
    >
      {dbOk === false ? (
        <p style={{ padding: 12, background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: 8, color: "#92400e" }}>
          Coda notifiche non disponibile. Applica <code>sql/modules/21_fase4_fidelity_notifiche.sql</code> e{" "}
          <code>sql/modules/23_notifiche_worker_delivery_stati.sql</code> su Supabase.
        </p>
      ) : null}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 16, fontSize: 13, color: "#475569" }}>
        <span>In coda: <strong>{counts.in_coda}</strong></span>
        <span>Inviate: <strong>{counts.inviato}</strong></span>
        <span>Fallite: <strong>{counts.fallito}</strong></span>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 16, alignItems: "center" }}>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{ padding: 8, borderRadius: 6, border: "1px solid #cbd5e1" }}
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value || "all"} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <button type="button" className="btn-secondary" onClick={() => void load()} disabled={loading}>
          Aggiorna
        </button>
      </div>

      {err ? (
        <p role="alert" style={{ color: "#b91c1c", marginBottom: 12 }}>
          {err}
        </p>
      ) : null}

      {loading && !rows.length ? <p>Caricamento…</p> : null}

      {!loading && filtered.length === 0 ? (
        <p style={{ color: "#64748b" }}>Nessuna notifica nel periodo recente.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table className="admin-table" style={{ width: "100%", fontSize: 13 }}>
            <thead>
              <tr>
                <th>Tipo</th>
                <th>Destinatario</th>
                <th>Canale</th>
                <th>Stato</th>
                <th>Tentativi</th>
                <th>Creato</th>
                <th>Azioni</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id}>
                  <td>{r.tipo}</td>
                  <td>{r.destinatario}</td>
                  <td style={{ fontSize: 12, color: "#64748b" }}>
                    {r.payload?.canale ?? r.payload?.channel ?? "—"}
                  </td>
                  <td style={{ color: statusColor(r.stato), fontWeight: 600 }}>{r.stato}</td>
                  <td>{r.tentativi ?? 0}</td>
                  <td>{r.created_at ? new Date(r.created_at).toLocaleString("it-IT") : "—"}</td>
                  <td>
                    {r.stato === "fallito" || r.stato === "annullato" ? (
                      <button
                        type="button"
                        className="btn-secondary"
                        disabled={retryBusy === r.id}
                        onClick={() => void handleRetry(r.id)}
                      >
                        {retryBusy === r.id ? "…" : "Rimetti in coda"}
                      </button>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p style={{ marginTop: 20, fontSize: 13, color: "#94a3b8" }}>
        Vedi anche <Link to="/admin/fiscal-outbox">Coda fiscale</Link>.
      </p>
    </AdminModuleShell>
  );
}
