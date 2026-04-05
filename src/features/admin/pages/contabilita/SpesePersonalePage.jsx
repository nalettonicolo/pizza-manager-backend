import { useState } from "react";
import AdminModuleShell from "@/features/admin/components/AdminModuleShell";
import { useTenantLocalJson, newLocalId } from "@/features/admin/hooks/useTenantLocalJson";

const CATEGORIE = [
  { value: "stipendio", label: "Stipendi" },
  { value: "f24", label: "F24 / oneri" },
  { value: "formazione", label: "Formazione" },
  { value: "altro", label: "Altro personale" },
];

export default function SpesePersonalePage() {
  const { data, setData, ready } = useTenantLocalJson("contabilita_spese_personale", { spese: [] });
  const [dataSpesa, setDataSpesa] = useState(() => new Date().toISOString().slice(0, 10));
  const [categoria, setCategoria] = useState("stipendio");
  const [importo, setImporto] = useState("");
  const [note, setNote] = useState("");

  if (!ready) {
    return <p className="text-gray-400 text-sm">Caricamento…</p>;
  }

  function add() {
    const imp = Number(importo);
    if (!imp || imp <= 0) return;
    const row = {
      id: newLocalId(),
      data: dataSpesa,
      categoria,
      importo: imp,
      note: note.trim(),
    };
    setData((d) => ({ ...d, spese: [row, ...d.spese] }));
    setImporto("");
    setNote("");
  }

  function remove(id) {
    setData((d) => ({ ...d, spese: d.spese.filter((x) => x.id !== id) }));
  }

  const totale = data.spese.reduce((s, x) => s + x.importo, 0);

  return (
    <AdminModuleShell
      title="Spese gestione personale"
      lead="Costi legati al personale: stipendi, adempimenti fiscali (es. F24), corsi e altro."
      specTitle="Voci tipiche"
      specChildren={
        <p style={{ margin: 0 }}>Compensi, contributi, trattenute, formazione obbligatoria o specialistica.</p>
      }
    >
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
          <label style={{ fontSize: 12, color: "#64748b" }}>Data</label>
          <input
            type="date"
            value={dataSpesa}
            onChange={(e) => setDataSpesa(e.target.value)}
            style={{ width: "100%", marginTop: 4, padding: 8, borderRadius: 6, border: "1px solid #cbd5e1" }}
          />
        </div>
        <div>
          <label style={{ fontSize: 12, color: "#64748b" }}>Categoria</label>
          <select
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
            style={{ width: "100%", marginTop: 4, padding: 8, borderRadius: 6, border: "1px solid #cbd5e1" }}
          >
            {CATEGORIE.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
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
          <label style={{ fontSize: 12, color: "#64748b" }}>Note</label>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            style={{ width: "100%", marginTop: 4, padding: 8, borderRadius: 6, border: "1px solid #cbd5e1" }}
          />
        </div>
        <button type="button" className="btn-primary" onClick={add}>
          Registra spesa
        </button>
      </div>

      <p style={{ fontSize: 15, fontWeight: 600, marginBottom: 12, color: "#0f172a" }}>
        Totale registrato: € {totale.toFixed(2)}
      </p>

      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
        <thead>
          <tr style={{ textAlign: "left", borderBottom: "2px solid #e2e8f0", color: "#64748b" }}>
            <th style={{ padding: "10px 8px" }}>Data</th>
            <th style={{ padding: "10px 8px" }}>Categoria</th>
            <th style={{ padding: "10px 8px" }}>Importo</th>
            <th style={{ padding: "10px 8px" }}>Note</th>
            <th style={{ padding: "10px 8px" }} />
          </tr>
        </thead>
        <tbody>
          {data.spese.map((r) => (
            <tr key={r.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
              <td style={{ padding: "10px 8px" }}>{r.data}</td>
              <td style={{ padding: "10px 8px" }}>{CATEGORIE.find((c) => c.value === r.categoria)?.label ?? r.categoria}</td>
              <td style={{ padding: "10px 8px" }}>€ {r.importo.toFixed(2)}</td>
              <td style={{ padding: "10px 8px", color: "#64748b" }}>{r.note || "—"}</td>
              <td style={{ padding: "10px 8px" }}>
                <button type="button" style={{ color: "#b91c1c", border: "none", background: "none", cursor: "pointer" }} onClick={() => remove(r.id)}>
                  Elimina
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {data.spese.length === 0 ? (
        <p style={{ padding: 16, color: "#94a3b8", fontSize: 14 }}>Nessuna spesa personale.</p>
      ) : null}
    </AdminModuleShell>
  );
}
