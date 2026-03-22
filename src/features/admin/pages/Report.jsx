import { useEffect, useState } from "react";

import { useTenant } from "@/app/contexts/TenantContext";
import Loader from "@/components/feedback/Loader";
import ErrorState from "@/components/feedback/ErrorState";

import { getReportData } from "@/features/admin/services/adminService";
import { formatPrice } from "@/utils/format";

export default function Report() {
  const { tenantId } = useTenant();

  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!tenantId) return;

    async function loadReport() {
      try {
        setLoading(true);
        const data = await getReportData(tenantId);
        setReport(data || {});
      } catch (err) {
        console.error(err);
        setError("Errore nel caricamento del report.");
      } finally {
        setLoading(false);
      }
    }

    loadReport();
  }, [tenantId]);

  if (loading) return <Loader />;
  if (error) return <ErrorState message={error} />;
  if (!report) return null;

  const topList = Array.isArray(report.topProdotti) ? report.topProdotti : [];

  return (
    <div style={styles.wrapper}>
      <h1 style={styles.pageTitle}>Report Vendite</h1>
      <p style={styles.hint}>
        Periodo: ultimi 30 giorni. Classifica per <strong>nome prodotto</strong> (e formato se presente); le categorie
        impostate come &quot;ingredienti&quot; non entrano in classifica.
      </p>

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
    fontWeight: 600,
    color: "#334155",
  },
  cardValue: {
    margin: 0,
    fontSize: "1.5rem",
    fontWeight: 700,
    color: "#0f172a",
  },
  empty: {
    margin: 0,
    fontSize: 14,
    color: "#64748b",
  },
  rankList: {
    margin: 0,
    padding: 0,
    listStyle: "none",
    display: "flex",
    flexDirection: "column",
    gap: 0,
  },
  rankItem: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "12px 0",
    borderBottom: "1px solid #f1f5f9",
    fontSize: 15,
  },
  rankPos: {
    flexShrink: 0,
    width: 28,
    height: 28,
    borderRadius: 8,
    background: "#fef2f2",
    color: "#c0392b",
    fontWeight: 700,
    fontSize: 14,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  rankName: {
    flex: 1,
    minWidth: 0,
    fontWeight: 600,
    color: "#0f172a",
  },
  rankQty: {
    flexShrink: 0,
    fontSize: 14,
    color: "#64748b",
    fontWeight: 500,
  },
};
