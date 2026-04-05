import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import AdminModuleShell from "@/features/admin/components/AdminModuleShell";
import { useTenantLocalJson, newLocalId } from "@/features/admin/hooks/useTenantLocalJson";

export default function GestioneIncassiPage() {
  const { data, setData, ready } = useTenantLocalJson("contabilita_incassi", { movimenti: [] });
  const [dataMov, setDataMov] = useState(() => new Date().toISOString().slice(0, 10));
  const [descrizione, setDescrizione] = useState("");
  const [importo, setImporto] = useState("");
  const [tipo, setTipo] = useState("contanti");

  const totali = useMemo(() => {
    let contanti = 0;
    let elettronico = 0;
    for (const m of data.movimenti || []) {
      if (m.tipo === "contanti") contanti += m.importo;
      else elettronico += m.importo;
    }
    return { contanti, elettronico, totale: contanti + elettronico };
  }, [data.movimenti]);

  if (!ready) {
    return <p className="text-gray-400 text-sm">Caricamento…</p>;
  }

  function add() {
    const imp = Number(importo);
    if (!imp || imp <= 0) return;
    const row = {
      id: newLocalId(),
      data: dataMov,
      descrizione: descrizione.trim() || "Incasso",
      importo: imp,
      tipo,
    };
    setData((d) => ({ ...d, movimenti: [row, ...d.movimenti] }));
    setDescrizione("");
    setImporto("");
  }

  function remove(id) {
    setData((d) => ({ ...d, movimenti: d.movimenti.filter((x) => x.id !== id) }));
  }

  return (
    <AdminModuleShell
      title="Gestione incassi"
      lead="Registro manuale degli incassi (contanti ed elettronico). Per il dettaglio vendite giornaliere continua a usare la Cassa e i Report."
      specTitle="Ambito"
      specChildren={
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          <li>Utile per versamenti, riepiloghi e riconciliazioni non ancora collegate al POS.</li>
          <li>
            Report vendite: <Link to="/admin/report">Admin → Report</Link>.
          </li>
        </ul>
      }
    >
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
        <button type="button" className="btn-primary" onClick={add}>
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
          {data.movimenti.map((r) => (
            <tr key={r.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
              <td style={{ padding: "10px 8px" }}>{r.data}</td>
              <td style={{ padding: "10px 8px" }}>{r.descrizione}</td>
              <td style={{ padding: "10px 8px" }}>{r.tipo === "contanti" ? "Contanti" : "Elettronico"}</td>
              <td style={{ padding: "10px 8px" }}>€ {r.importo.toFixed(2)}</td>
              <td style={{ padding: "10px 8px" }}>
                <button type="button" style={{ color: "#b91c1c", border: "none", background: "none", cursor: "pointer" }} onClick={() => remove(r.id)}>
                  Elimina
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {data.movimenti.length === 0 ? (
        <p style={{ padding: 16, color: "#94a3b8", fontSize: 14 }}>Nessun movimento manuale.</p>
      ) : null}
    </AdminModuleShell>
  );
}
