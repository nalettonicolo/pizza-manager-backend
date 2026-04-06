import { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import AdminModuleShell from "@/features/admin/components/AdminModuleShell";
import { useTenantLocalJson, newLocalId } from "@/features/admin/hooks/useTenantLocalJson";
import { useTenant } from "@/app/contexts/TenantContext";
import {
  getOrders,
  contabilitaMovimentiTableReachable,
  listContabilitaMovimenti,
  insertContabilitaMovimento,
  deleteContabilitaMovimento,
} from "@/features/admin/services/adminService";
import { aggregateIncassiDaOrdini } from "@/utils/incassiFromOrdini";

function mapDbRowToUi(row) {
  return {
    id: row.id,
    data: row.data_mov,
    descrizione: row.descrizione || "",
    importo: Number(row.importo),
    tipo: row.tipo,
  };
}

export default function GestioneIncassiPage() {
  const { tenantId } = useTenant();
  const { data, setData, ready: localReady, storageKey } = useTenantLocalJson("contabilita_incassi", { movimenti: [] });
  const [dataMov, setDataMov] = useState(() => new Date().toISOString().slice(0, 10));
  const [descrizione, setDescrizione] = useState("");
  const [importo, setImporto] = useState("");
  const [tipo, setTipo] = useState("contanti");
  const [ordiniOggi, setOrdiniOggi] = useState([]);
  const [ordiniHintLoading, setOrdiniHintLoading] = useState(false);
  const [ordiniHintErr, setOrdiniHintErr] = useState(null);

  const [movimenti, setMovimenti] = useState([]);
  const [storageBackend, setStorageBackend] = useState(null);
  const [storageProbeDone, setStorageProbeDone] = useState(false);
  const [storageLoadErr, setStorageLoadErr] = useState(null);
  const probedRef = useRef(false);

  useEffect(() => {
    probedRef.current = false;
    setStorageProbeDone(false);
    setStorageBackend(null);
    setMovimenti([]);
  }, [tenantId]);

  useEffect(() => {
    if (!tenantId || !localReady || probedRef.current) return;
    probedRef.current = true;
    let cancelled = false;
    setStorageLoadErr(null);
    (async () => {
      try {
        const dbOk = await contabilitaMovimentiTableReachable(tenantId);
        if (cancelled) return;
        if (dbOk) {
          const rows = await listContabilitaMovimenti(tenantId);
          if (cancelled) return;
          setMovimenti(rows.map(mapDbRowToUi));
          setStorageBackend("db");
        } else {
          setMovimenti(data.movimenti || []);
          setStorageBackend("local");
        }
      } catch (e) {
        if (!cancelled) {
          setStorageLoadErr(e?.message || "Errore storage");
          setMovimenti(data.movimenti || []);
          setStorageBackend("local");
        }
      } finally {
        if (!cancelled) setStorageProbeDone(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tenantId, localReady, data.movimenti]);

  useEffect(() => {
    if (storageBackend !== "local") return;
    setMovimenti(data.movimenti || []);
  }, [storageBackend, data.movimenti]);

  useEffect(() => {
    if (!tenantId) return;
    let cancelled = false;
    setOrdiniHintLoading(true);
    setOrdiniHintErr(null);
    getOrders(tenantId, { todayOnly: true, limit: 200 })
      .then((list) => {
        if (!cancelled) setOrdiniOggi(Array.isArray(list) ? list : []);
      })
      .catch((e) => {
        if (!cancelled) {
          setOrdiniHintErr(e?.message || "Errore caricamento ordini");
          setOrdiniOggi([]);
        }
      })
      .finally(() => {
        if (!cancelled) setOrdiniHintLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tenantId]);

  const totali = useMemo(() => {
    let contanti = 0;
    let elettronico = 0;
    for (const m of movimenti || []) {
      if (m.tipo === "contanti") contanti += m.importo;
      else elettronico += m.importo;
    }
    return { contanti, elettronico, totale: contanti + elettronico };
  }, [movimenti]);

  const suggerimentoOrdini = useMemo(() => aggregateIncassiDaOrdini(ordiniOggi), [ordiniOggi]);

  const add = useCallback(async () => {
    const imp = Number(importo);
    if (!imp || imp <= 0 || !tenantId) return;
    const row = {
      id: newLocalId(),
      data: dataMov,
      descrizione: descrizione.trim() || "Incasso",
      importo: imp,
      tipo,
    };
    if (storageBackend === "db") {
      try {
        const inserted = await insertContabilitaMovimento(tenantId, row);
        setMovimenti((prev) => [{ id: inserted.id, data: inserted.data_mov, descrizione: inserted.descrizione, importo: Number(inserted.importo), tipo: inserted.tipo }, ...prev]);
      } catch (e) {
        alert("Salvataggio database non riuscito. " + (e?.message || ""));
        return;
      }
    } else {
      setData((d) => ({ ...d, movimenti: [row, ...d.movimenti] }));
    }
    setDescrizione("");
    setImporto("");
  }, [importo, tenantId, dataMov, descrizione, tipo, storageBackend, setData]);

  const remove = useCallback(
    async (id) => {
      if (storageBackend === "db") {
        try {
          await deleteContabilitaMovimento(id);
          setMovimenti((prev) => prev.filter((x) => x.id !== id));
        } catch (e) {
          alert("Eliminazione non riuscita. " + (e?.message || ""));
        }
      } else {
        setData((d) => ({ ...d, movimenti: d.movimenti.filter((x) => x.id !== id) }));
      }
    },
    [storageBackend, setData],
  );

  if (!localReady || !storageProbeDone) {
    return <p className="text-gray-400 text-sm">Caricamento…</p>;
  }

  return (
    <AdminModuleShell
      title="Gestione incassi"
      lead="Registro manuale degli incassi (contanti ed elettronico). Con il database aggiornato (sql_upgrade.sql) i movimenti si salvano su Supabase; altrimenti restano nel browser (localStorage)."
      specTitle="Ambito"
      specChildren={
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          <li>Utile per versamenti, riepiloghi e riconciliazioni non ancora collegate al POS.</li>
          <li>
            Report vendite: <Link to="/admin/report">Admin → Report</Link>.
          </li>
          <li>
            Il riquadro «Da ordini oggi» legge solo gli ordini in database: non richiede moduli a pagamento.
          </li>
        </ul>
      }
    >
      {storageLoadErr ? (
        <p style={{ marginBottom: 12, fontSize: 13, color: "#b45309" }}>
          Storage database non usato ({storageLoadErr}); uso localStorage{storageKey ? ` (${storageKey})` : ""}.
        </p>
      ) : null}
      <div
        style={{
          marginBottom: 16,
          padding: 10,
          borderRadius: 8,
          fontSize: 13,
          background: storageBackend === "db" ? "#ecfdf5" : "#f8fafc",
          border: storageBackend === "db" ? "1px solid #6ee7b7" : "1px solid #e2e8f0",
          color: "#334155",
        }}
      >
        {storageBackend === "db" ? (
          <strong>Persistenza: database Supabase (tabella contabilita_movimenti).</strong>
        ) : (
          <strong>Persistenza: solo questo browser (localStorage). Esegui sql/sql_upgrade.sql su Supabase per attivare il DB.</strong>
        )}
      </div>

      <div
        style={{
          marginBottom: 20,
          padding: 14,
          borderRadius: 8,
          border: "1px solid #bae6fd",
          background: "#f0f9ff",
          fontSize: 14,
          color: "#0c4a6e",
        }}
      >
        <strong style={{ display: "block", marginBottom: 8 }}>Da ordini di oggi (non annullati)</strong>
        {ordiniHintLoading ? (
          <span style={{ color: "#64748b" }}>Caricamento…</span>
        ) : ordiniHintErr ? (
          <span style={{ color: "#b91c1c" }}>{ordiniHintErr}</span>
        ) : (
          <>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginBottom: 8 }}>
              <span>
                <strong>Totale venduto</strong>: € {suggerimentoOrdini.totale.toFixed(2)}
              </span>
              <span style={{ color: "#64748b" }}>
                {suggerimentoOrdini.count} ordini attivi
                {suggerimentoOrdini.annullatiCount > 0
                  ? ` · ${suggerimentoOrdini.annullatiCount} annullati (esclusi)`
                  : ""}
              </span>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, fontSize: 13 }}>
              {Object.keys(suggerimentoOrdini.byTipo)
                .sort()
                .map((k) => (
                  <span key={k}>
                    {k}: € {(suggerimentoOrdini.byTipo[k] || 0).toFixed(2)}
                  </span>
                ))}
            </div>
            <p style={{ margin: "10px 0 0", fontSize: 12, color: "#64748b", lineHeight: 1.5 }}>
              Suggerimento per incrociare con i movimenti manuali sotto; i totali reali restano quelli che registri qui o in cassa.
            </p>
          </>
        )}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          gap: 10,
          marginBottom: 20,
          alignItems: "end",
        }}
      >
        <div>
          <label style={{ fontSize: 12, color: "#64748b" }}>Data</label>
          <input
            type="date"
            value={dataMov}
            onChange={(e) => setDataMov(e.target.value)}
            style={{ width: "100%", marginTop: 4, padding: 8, borderRadius: 6, border: "1px solid #cbd5e1" }}
          />
        </div>
        <div>
          <label style={{ fontSize: 12, color: "#64748b" }}>Tipo</label>
          <select
            value={tipo}
            onChange={(e) => setTipo(e.target.value)}
            style={{ width: "100%", marginTop: 4, padding: 8, borderRadius: 6, border: "1px solid #cbd5e1" }}
          >
            <option value="contanti">Contanti</option>
            <option value="elettronico">Elettronico (POS / bonifici entrata)</option>
          </select>
        </div>
        <div>
          <label style={{ fontSize: 12, color: "#64748b" }}>Importo €</label>
          <input
            type="number"
            step="0.01"
            value={importo}
            onChange={(e) => setImporto(e.target.value)}
            style={{ width: "100%", marginTop: 4, padding: 8, borderRadius: 6, border: "1px solid #cbd5e1" }}
          />
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <label style={{ fontSize: 12, color: "#64748b" }}>Descrizione</label>
          <input
            value={descrizione}
            onChange={(e) => setDescrizione(e.target.value)}
            style={{ width: "100%", marginTop: 4, padding: 8, borderRadius: 6, border: "1px solid #cbd5e1" }}
          />
        </div>
        <button type="button" className="btn-primary" onClick={() => void add()}>
          Registra incasso
        </button>
      </div>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 16,
          marginBottom: 20,
          fontSize: 14,
          color: "#334155",
        }}
      >
        <span>
          <strong>Contanti:</strong> € {totali.contanti.toFixed(2)}
        </span>
        <span>
          <strong>Elettronico:</strong> € {totali.elettronico.toFixed(2)}
        </span>
        <span>
          <strong>Totale:</strong> € {totali.totale.toFixed(2)}
        </span>
      </div>

      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
        <thead>
          <tr style={{ textAlign: "left", borderBottom: "2px solid #e2e8f0", color: "#64748b" }}>
            <th style={{ padding: "10px 8px" }}>Data</th>
            <th style={{ padding: "10px 8px" }}>Descrizione</th>
            <th style={{ padding: "10px 8px" }}>Tipo</th>
            <th style={{ padding: "10px 8px" }}>Importo</th>
            <th style={{ padding: "10px 8px" }} />
          </tr>
        </thead>
        <tbody>
          {movimenti.map((r) => (
            <tr key={r.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
              <td style={{ padding: "10px 8px" }}>{r.data}</td>
              <td style={{ padding: "10px 8px" }}>{r.descrizione}</td>
              <td style={{ padding: "10px 8px" }}>{r.tipo === "contanti" ? "Contanti" : "Elettronico"}</td>
              <td style={{ padding: "10px 8px" }}>€ {r.importo.toFixed(2)}</td>
              <td style={{ padding: "10px 8px" }}>
                <button
                  type="button"
                  style={{ color: "#b91c1c", border: "none", background: "none", cursor: "pointer" }}
                  onClick={() => void remove(r.id)}
                >
                  Elimina
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {movimenti.length === 0 ? (
        <p style={{ padding: 16, color: "#94a3b8", fontSize: 14 }}>Nessun movimento manuale.</p>
      ) : null}
    </AdminModuleShell>
  );
}
