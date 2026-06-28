import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import AdminModuleShell from "@/features/admin/components/AdminModuleShell";
import { useTenant } from "@/app/contexts/TenantContext";
import {
  exportFiscalOutboxPendingJson,
  fiscalOutboxTableReachable,
  listFiscalOutbox,
  retryFiscalOutboxItem,
} from "@/features/admin/services/adminService";

const STATUS_OPTIONS = [
  { value: "", label: "Tutti gli stati" },
  { value: "pending", label: "In attesa" },
  { value: "processing", label: "In elaborazione" },
  { value: "sent", label: "Inviato" },
  { value: "ack", label: "Confermato" },
  { value: "failed", label: "Fallito" },
  { value: "cancelled", label: "Annullato" },
];

function statusColor(status) {
  switch (status) {
    case "pending":
      return "#92400e";
    case "processing":
      return "#1e40af";
    case "sent":
    case "ack":
      return "#166534";
    case "failed":
      return "#991b1b";
    default:
      return "#64748b";
  }
}

export default function FiscalOutboxMonitorPage() {
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
      const reachable = await fiscalOutboxTableReachable(tenantId);
      setDbOk(reachable);
      if (!reachable) {
        setRows([]);
        return;
      }
      const list = await listFiscalOutbox(tenantId, {
        status: statusFilter || null,
        limit: 150,
      });
      setRows(list);
    } catch (e) {
      setErr(e?.message || "Errore caricamento coda fiscale");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [tenantId, statusFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const counts = useMemo(() => {
    const c = { pending: 0, failed: 0, sent: 0 };
    for (const r of rows) {
      if (r.status === "pending" || r.status === "processing") c.pending += 1;
      if (r.status === "failed") c.failed += 1;
      if (r.status === "sent" || r.status === "ack") c.sent += 1;
    }
    return c;
  }, [rows]);

  async function handleRetry(id) {
    setRetryBusy(id);
    try {
      await retryFiscalOutboxItem(id);
      await load();
    } catch (e) {
      setErr(e?.message || "Retry non riuscito");
    } finally {
      setRetryBusy(null);
    }
  }

  async function handleExportPendingJson() {
    if (!tenantId) return;
    try {
      const { items } = await exportFiscalOutboxPendingJson(tenantId, 100);
      const blob = new Blob([JSON.stringify({ items }, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `fiscal-outbox-pending-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e) {
      setErr(e?.message || "Export JSON non riuscito");
    }
  }

  return (
    <AdminModuleShell
      title="Coda fiscale"
      lead="Monitoraggio messaggi in uscita verso registratore telematico / SDI. Lo worker Edge elabora gli item in stato pending o failed."
      specTitle="Configurazione"
      specChildren={
        <p style={{ margin: 0 }}>
          Attiva la modalità fiscal in{" "}
          <Link to="/operative/cassa/impostazioni">Cassa → Impostazioni → Pagamenti</Link>. Emissione reale RT/SDI
          richiede un provider collegato.
        </p>
      }
    >
      {dbOk === false ? (
        <p style={{ padding: 12, background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: 8, color: "#92400e" }}>
          Tabella <code>fiscal_outbox</code> non disponibile. Applica{" "}
          <code>sql/modules/12_fiscal_outbox_payment_links.sql</code> (già in schema_completo) su Supabase.
        </p>
      ) : null}

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
        <button type="button" className="btn-secondary" onClick={() => void handleExportPendingJson()} disabled={!dbOk}>
          Esporta pending (JSON)
        </button>
        <span style={{ fontSize: 13, color: "#64748b" }}>
          In coda: {counts.pending} · Falliti: {counts.failed} · OK: {counts.sent}
        </span>
      </div>

      {err ? (
        <p style={{ padding: 12, background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, color: "#991b1b" }}>
          {err}
        </p>
      ) : null}

      {loading ? <p className="text-gray-400 text-sm">Caricamento…</p> : null}

      {!loading && rows.length === 0 ? (
        <p style={{ padding: 16, color: "#94a3b8", fontSize: 14 }}>Nessun messaggio in coda per questo tenant.</p>
      ) : null}

      {rows.length > 0 ? (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "2px solid #e2e8f0", color: "#64748b" }}>
                <th style={{ padding: "8px 6px" }}>Data</th>
                <th style={{ padding: "8px 6px" }}>Tipo</th>
                <th style={{ padding: "8px 6px" }}>Stato</th>
                <th style={{ padding: "8px 6px" }}>Ordine</th>
                <th style={{ padding: "8px 6px" }}>Tentativi</th>
                <th style={{ padding: "8px 6px" }}>Errore</th>
                <th style={{ padding: "8px 6px" }} />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <td style={{ padding: "8px 6px", whiteSpace: "nowrap" }}>
                    {r.created_at ? new Date(r.created_at).toLocaleString("it-IT") : "—"}
                  </td>
                  <td style={{ padding: "8px 6px" }}>{r.kind}</td>
                  <td style={{ padding: "8px 6px", color: statusColor(r.status), fontWeight: 600 }}>{r.status}</td>
                  <td style={{ padding: "8px 6px" }}>
                    {r.ordine_id ? (
                      <Link to={`/admin/ordini?ordine=${r.ordine_id}`}>{String(r.ordine_id).slice(0, 8)}…</Link>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td style={{ padding: "8px 6px" }}>{r.attempt_count ?? 0}</td>
                  <td style={{ padding: "8px 6px", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis" }}>
                    {r.last_error || "—"}
                  </td>
                  <td style={{ padding: "8px 6px" }}>
                    {r.status === "failed" ? (
                      <button
                        type="button"
                        style={{ fontSize: 12, cursor: "pointer" }}
                        disabled={retryBusy === r.id}
                        onClick={() => void handleRetry(r.id)}
                      >
                        {retryBusy === r.id ? "…" : "Riprova"}
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </AdminModuleShell>
  );
}
