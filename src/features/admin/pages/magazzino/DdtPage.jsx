import { useState } from "react";
import AdminModuleShell from "@/features/admin/components/AdminModuleShell";
import { newLocalId } from "@/features/admin/hooks/useTenantLocalJson";
import { useMagazzinoDdtStorage } from "@/features/admin/hooks/useMagazzinoDdtStorage";

export default function DdtPage() {
  const { righe, addRow: persistRow, removeRow, ready, backend, loadErr } = useMagazzinoDdtStorage();
  const [numero, setNumero] = useState("");
  const [dataDoc, setDataDoc] = useState(() => new Date().toISOString().slice(0, 10));
  const [fornitore, setFornitore] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  if (!ready) {
    return <p className="text-gray-400 text-sm">Caricamento…</p>;
  }

  async function addRow() {
    if (!numero.trim() || saving) return;
    const row = {
      id: newLocalId(),
      numero: numero.trim(),
      data: dataDoc,
      fornitore: fornitore.trim(),
      note: note.trim(),
    };
    setSaving(true);
    try {
      await persistRow(row);
      setNumero("");
      setNote("");
    } catch (e) {
      console.error(e);
      alert(e?.message || "Errore salvataggio DDT");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id) {
    try {
      await removeRow(id);
    } catch (e) {
      console.error(e);
      alert(e?.message || "Errore eliminazione");
    }
  }

  return (
    <AdminModuleShell
      title="DDT — Documenti di trasporto"
      lead="Registro DDT in entrata. In contabilità le fatture potranno richiamare questi documenti tramite numero/riferimento."
      specTitle="Collegamento fatture"
      specChildren={
        <p style={{ margin: 0 }}>
          Nella sezione <strong>Fatture</strong> indica lo stesso numero DDT (o un riferimento testuale) per tenere allineata la
          tracciabilità acquisti.
        </p>
      }
    >
      {backend === "db" ? (
        <p style={{ fontSize: 13, color: "#166534", margin: "0 0 12px" }} role="status">
          Dati salvati su Supabase (multi-dispositivo).
        </p>
      ) : (
        <p style={{ fontSize: 13, color: "#92400e", margin: "0 0 12px" }} role="status">
          Storage locale browser — esegui <code>sql/modules/14_magazzino_fornitori_ddt.sql</code> su Supabase per persistenza centralizzata.
        </p>
      )}
      {loadErr ? (
        <p style={{ fontSize: 13, color: "#b91c1c", margin: "0 0 12px" }} role="alert">
          {loadErr}
        </p>
      ) : null}

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
          <label style={{ fontSize: 12, color: "#64748b" }}>Numero DDT</label>
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
            value={dataDoc}
            onChange={(e) => setDataDoc(e.target.value)}
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
        <div style={{ gridColumn: "1 / -1" }}>
          <label style={{ fontSize: 12, color: "#64748b" }}>Note</label>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            style={{ width: "100%", marginTop: 4, padding: 8, borderRadius: 6, border: "1px solid #cbd5e1" }}
          />
        </div>
        <button type="button" className="btn-primary" onClick={() => void addRow()} disabled={saving}>
          {saving ? "Salvataggio…" : "Registra DDT"}
        </button>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "2px solid #e2e8f0", color: "#64748b" }}>
              <th style={{ padding: "10px 8px" }}>Numero</th>
              <th style={{ padding: "10px 8px" }}>Data</th>
              <th style={{ padding: "10px 8px" }}>Fornitore</th>
              <th style={{ padding: "10px 8px" }}>Note</th>
              <th style={{ padding: "10px 8px" }} />
            </tr>
          </thead>
          <tbody>
            {righe.map((r) => (
              <tr key={r.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                <td style={{ padding: "10px 8px", fontWeight: 600 }}>{r.numero}</td>
                <td style={{ padding: "10px 8px" }}>{r.data}</td>
                <td style={{ padding: "10px 8px" }}>{r.fornitore || "—"}</td>
                <td style={{ padding: "10px 8px", color: "#64748b" }}>{r.note || "—"}</td>
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
        {righe.length === 0 ? (
          <p style={{ padding: 16, color: "#94a3b8", fontSize: 14 }}>Nessun DDT registrato.</p>
        ) : null}
      </div>
    </AdminModuleShell>
  );
}
