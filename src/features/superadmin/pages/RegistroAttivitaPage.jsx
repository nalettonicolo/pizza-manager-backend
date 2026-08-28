import { useCallback, useEffect, useMemo, useState } from "react";
import Loader from "@/components/feedback/Loader";
import ErrorState from "@/components/feedback/ErrorState";
import { getRegistroRichiesteSviluppo } from "@/features/superadmin/services/superadminService";

function formatData(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString("it-IT", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

const AREA_LABEL = {
  sicurezza: "🔒 Sicurezza",
  pagamenti: "💳 Pagamenti",
  audit: "🔍 Audit",
  ai: "🤖 AI",
  ui: "🎨 UI",
  dati: "🗃️ Dati",
  infrastruttura: "⚙️ Infrastruttura",
  marketing: "📣 Marketing",
  menu: "🍕 Menu",
  bug: "🐛 Bug",
};

export default function RegistroAttivitaPage() {
  const [righe, setRighe] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filtroArea, setFiltroArea] = useState("");
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getRegistroRichiesteSviluppo({ limit: 500 });
      setRighe(data);
    } catch (err) {
      setError(err?.message || "Impossibile caricare il registro.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const aree = useMemo(() => {
    const set = new Set(righe.map((r) => r.area).filter(Boolean));
    return Array.from(set).sort();
  }, [righe]);

  const righeFiltrate = useMemo(() => {
    const q = query.trim().toLowerCase();
    return righe.filter((r) => {
      if (filtroArea && r.area !== filtroArea) return false;
      if (!q) return true;
      return (
        (r.richiesta || "").toLowerCase().includes(q) ||
        (r.azioni || "").toLowerCase().includes(q)
      );
    });
  }, [righe, filtroArea, query]);

  return (
    <div className="dashboard-settings-page">
      <h1 className="dashboard-page-title">Registro attività</h1>
      <p className="dashboard-settings-section-desc" style={{ marginBottom: 12, maxWidth: 760 }}>
        Ogni richiesta fatta su questo progetto e cosa è stato effettivamente svolto — visibile solo da superadmin,
        così si resta sempre allineati senza dover riaprire ogni chat. Registro <strong>unico e condiviso</strong>,
        indipendente da quale assistente AI ha fatto il lavoro (Claude Code, Cursor, ecc.). Aggiornato dopo ogni
        richiesta significativa: non è un log tecnico automatico, è il riepilogo umano.
      </p>

      <details style={{ marginBottom: 20, maxWidth: 760 }}>
        <summary style={{ cursor: "pointer", fontSize: 13.5, fontWeight: 600, color: "#962d22" }}>
          Far scrivere anche a Cursor (o altri assistenti) in questo stesso registro
        </summary>
        <div style={{ marginTop: 10, fontSize: 13, color: "#475569", lineHeight: 1.6 }}>
          <p style={{ margin: "0 0 8px" }}>
            Il repository ha già un file <code>.cursorrules</code> che istruisce Cursor a farlo in automatico dopo
            ogni richiesta. Se serve rifarlo a mano (o con un altro assistente), il comando da eseguire nel terminale
            del progetto è:
          </p>
          <pre
            style={{
              background: "#0f172a",
              color: "#e2e8f0",
              borderRadius: 8,
              padding: "10px 12px",
              fontSize: 12,
              overflowX: "auto",
              margin: "0 0 8px",
            }}
          >
{`node scripts/log-attivita.mjs --richiesta "cosa ha chiesto l'utente" --azioni "cosa è stato fatto" --area "categoria"`}
          </pre>
          <p style={{ margin: 0 }}>
            Nessuna credenziale nuova da configurare: riusa lo stesso accesso Supabase già presente sulla macchina
            (<code>supabase login</code>). <code>--area</code> è facoltativo (es. sicurezza, pagamenti, ui, bug…).
          </p>
        </div>
      </details>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 18, alignItems: "center" }}>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cerca nel testo…"
          className="dashboard-search-input"
          style={{ minWidth: 240 }}
        />
        <select
          value={filtroArea}
          onChange={(e) => setFiltroArea(e.target.value)}
          className="dipendenti-role-select"
        >
          <option value="">Tutte le aree</option>
          {aree.map((a) => (
            <option key={a} value={a}>
              {AREA_LABEL[a] || a}
            </option>
          ))}
        </select>
        <span style={{ fontSize: 13, color: "#64748b" }}>
          {righeFiltrate.length} di {righe.length}
        </span>
      </div>

      {loading ? (
        <Loader />
      ) : error ? (
        <ErrorState message={error} />
      ) : righeFiltrate.length === 0 ? (
        <p style={{ fontSize: 14, color: "#64748b" }}>Nessuna voce trovata.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {righeFiltrate.map((r) => (
            <section
              key={r.id}
              className="dashboard-box"
              style={{ padding: "16px 18px" }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 8 }}>
                <span style={{ fontSize: 12, color: "#94a3b8" }}>{formatData(r.creato_il)}</span>
                {r.area ? (
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      padding: "2px 10px",
                      borderRadius: 999,
                      background: "#fef2f2",
                      color: "#962d22",
                    }}
                  >
                    {AREA_LABEL[r.area] || r.area}
                  </span>
                ) : null}
              </div>
              <p style={{ margin: "0 0 6px", fontSize: 14, fontWeight: 700, color: "#0f172a" }}>
                💬 {r.richiesta}
              </p>
              <p style={{ margin: 0, fontSize: 13.5, color: "#334155", lineHeight: 1.55 }}>
                ✅ {r.azioni}
              </p>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
