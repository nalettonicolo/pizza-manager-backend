import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTenant } from "@/app/contexts/TenantContext";
import {
  insertMagazzinoMovimento,
  listMagazzinoMovimenti,
  magazzinoMovimentiTableReachable,
} from "@/features/admin/services/adminService";

export default function MagazzinoMovimentiDbPage() {
  const { tenantId } = useTenant();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reachable, setReachable] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [descrizione, setDescrizione] = useState("");
  const [qtyDelta, setQtyDelta] = useState("");
  const [unita, setUnita] = useState("pz");

  const load = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    setError(null);
    try {
      const ok = await magazzinoMovimentiTableReachable(tenantId);
      setReachable(ok);
      if (!ok) {
        setRows([]);
        return;
      }
      const data = await listMagazzinoMovimenti(tenantId, { limit: 150 });
      setRows(data || []);
    } catch (e) {
      console.error(e);
      setError(e?.message || "Errore caricamento movimenti.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    void load();
  }, [load]);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!tenantId || !reachable) return;
    const q = Number(String(qtyDelta).replace(",", "."));
    if (!descrizione.trim() || !Number.isFinite(q) || q === 0) {
      setError("Descrizione obbligatoria e quantità diversa da zero.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await insertMagazzinoMovimento(tenantId, {
        descrizione: descrizione.trim(),
        qty_delta: q,
        unita: unita.trim() || "pz",
      });
      setDescrizione("");
      setQtyDelta("");
      await load();
    } catch (err) {
      console.error(err);
      setError(err?.message || "Salvataggio non riuscito.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div style={{ marginBottom: 16 }}>
        <Link
          to="/admin/magazzino"
          style={{
            display: "inline-block",
            padding: "8px 16px",
            background: "#f1f5f9",
            color: "#334155",
            borderRadius: 6,
            textDecoration: "none",
            fontWeight: 600,
            fontSize: 14,
            border: "1px solid #e2e8f0",
          }}
        >
          ← Hub magazzino
        </Link>
      </div>
      <h1 className="dashboard-page-title">Movimenti magazzino (database)</h1>
      <p style={{ margin: "0 0 20px", fontSize: 14, color: "#64748b", lineHeight: 1.55, maxWidth: 720 }}>
        Registro carichi/scarichi su Supabase (<code>magazzino_movimenti</code>). Fornitori e DDT sono nelle sezioni
        dedicate del hub Magazzino, anch&apos;essi su database.
      </p>

      {!tenantId ? (
        <p style={{ color: "#c62828" }}>Nessun tenant: impossibile caricare i movimenti.</p>
      ) : !reachable ? (
        <p style={{ color: "#b45309", lineHeight: 1.55 }}>
          Tabella non disponibile: esegui <code>sql/sql_upgrade.sql</code> e ricarica lo schema in Supabase (API), oppure verifica i permessi
          RLS.
        </p>
      ) : (
        <>
          <form
            onSubmit={onSubmit}
            style={{
              marginBottom: 28,
              padding: 20,
              border: "1px solid #e2e8f0",
              borderRadius: 10,
              background: "#fff",
              maxWidth: 520,
            }}
          >
            <h2 style={{ marginTop: 0, fontSize: 16 }}>Nuovo movimento</h2>
            <label style={{ display: "block", marginBottom: 8, fontSize: 14, fontWeight: 600 }}>Descrizione</label>
            <input
              value={descrizione}
              onChange={(e) => setDescrizione(e.target.value)}
              placeholder="es. Carico farina, scarico uso cucina…"
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: "10px 12px",
                marginBottom: 12,
                borderRadius: 8,
                border: "1px solid #cbd5e1",
                fontSize: 14,
              }}
            />
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
              <div style={{ flex: "1 1 140px" }}>
                <label style={{ display: "block", marginBottom: 8, fontSize: 14, fontWeight: 600 }}>Quantità Δ</label>
                <input
                  value={qtyDelta}
                  onChange={(e) => setQtyDelta(e.target.value)}
                  placeholder="es. 10 o -2"
                  inputMode="decimal"
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    padding: "10px 12px",
                    borderRadius: 8,
                    border: "1px solid #cbd5e1",
                    fontSize: 14,
                  }}
                />
              </div>
              <div style={{ flex: "0 0 100px" }}>
                <label style={{ display: "block", marginBottom: 8, fontSize: 14, fontWeight: 600 }}>Unità</label>
                <input
                  value={unita}
                  onChange={(e) => setUnita(e.target.value)}
                  placeholder="pz"
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    padding: "10px 12px",
                    borderRadius: 8,
                    border: "1px solid #cbd5e1",
                    fontSize: 14,
                  }}
                />
              </div>
              <button
                type="submit"
                disabled={saving}
                style={{
                  padding: "10px 20px",
                  background: saving ? "#94a3b8" : "#0f766e",
                  color: "#fff",
                  border: "none",
                  borderRadius: 8,
                  fontWeight: 600,
                  cursor: saving ? "default" : "pointer",
                }}
              >
                {saving ? "Salvataggio…" : "Registra"}
              </button>
            </div>
          </form>

          {error ? (
            <p style={{ color: "#c62828", marginBottom: 16 }}>{error}</p>
          ) : null}

          <h2 style={{ fontSize: 16, marginBottom: 12 }}>Ultimi movimenti</h2>
          {loading ? (
            <p style={{ color: "#64748b" }}>Caricamento…</p>
          ) : rows.length === 0 ? (
            <p style={{ color: "#64748b" }}>Nessun movimento registrato.</p>
          ) : (
            <div className="dashboard-table-wrap" style={{ overflowX: "auto" }}>
              <table style={{ minWidth: 520, fontSize: 14 }}>
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Descrizione</th>
                    <th style={{ textAlign: "right" }}>Δ qty</th>
                    <th>Unità</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <td style={{ whiteSpace: "nowrap", color: "#64748b" }}>
                        {r.created_at ? new Date(r.created_at).toLocaleString("it-IT") : "—"}
                      </td>
                      <td>{r.descrizione}</td>
                      <td style={{ textAlign: "right", fontWeight: 600 }}>{Number(r.qty_delta)}</td>
                      <td>{r.unita || "pz"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </>
  );
}
