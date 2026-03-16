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

  /* =========================
     LOAD REPORT
  ========================= */

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

  /* =========================
     RENDER STATES
  ========================= */

  if (loading) return <Loader />;
  if (error) return <ErrorState message={error} />;
  if (!report) return null;

  /* =========================
     UI
  ========================= */

  return (
    <div style={styles.wrapper}>
      <h1>Report Vendite</h1>

      <div style={styles.card}>
        <h3>Totale Ordini</h3>
        <p>{report.totaleOrdini || 0}</p>
      </div>

      <div style={styles.card}>
        <h3>Fatturato</h3>
        <p>{formatPrice(report.fatturato, "0.00")} €</p>
      </div>

      <div style={styles.card}>
        <h3>Prodotto più venduto</h3>
        <p>{report.topProdotto || "-"}</p>
      </div>
    </div>
  );
}

/* =========================
   STYLES
========================= */

const styles = {
  wrapper: {
    padding: "30px",
    display: "flex",
    flexDirection: "column",
    gap: "20px",
  },
  card: {
    padding: "20px",
    border: "1px solid #ddd",
    borderRadius: "8px",
    background: "#fff",
  },
};
