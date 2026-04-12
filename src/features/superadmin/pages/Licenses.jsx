import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { getSubscriptions } from "@/features/superadmin/services/superadminService";
import { pianoDisplayLabel } from "@/features/superadmin/utils/pianoLabels";
import SaListSearchField from "@/features/superadmin/components/SaListSearchField";
import { normalizeListSearchQuery, rowMatchesListSearch } from "@/utils/listSearchFilter";

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
  const [listQuery, setListQuery] = useState("");

  const filteredList = useMemo(() => {
    const q = normalizeListSearchQuery(listQuery);
    if (!q) return list;
    return list.filter((s) =>
      rowMatchesListSearch(q, [
        s.tenant_nome,
        s.tenant_slug,
        s.piano,
        pianoDisplayLabel(s.piano),
        s.stato,
        STATO_LABEL[s.stato],
        s.ciclo_fatturazione_giorni,
        s.rinnovo_il,
        s.rinnovo_automatico ? "automatico" : "",
      ]),
    );
  }, [list, listQuery]);

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

      <p style={{ margin: "0 0 16px", fontSize: 14, color: "#555", maxWidth: "100%" }}>
        Ogni cliente ha una riga di abbonamento collegata al tenant. <strong>Ciclo mensile (30 giorni)</strong> o{" "}
        <strong>annuale (12 mesi di calendario)</strong> e eventuale <strong>sconto sull&apos;unica rata annuale</strong> si
        impostano in <Link to="/superadmin/tenants">Clienti</Link> (modifica cliente → Abbonamento). Il{" "}
        <strong>prossimo rinnovo</strong> segue i mesi solari (stesso giorno del mese quando possibile). All&apos;apertura
        di questa pagina vengono create le
        righe mancanti in base ai clienti già presenti.
      </p>

      <div className="sa-page-toolbar" style={{ marginBottom: 16 }}>
        <SaListSearchField
          id="sa-licenses-search"
          value={listQuery}
          onChange={setListQuery}
          placeholder="Cerca per cliente, slug, piano, stato…"
          resultsCount={filteredList.length}
          totalCount={list.length}
        />
      </div>

      <div className="dashboard-table-wrap" style={{ overflowX: "auto" }}>
        <table style={{ minWidth: 900 }}>
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Slug</th>
              <th>Piano</th>
              <th>Ciclo</th>
              <th>Sconto ann.</th>
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
                <td colSpan={10} style={{ padding: 32, textAlign: "center", color: "#666", fontSize: 14 }}>
                  Nessun abbonamento al momento. Verifica che esistano clienti e che la tabella subscriptions sia
                  accessibile (vedi anche Clienti dopo un salvataggio).
                </td>
              </tr>
            ) : filteredList.length === 0 ? (
              <tr>
                <td colSpan={10} style={{ padding: 32, textAlign: "center", color: "#666", fontSize: 14 }}>
                  Nessun risultato per la ricerca.
                </td>
              </tr>
            ) : (
              filteredList.map((s) => (
                <tr key={s.id}>
                  <td style={{ fontWeight: 600 }}>{s.tenant_nome}</td>
                  <td style={{ color: "#666" }}>{s.tenant_slug}</td>
                  <td>{pianoDisplayLabel(s.piano)}</td>
                  <td style={{ fontSize: 13, color: "#475569" }}>
                    {Number(s.ciclo_fatturazione_giorni) === 365 ? "12 mesi (annuale)" : "1 mese (mensile)"}
                  </td>
                  <td style={{ fontSize: 13, color: "#475569" }}>
                    {Number(s.ciclo_fatturazione_giorni) === 365 && s.sconto_annuale_percent != null
                      ? `−${Number(s.sconto_annuale_percent)}%`
                      : "—"}
                  </td>
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
