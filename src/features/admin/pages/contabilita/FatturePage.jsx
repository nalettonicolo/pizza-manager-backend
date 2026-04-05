import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import AdminModuleShell from "@/features/admin/components/AdminModuleShell";
import { useTenantLocalJson, newLocalId } from "@/features/admin/hooks/useTenantLocalJson";

export default function FatturePage() {
  const { data: ddt } = useTenantLocalJson("magazzino_ddt", { righe: [] });
  const { data, setData, ready } = useTenantLocalJson("contabilita_fatture", { fatture: [] });

  const [numero, setNumero] = useState("");
  const [dataFatt, setDataFatt] = useState(() => new Date().toISOString().slice(0, 10));
  const [fornitore, setFornitore] = useState("");
  const [riferimentoDdt, setRiferimentoDdt] = useState("");
  const [importo, setImporto] = useState("");
  const [note, setNote] = useState("");

  const ddtNumeri = useMemo(() => ddt.righe.map((r) => r.numero).filter(Boolean), [ddt.righe]);

  if (!ready) {
    return <p className="text-gray-400 text-sm">Caricamento…</p>;
  }

  function add() {
    if (!numero.trim()) return;
    const row = {
      id: newLocalId(),
      numero: numero.trim(),
      data: dataFatt,
      fornitore: fornitore.trim(),
      riferimentoDdt: riferimentoDdt.trim(),
      importo: Number(importo) || 0,
      note: note.trim(),
    };
    setData((d) => ({ ...d, fatture: [row, ...d.fatture] }));
    setNumero("");
    setImporto("");
    setNote("");
  }

  function remove(id) {
    setData((d) => ({ ...d, fatture: d.fatture.filter((x) => x.id !== id) }));
  }

  return (
    <AdminModuleShell
      title="Fatture"
      lead="Registro fatture passive collegabili ai DDT registrati in magazzino."
      specTitle="Collegamento DDT"
      specChildren={
        <p style={{ margin: 0 }}>
          Usa lo stesso identificativo del DDT nel campo riferimento, oppure scegli dalla lista se hai già caricato i DDT in{" "}
          <Link to="/admin/magazzino/ddt">Magazzino</Link>.
        </p>
      }
    >
      <div style={{ marginBottom: 16 }}>
        <label style={{ fontSize: 12, color: "#64748b", display: "block", marginBottom: 4 }}>Suggerimenti DDT</label>
        <select
          value=""
          onChange={(e) => e.target.value && setRiferimentoDdt(e.target.value)}
          style={{ maxWidth: 320, padding: 8, borderRadius: 6, border: "1px solid #cbd5e1" }}
        >
          <option value="">— Seleziona DDT esistente —</option>
          {ddtNumeri.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          gap: 10,
          marginBottom: 16,
          alignItems: "end",
        }}
      >
        <div>
          <label style={{ fontSize: 12, color: "#64748b" }}>Numero fattura</label>
          <input
            value={numero}
            onChange={(e) => setNumero(e.target.value)}
            style={{ width: "100%", marginTop: 4, padding: 8, borderRadius: 6, border: "1px solid #cbd5e1" }}
          />
        </div>
        <div>
          <label style={{ fontSize: 12, color: "#64748b" }}>Data</label>
          <input
            type="date"
            value={dataFatt}
            onChange={(e) => setDataFatt(e.target.value)}
            style={{ width: "100%", marginTop: 4, padding: 8, borderRadius: 6, border: "1px solid #cbd5e1" }}
          />
        </div>
        <div>
          <label style={{ fontSize: 12, color: "#64748b" }}>Fornitore</label>
          <input
            value={fornitore}
            onChange={(e) => setFornitore(e.target.value)}
            style={{ width: "100%", marginTop: 4, padding: 8, borderRadius: 6, border: "1px solid #cbd5e1" }}
          />
        </div>
        <div>
          <label style={{ fontSize: 12, color: "#64748b" }}>Rif. DDT</label>
          <input
            value={riferimentoDdt}
            onChange={(e) => setRiferimentoDdt(e.target.value)}
            placeholder="es. numero DDT"
            style={{ width: "100%", marginTop: 4, padding: 8, borderRadius: 6, border: "1px solid #cbd5e1" }}
          />
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
          <label style={{ fontSize: 12, color: "#64748b" }}>Note</label>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            style={{ width: "100%", marginTop: 4, padding: 8, borderRadius: 6, border: "1px solid #cbd5e1" }}
          />
        </div>
        <button type="button" className="btn-primary" onClick={add}>
          Aggiungi fattura
        </button>
      </div>

      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
        <thead>
          <tr style={{ textAlign: "left", borderBottom: "2px solid #e2e8f0", color: "#64748b" }}>
            <th style={{ padding: "10px 8px" }}>N.</th>
            <th style={{ padding: "10px 8px" }}>Data</th>
            <th style={{ padding: "10px 8px" }}>Fornitore</th>
            <th style={{ padding: "10px 8px" }}>DDT</th>
            <th style={{ padding: "10px 8px" }}>Importo</th>
            <th style={{ padding: "10px 8px" }} />
          </tr>
        </thead>
        <tbody>
          {data.fatture.map((r) => (
            <tr key={r.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
              <td style={{ padding: "10px 8px", fontWeight: 600 }}>{r.numero}</td>
              <td style={{ padding: "10px 8px" }}>{r.data}</td>
              <td style={{ padding: "10px 8px" }}>{r.fornitore || "—"}</td>
              <td style={{ padding: "10px 8px" }}>{r.riferimentoDdt || "—"}</td>
              <td style={{ padding: "10px 8px" }}>€ {Number(r.importo).toFixed(2)}</td>
              <td style={{ padding: "10px 8px" }}>
                <button type="button" style={{ color: "#b91c1c", border: "none", background: "none", cursor: "pointer" }} onClick={() => remove(r.id)}>
                  Elimina
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {data.fatture.length === 0 ? (
        <p style={{ padding: 16, color: "#94a3b8", fontSize: 14 }}>Nessuna fattura.</p>
      ) : null}
    </AdminModuleShell>
  );
}
