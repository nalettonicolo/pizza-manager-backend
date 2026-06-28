import { useEffect, useState, useCallback, useRef } from "react";

import { useAuth } from "@/app/contexts/AuthContext";
import { useTenant } from "@/app/contexts/TenantContext";
import Loader from "@/components/feedback/Loader";
import ErrorState from "@/components/feedback/ErrorState";

import { getReportData } from "@/features/admin/services/adminService";
import { formatPrice } from "@/utils/format";

function defaultDateRangeStrings() {
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - 30);
  return {
    from: start.toISOString().slice(0, 10),
    to: end.toISOString().slice(0, 10),
  };
}

export default function Report() {
  const { tenantId } = useTenant();
  const { loading: authLoading } = useAuth();

  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dateFrom, setDateFrom] = useState(() => defaultDateRangeStrings().from);
  const [dateTo, setDateTo] = useState(() => defaultDateRangeStrings().to);
  const dateFromRef = useRef(dateFrom);
  const dateToRef = useRef(dateTo);
  dateFromRef.current = dateFrom;
  dateToRef.current = dateTo;

  const loadReport = useCallback(async () => {
    if (!tenantId) {
      setLoading(false);
      setReport(null);
      setError("Nessun tenant associato all’account: impossibile caricare il report.");
      return;
    }
    const startIso = `${dateFromRef.current}T00:00:00.000`;
    const endIso = `${dateToRef.current}T23:59:59.999`;
    try {
      setLoading(true);
      setError(null);
      const data = await getReportData(tenantId, startIso, endIso);
      setReport(data || {});
    } catch (err) {
      console.error(err);
      setError("Errore nel caricamento del report.");
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    if (authLoading) return;
    if (!tenantId) {
      setLoading(false);
      setReport(null);
      setError("Nessun tenant associato all’account: impossibile caricare il report.");
      return;
    }
    void loadReport();
  }, [tenantId, authLoading, loadReport]);

  if (authLoading || loading) return <Loader />;
  if (error) return <ErrorState message={error} />;
  if (!report) return null;

  const topList = Array.isArray(report.topProdotti) ? report.topProdotti : [];
  const macro = report.macroVendite || {};
  const periodoLabel =
    report.periodoInizio && report.periodoFine
      ? `${new Date(report.periodoInizio).toLocaleDateString("it-IT")} — ${new Date(report.periodoFine).toLocaleDateString("it-IT")}`
      : "ultimi 30 giorni";

  const exportCsv = () => {
    const lines = [
      "metrica,valore",
      `totale_ordini,${report.totaleOrdini ?? 0}`,
      `fatturato_euro,${Number(report.fatturato ?? 0).toFixed(2)}`,
      "",
      "macro_categoria,pezzi",
      `pizze,${macro.pizze ?? 0}`,
      `fritti,${macro.fritti ?? 0}`,
      `dolci,${macro.dolci ?? 0}`,
      `bibite,${macro.bibite ?? 0}`,
      `altro,${macro.altro ?? 0}`,
      `totale_pezzi,${macro.totalePezzi ?? 0}`,
      "",
      "posizione,prodotto,quantita",
      ...topList.map((row, idx) => `${idx + 1},"${String(row.nome || "").replace(/"/g, '""')}",${row.quantita ?? 0}`),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `report-vendite-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div style={styles.wrapper}>
      <h1 style={styles.pageTitle}>Report Vendite</h1>
      <div style={styles.filtersRow}>
        <label style={styles.filterLabel}>
          Da
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} style={styles.dateInput} />
        </label>
        <label style={styles.filterLabel}>
          A
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} style={styles.dateInput} />
        </label>
        <button type="button" className="btn-primary-dashboard" onClick={() => void loadReport()} disabled={loading}>
          Aggiorna
        </button>
      </div>
      <p style={styles.hint}>
        Periodo: <strong>{periodoLabel}</strong>. Ordini con stato <strong>ANNULLATO</strong> esclusi da totali e classifica. Classifica per{" "}
        <strong>nome prodotto</strong> (e formato se presente); le categorie impostate come &quot;ingredienti&quot; non entrano in classifica.
      </p>
      <button type="button" onClick={exportCsv} style={styles.csvBtn}>
        Scarica CSV
      </button>

      <div style={styles.row}>
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>Totale ordini</h3>
          <p style={styles.cardValue}>{report.totaleOrdini ?? 0}</p>
        </div>

        <div style={styles.card}>
          <h3 style={styles.cardTitle}>Fatturato</h3>
          <p style={styles.cardValue}>{formatPrice(report.fatturato, "0.00")} €</p>
        </div>
      </div>

      <div style={styles.cardWide}>
        <h3 style={styles.cardTitle}>Vendite per macro-categoria</h3>
        <ul style={styles.rankList}>
          {[
            ["Pizze", macro.pizze],
            ["Fritti", macro.fritti],
            ["Dolci", macro.dolci],
            ["Bibite", macro.bibite],
            ["Altro", macro.altro],
          ].map(([label, qty]) => (
            <li key={label} style={styles.rankItem}>
              <span style={styles.rankName}>{label}</span>
              <span style={styles.rankQty}>{qty ?? 0} pz</span>
            </li>
          ))}
        </ul>
        <p style={{ ...styles.empty, marginTop: 8 }}>
          Totale pezzi nel periodo: <strong>{macro.totalePezzi ?? 0}</strong>
        </p>
      </div>

      <div style={styles.cardWide}>
        <h3 style={styles.cardTitle}>Top 5 prodotti più venduti</h3>
        {topList.length === 0 ? (
          <p style={styles.empty}>Nessun dato nelle righe ordine nel periodo, oppure solo voci escluse (ingredienti).</p>
        ) : (
          <ol style={styles.rankList}>
            {topList.map((row, idx) => (
              <li key={`${row.nome}-${idx}`} style={styles.rankItem}>
                <span style={styles.rankPos}>{idx + 1}</span>
                <span style={styles.rankName}>{row.nome}</span>
                <span style={styles.rankQty}>{row.quantita} pz</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}

const styles = {
  wrapper: {
    padding: "30px",
    display: "flex",
    flexDirection: "column",
    gap: "20px",
    maxWidth: 720,
  },
  pageTitle: {
    margin: 0,
    fontSize: "1.5rem",
    fontWeight: 700,
  },
  hint: {
    margin: 0,
    fontSize: 13,
    color: "#64748b",
    lineHeight: 1.5,
  },
  filtersRow: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "flex-end",
    gap: 12,
    marginBottom: 8,
  },
  filterLabel: {
    display: "flex",
    flexDirection: "column",
    fontSize: 12,
    color: "#64748b",
    gap: 4,
  },
  dateInput: {
    padding: "8px 10px",
    borderRadius: 8,
    border: "1px solid #cbd5e1",
    fontSize: 14,
  },
  csvBtn: {
    alignSelf: "flex-start",
    padding: "8px 16px",
    fontSize: 14,
    fontWeight: 600,
    borderRadius: 8,
    border: "1px solid #cbd5e1",
    background: "#fff",
    color: "#334155",
    cursor: "pointer",
    marginBottom: 8,
  },
  row: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
    gap: 16,
  },
  card: {
    padding: "20px",
    border: "1px solid #e2e8f0",
    borderRadius: "10px",
    background: "#fff",
  },
  cardWide: {
    padding: "20px",
    border: "1px solid #e2e8f0",
    borderRadius: "10px",
    background: "#fff",
  },
  cardTitle: {
    margin: "0 0 12px",
    fontSize: "0.95rem",
  },
  cardValue: {
    margin: 0,
    fontSize: "1.75rem",
    fontWeight: 700,
    color: "#0f172a",
  },
  empty: {
    margin: 0,
    fontSize: 14,
    color: "#64748b",
    lineHeight: 1.5,
  },
  rankList: {
    margin: 0,
    padding: 0,
    listStyle: "none",
  },
  rankItem: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "10px 0",
    borderBottom: "1px solid #f1f5f9",
    fontSize: 14,
  },
  rankPos: {
    fontWeight: 700,
    color: "#94a3b8",
    minWidth: 24,
  },
  rankName: {
    flex: 1,
    color: "#334155",
  },
  rankQty: {
    color: "#64748b",
    fontSize: 13,
  },
};
