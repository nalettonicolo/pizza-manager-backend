import { useState } from "react";
import AdminModuleShell from "@/features/admin/components/AdminModuleShell";
import { useTenantLocalJson, newLocalId } from "@/features/admin/hooks/useTenantLocalJson";

export default function PagamentiFatturePage() {
  const { data, setData, ready } = useTenantLocalJson("contabilita_pagamenti", { righe: [] });

  const [fatturaNumero, setFatturaNumero] = useState("");
  const [scadenza, setScadenza] = useState(() => new Date().toISOString().slice(0, 10));
  const [tipoPagamento, setTipoPagamento] = useState("bonifico");
  const [pagato, setPagato] = useState(false);
  const [note, setNote] = useState("");

  if (!ready) {
    return <p className="text-gray-400 text-sm">Caricamento…</p>;
  }

  function add() {
    if (!fatturaNumero.trim()) return;
    const row = {
      id: newLocalId(),
      fatturaNumero: fatturaNumero.trim(),
      scadenza,
      tipoPagamento,
      pagato,
      note: note.trim(),
    };
    setData((d) => ({ ...d, righe: [row, ...d.righe] }));
    setFatturaNumero("");
    setNote("");
    setPagato(false);
  }

  function togglePagato(id) {
    setData((d) => ({
      ...d,
      righe: d.righe.map((r) => (r.id === id ? { ...r, pagato: !r.pagato } : r)),
    }));
  }

  function remove(id) {
    setData((d) => ({ ...d, righe: d.righe.filter((r) => r.id !== id) }));
  }

  return (
    <AdminModuleShell
      title="Pagamenti fatture"
      lead="Scadenze, modalità di pagamento e controllo stato pagato (sì/no)."
      specTitle="Campi previsti"
      specChildren={
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          <li>Data scadenza / termine pagamento</li>
          <li>Tipo pagamento (bonifico, RID, contanti, carta, altro)</li>
          <li>Flag di controllo «pagato» aggiornabile in un clic</li>
        </ul>
      }
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: 10,
          marginBottom: 20,
          alignItems: "end",
        }}
      >
        <div>
          <label style={{ fontSize: 12, color: "#64748b" }}>Riferimento n. fattura</label>
          <input
            value={fatturaNumero}
            onChange={(e) => setFatturaNumero(e.target.value)}
            style={{ width: "100%", marginTop: 4, padding: 8, borderRadius: 6, border: "1px solid #cbd5e1" }}
          />
        </div>
        <div>
          <label style={{ fontSize: 12, color: "#64748b" }}>Scadenza</label>
          <input
            type="date"
            value={scadenza}
            onChange={(e) => setScadenza(e.target.value)}
            style={{ width: "100%", marginTop: 4, padding: 8, borderRadius: 6, border: "1px solid #cbd5e1" }}
          />
        </div>
        <div>
          <label style={{ fontSize: 12, color: "#64748b" }}>Tipo pagamento</label>
          <select
            value={tipoPagamento}
            onChange={(e) => setTipoPagamento(e.target.value)}
            style={{ width: "100%", marginTop: 4, padding: 8, borderRadius: 6, border: "1px solid #cbd5e1" }}
          >
            <option value="bonifico">Bonifico</option>
            <option value="rid">RID / addebito</option>
            <option value="contanti">Contanti</option>
            <option value="carta">Carta / POS</option>
            <option value="altro">Altro</option>
          </select>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, paddingTop: 20 }}>
          <input id="pagato-new" type="checkbox" checked={pagato} onChange={(e) => setPagato(e.target.checked)} />
          <label htmlFor="pagato-new" style={{ fontSize: 14, cursor: "pointer" }}>
            Segna come già pagata
          </label>
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
          Aggiungi scadenza
        </button>
      </div>

      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
        <thead>
          <tr style={{ textAlign: "left", borderBottom: "2px solid #e2e8f0", color: "#64748b" }}>
            <th style={{ padding: "10px 8px" }}>Fattura</th>
            <th style={{ padding: "10px 8px" }}>Scadenza</th>
            <th style={{ padding: "10px 8px" }}>Tipo</th>
            <th style={{ padding: "10px 8px" }}>Pagato</th>
            <th style={{ padding: "10px 8px" }} />
          </tr>
        </thead>
        <tbody>
          {data.righe.map((r) => (
            <tr key={r.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
              <td style={{ padding: "10px 8px", fontWeight: 600 }}>{r.fatturaNumero}</td>
              <td style={{ padding: "10px 8px" }}>{r.scadenza}</td>
              <td style={{ padding: "10px 8px" }}>{r.tipoPagamento}</td>
              <td style={{ padding: "10px 8px" }}>
                <button
                  type="button"
                  onClick={() => togglePagato(r.id)}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 6,
                    border: "1px solid #cbd5e1",
                    background: r.pagato ? "#dcfce7" : "#fef3c7",
                    cursor: "pointer",
                    fontSize: 13,
                  }}
                >
                  {r.pagato ? "Pagato" : "Da pagare"}
                </button>
              </td>
              <td style={{ padding: "10px 8px" }}>
                <button type="button" style={{ color: "#b91c1c", border: "none", background: "none", cursor: "pointer" }} onClick={() => remove(r.id)}>
                  Elimina
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {data.righe.length === 0 ? (
        <p style={{ padding: 16, color: "#94a3b8", fontSize: 14 }}>Nessun pagamento programmato.</p>
      ) : null}
    </AdminModuleShell>
  );
}
