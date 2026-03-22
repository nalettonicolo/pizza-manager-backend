import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getSubscriptions } from "@/features/superadmin/services/superadminService";
import { pianoDisplayLabel } from "@/features/superadmin/utils/pianoLabels";

const STATO_LABEL = {
  ATTIVA: "Attiva",
  SCADUTA: "Scaduta",
  SOSPESA: "Sospesa",
  CANCELLATA: "Cancellata",
};

const STATO_BADGE = {
  ATTIVA: "badge badge-success",
  SCADUTA: "badge badge-danger",
  SOSPESA: "badge badge-warning",
  CANCELLATA: "badge badge-neutral",
};

export default function Licenses() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        setError(null);
        const data = await getSubscriptions();
        if (!cancelled) setList(data);
      } catch (err) {
        if (!cancelled) setError(err?.message ?? "Errore caricamento licenze");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="dashboard-loading">
        <div className="skeleton" />
        <div className="skeleton-row" />
      </div>
    );
  }

  return (
    <>
      <div style={{ marginBottom: 16 }}>
        <Link
          to="/superadmin/dashboard"
          style={{
            display: "inline-block",
            padding: "10px 20px",
            background: "#d35400",
            color: "#fff",
            borderRadius: 6,
            textDecoration: "none",
            fontWeight: 600,
            fontSize: 14,
          }}
        >
          ← Torna al Riepilogo
        </Link>
      </div>
      <div className="dashboard-page-header">
        <div>
          <h1 className="dashboard-page-title">Abbonamenti</h1>
        </div>
        <Link to="/superadmin/tenants" className="btn-primary-dashboard" style={{ textDecoration: "none" }}>
          Gestisci clienti →
        </Link>
      </div>

      {error && <div className="dashboard-error" style={{ marginBottom: 16 }}>{error}</div>}

      {list.some((s) => s._fromTenantOnly) && (
        <div
          className="dashboard-error"
          style={{
            marginBottom: 16,
            background: "#fffbeb",
            borderColor: "#fcd34d",
            color: "#92400e",
          }}
        >
          Le righe sono ricavate dai dati cliente: in database non risultano ancora record in{" "}
          <code style={{ fontSize: 13 }}>subscriptions</code> (controlla policy RLS o esegui il salvataggio da Clienti).
        </div>
      )}

      <p style={{ margin: "0 0 16px", fontSize: 14, color: "#555", maxWidth: 720 }}>
        Ogni cliente ha una riga di abbonamento collegata al tenant. Il <strong>rinnovo automatico</strong> e la data di
        attivazione si impostano in <Link to="/superadmin/tenants">Clienti</Link> (modifica cliente → sezione Abbonamento).
        All’apertura di questa pagina vengono create le righe mancanti in base ai clienti già presenti.
      </p>

      <div className="dashboard-table-wrap" style={{ overflowX: "auto" }}>
        <table style={{ minWidth: 900 }}>
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Slug</th>
              <th>Piano</th>
              <th>Stato</th>
              <th>Rinnovo automatico</th>
              <th>Prossimo rinnovo</th>
              <th>Attivazione</th>
              <th>Creata</th>
            </tr>
          </thead>
          <tbody>
            {list.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ padding: 32, textAlign: "center", color: "#666", fontSize: 14 }}>
                  Nessun abbonamento al momento. Verifica che esistano clienti e che la tabella subscriptions sia
                  accessibile (vedi anche Clienti dopo un salvataggio).
                </td>
              </tr>
            ) : (
              list.map((s) => (
                <tr key={s.id}>
                  <td style={{ fontWeight: 600 }}>{s.tenant_nome}</td>
                  <td style={{ color: "#666" }}>{s.tenant_slug}</td>
                  <td>{pianoDisplayLabel(s.piano)}</td>
                  <td>
                    <span className={STATO_BADGE[s.stato] ?? "badge badge-neutral"}>
                      {STATO_LABEL[s.stato] ?? s.stato}
                    </span>
                  </td>
                  <td style={{ fontSize: 13 }}>
                    {s.rinnovo_automatico ? (
                      <span className="badge badge-success">Sì</span>
                    ) : (
                      <span className="badge badge-neutral">No</span>
                    )}
                  </td>
                  <td style={{ color: "#666", fontSize: 13 }}>
                    {s.rinnovo_il ? new Date(s.rinnovo_il).toLocaleDateString("it-IT") : "—"}
                  </td>
                  <td style={{ color: "#666", fontSize: 13 }}>
                    {s.data_attivazione_abbonamento
                      ? new Date(s.data_attivazione_abbonamento).toLocaleDateString("it-IT")
                      : "—"}
                  </td>
                  <td style={{ color: "#666", fontSize: 13 }}>
                    {s.created_at ? new Date(s.created_at).toLocaleDateString("it-IT") : "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
