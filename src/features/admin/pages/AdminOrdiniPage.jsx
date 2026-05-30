import { useCallback, useEffect, useMemo, useState } from "react";

import { useAuth } from "@/app/contexts/AuthContext";
import { useTenant } from "@/app/contexts/TenantContext";
import Loader from "@/components/feedback/Loader";
import ErrorState from "@/components/feedback/ErrorState";
import OrderDetailModal from "@/features/operative/components/OrderDetailModal";
import {
  getOrderDetail,
  getOrders,
  getProducts,
} from "@/features/admin/services/adminService";
import {
  ordineIndirizzoConsegna,
  ordineIsDelivery,
  ordineNomeCliente,
  ordineTipoOrdine,
} from "@/features/operative/cassa/utils/ordineFieldHelpers";
import { formatPrice } from "@/utils/format";

const STATI_ORDINE = [
  { value: "", label: "Tutti gli stati" },
  { value: "IN_ATTESA", label: "In attesa" },
  { value: "IN_PREPARAZIONE", label: "In preparazione" },
  { value: "PRONTO", label: "Pronto" },
  { value: "CONSEGNATO", label: "Consegnato" },
  { value: "ANNULLATO", label: "Annullato" },
];

const TIPI_ORDINE = [
  { value: "", label: "Tutti i tipi" },
  { value: "negozio", label: "Ritiro in negozio" },
  { value: "delivery", label: "Consegna" },
];

function statoLabel(stato) {
  const key = String(stato ?? "").trim().toUpperCase();
  return STATI_ORDINE.find((s) => s.value === key)?.label ?? (key || "—");
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function ordineCreatedAt(o) {
  return o?.createdAt ?? o?.created_at ?? null;
}

function ordineNumero(o) {
  return o?.numero ?? o?.numero_ordine ?? "—";
}

function ordineTotale(o) {
  return Number(o?.totale ?? o?.total ?? 0);
}

function ordineStato(o) {
  return String(o?.stato ?? "").trim().toUpperCase();
}

function isAnnullato(o) {
  return ordineStato(o) === "ANNULLATO";
}

export default function AdminOrdiniPage() {
  const { tenantId } = useTenant();
  const { loading: authLoading } = useAuth();

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statoFilter, setStatoFilter] = useState("");
  const [tipoFilter, setTipoFilter] = useState("");
  const [search, setSearch] = useState("");
  const [periodMode, setPeriodMode] = useState("today");
  const [dateFrom, setDateFrom] = useState(todayIsoDate);
  const [dateTo, setDateTo] = useState(todayIsoDate);

  const [detailOrder, setDetailOrder] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const loadOrders = useCallback(async () => {
    if (!tenantId) {
      setLoading(false);
      setOrders([]);
      setError("Nessun tenant associato all’account: impossibile caricare gli ordini.");
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const opts =
        periodMode === "today"
          ? { todayOnly: true, limit: 200 }
          : {
              fromDate: `${dateFrom}T00:00:00.000`,
              toDate: `${dateTo}T23:59:59.999`,
              limit: 200,
            };
      if (statoFilter) opts.stato = statoFilter;
      const rows = await getOrders(tenantId, opts);
      setOrders(Array.isArray(rows) ? rows : []);
    } catch (err) {
      console.error(err);
      setError("Errore nel caricamento degli ordini.");
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [tenantId, periodMode, dateFrom, dateTo, statoFilter]);

  useEffect(() => {
    if (authLoading) return;
    void loadOrders();
  }, [authLoading, loadOrders]);

  const filteredOrders = useMemo(() => {
    const q = search.trim().toLowerCase();
    return orders.filter((o) => {
      if (tipoFilter && ordineTipoOrdine(o) !== tipoFilter) return false;
      if (!q) return true;
      const num = String(ordineNumero(o)).toLowerCase();
      const nome = ordineNomeCliente(o).toLowerCase();
      const indirizzo = ordineIndirizzoConsegna(o).toLowerCase();
      return num.includes(q) || nome.includes(q) || indirizzo.includes(q);
    });
  }, [orders, tipoFilter, search]);

  const kpi = useMemo(() => {
    const attivi = filteredOrders.filter((o) => !isAnnullato(o));
    const fatturato = attivi.reduce((sum, o) => sum + ordineTotale(o), 0);
    return {
      totale: filteredOrders.length,
      attivi: attivi.length,
      annullati: filteredOrders.length - attivi.length,
      fatturato,
    };
  }, [filteredOrders]);

  const openDetail = async (ordineId) => {
    if (!ordineId || !tenantId) return;
    setDetailLoading(true);
    setDetailOrder({});
    try {
      const [detail, prodotti] = await Promise.all([
        getOrderDetail(ordineId),
        getProducts(tenantId),
      ]);
      const productNames = (prodotti || []).reduce(
        (acc, p) => ({ ...acc, [p.id]: p.nome || "—" }),
        {},
      );
      setDetailOrder({ ...detail, productNames });
    } catch (e) {
      console.error(e);
      setDetailOrder(null);
    } finally {
      setDetailLoading(false);
    }
  };

  if (authLoading || loading) return <Loader />;
  if (error) return <ErrorState message={error} />;

  return (
    <div style={styles.wrapper}>
      <div style={styles.headerRow}>
        <h1 style={styles.pageTitle}>Ordini</h1>
        <button type="button" className="btn-primary-dashboard" onClick={() => void loadOrders()}>
          Aggiorna
        </button>
      </div>

      <p style={styles.hint}>
        Elenco ordini del locale in tempo quasi reale (aggiorna manualmente o cambia filtri). Per analisi
        aggregate e classifica prodotti usa <strong>Report</strong>.
      </p>

      <div style={styles.kpiRow}>
        <div style={styles.kpiCard}>
          <span style={styles.kpiLabel}>Ordini nel periodo</span>
          <strong style={styles.kpiValue}>{kpi.totale}</strong>
        </div>
        <div style={styles.kpiCard}>
          <span style={styles.kpiLabel}>Attivi (non annullati)</span>
          <strong style={styles.kpiValue}>{kpi.attivi}</strong>
        </div>
        <div style={styles.kpiCard}>
          <span style={styles.kpiLabel}>Fatturato attivi</span>
          <strong style={styles.kpiValue}>{formatPrice(kpi.fatturato, "0.00")} €</strong>
        </div>
        {kpi.annullati > 0 ? (
          <div style={styles.kpiCard}>
            <span style={styles.kpiLabel}>Annullati</span>
            <strong style={styles.kpiValue}>{kpi.annullati}</strong>
          </div>
        ) : null}
      </div>

      <div style={styles.filtersRow}>
        <label style={styles.filterLabel}>
          Periodo
          <select
            value={periodMode}
            onChange={(e) => setPeriodMode(e.target.value)}
            style={styles.select}
          >
            <option value="today">Oggi</option>
            <option value="range">Intervallo date</option>
          </select>
        </label>
        {periodMode === "range" ? (
          <>
            <label style={styles.filterLabel}>
              Da
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                style={styles.dateInput}
              />
            </label>
            <label style={styles.filterLabel}>
              A
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                style={styles.dateInput}
              />
            </label>
          </>
        ) : null}
        <label style={styles.filterLabel}>
          Stato
          <select
            value={statoFilter}
            onChange={(e) => setStatoFilter(e.target.value)}
            style={styles.select}
          >
            {STATI_ORDINE.map((s) => (
              <option key={s.value || "all"} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <label style={styles.filterLabel}>
          Tipo
          <select
            value={tipoFilter}
            onChange={(e) => setTipoFilter(e.target.value)}
            style={styles.select}
          >
            {TIPI_ORDINE.map((t) => (
              <option key={t.value || "all"} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        <label style={{ ...styles.filterLabel, flex: 1, minWidth: 180 }}>
          Cerca
          <input
            type="search"
            placeholder="Numero, cliente, indirizzo…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={styles.searchInput}
          />
        </label>
      </div>

      {filteredOrders.length === 0 ? (
        <p style={styles.empty}>Nessun ordine corrisponde ai filtri selezionati.</p>
      ) : (
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>#</th>
                <th style={styles.th}>Ora</th>
                <th style={styles.th}>Cliente</th>
                <th style={styles.th}>Tipo</th>
                <th style={styles.th}>Stato</th>
                <th style={styles.thRight}>Totale</th>
                <th style={styles.th} aria-label="Azioni" />
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map((o) => {
                const created = ordineCreatedAt(o);
                const ora = created
                  ? new Date(created).toLocaleTimeString("it-IT", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "—";
                const annullato = isAnnullato(o);
                return (
                  <tr key={o.id} style={annullato ? styles.rowAnnullato : undefined}>
                    <td style={styles.td}>
                      <strong>{ordineNumero(o)}</strong>
                    </td>
                    <td style={styles.td}>{ora}</td>
                    <td style={styles.td}>
                      {ordineNomeCliente(o) || (ordineIsDelivery(o) ? ordineIndirizzoConsegna(o) : "—")}
                    </td>
                    <td style={styles.td}>
                      {ordineIsDelivery(o) ? "Consegna" : "Ritiro"}
                    </td>
                    <td style={styles.td}>
                      <span style={statoBadgeStyle(ordineStato(o))}>{statoLabel(o.stato)}</span>
                    </td>
                    <td style={styles.tdRight}>{formatPrice(ordineTotale(o), "0.00")} €</td>
                    <td style={styles.td}>
                      <button
                        type="button"
                        style={styles.detailBtn}
                        onClick={() => void openDetail(o.id)}
                      >
                        Dettaglio
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <OrderDetailModal
        order={detailOrder}
        loading={detailLoading}
        onClose={() => {
          setDetailOrder(null);
          setDetailLoading(false);
        }}
      />
    </div>
  );
}

function statoBadgeStyle(stato) {
  const base = {
    display: "inline-block",
    padding: "2px 8px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 600,
  };
  switch (stato) {
    case "IN_ATTESA":
      return { ...base, background: "#fef3c7", color: "#92400e" };
    case "IN_PREPARAZIONE":
      return { ...base, background: "#dbeafe", color: "#1e40af" };
    case "PRONTO":
      return { ...base, background: "#dcfce7", color: "#166534" };
    case "CONSEGNATO":
      return { ...base, background: "#e2e8f0", color: "#334155" };
    case "ANNULLATO":
      return { ...base, background: "#fee2e2", color: "#991b1b" };
    default:
      return { ...base, background: "#f1f5f9", color: "#475569" };
  }
}

const styles = {
  wrapper: {
    padding: "30px",
    display: "flex",
    flexDirection: "column",
    gap: 16,
    maxWidth: 1100,
  },
  headerRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
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
  kpiRow: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
    gap: 12,
  },
  kpiCard: {
    padding: "14px 16px",
    border: "1px solid #e2e8f0",
    borderRadius: 10,
    background: "#fff",
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  kpiLabel: {
    fontSize: 12,
    color: "#64748b",
  },
  kpiValue: {
    fontSize: "1.35rem",
    color: "#0f172a",
  },
  filtersRow: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "flex-end",
    gap: 12,
  },
  filterLabel: {
    display: "flex",
    flexDirection: "column",
    fontSize: 12,
    color: "#64748b",
    gap: 4,
  },
  select: {
    padding: "8px 10px",
    borderRadius: 8,
    border: "1px solid #cbd5e1",
    fontSize: 14,
    background: "#fff",
    minWidth: 140,
  },
  dateInput: {
    padding: "8px 10px",
    borderRadius: 8,
    border: "1px solid #cbd5e1",
    fontSize: 14,
  },
  searchInput: {
    padding: "8px 10px",
    borderRadius: 8,
    border: "1px solid #cbd5e1",
    fontSize: 14,
    width: "100%",
  },
  empty: {
    margin: 0,
    padding: "24px 0",
    color: "#64748b",
    fontSize: 14,
  },
  tableWrap: {
    overflowX: "auto",
    border: "1px solid #e2e8f0",
    borderRadius: 10,
    background: "#fff",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: 14,
  },
  th: {
    textAlign: "left",
    padding: "12px 14px",
    borderBottom: "1px solid #e2e8f0",
    color: "#64748b",
    fontWeight: 600,
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: "0.02em",
  },
  thRight: {
    textAlign: "right",
    padding: "12px 14px",
    borderBottom: "1px solid #e2e8f0",
    color: "#64748b",
    fontWeight: 600,
    fontSize: 12,
    textTransform: "uppercase",
  },
  td: {
    padding: "12px 14px",
    borderBottom: "1px solid #f1f5f9",
    verticalAlign: "middle",
    color: "#334155",
  },
  tdRight: {
    padding: "12px 14px",
    borderBottom: "1px solid #f1f5f9",
    textAlign: "right",
    fontVariantNumeric: "tabular-nums",
    color: "#334155",
  },
  rowAnnullato: {
    opacity: 0.65,
  },
  detailBtn: {
    padding: "6px 12px",
    fontSize: 13,
    fontWeight: 600,
    borderRadius: 8,
    border: "1px solid #cbd5e1",
    background: "#fff",
    color: "#334155",
    cursor: "pointer",
  },
};
