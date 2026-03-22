import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import DashboardNavCards from "@/components/dashboard/DashboardNavCards";

const STORAGE_KEY = "pizzamanager_superadmin_plans_v1";

function uid() {
  return `p_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

const DEFAULT_PLANS = [
  {
    id: "seed_pro",
    nome: "Pro",
    prezzo: "29 €/mese",
    descrizione: "Per pizzerie che vogliono crescere: report, ruoli avanzati, multi-sede.",
    funzionalita: [
      "Punti vendita multipli",
      "Report e analisi",
      "Ruoli e permessi avanzati",
      "Supporto prioritario",
    ],
  },
  {
    id: "seed_enterprise",
    nome: "Enterprise",
    prezzo: "Su misura",
    descrizione: "Gruppi e franchising: integrazioni, SLA e account dedicato.",
    funzionalita: [
      "Tutto ciò che include Pro",
      "API e integrazioni",
      "Account manager",
      "SLA e personalizzazioni",
    ],
  },
];

const SUPERADMIN_NAV = [
  { to: "/superadmin/dashboard", label: "Riepilogo", description: "Torna alla home" },
  { to: "/superadmin/tenants", label: "Clienti", description: "Pizzerie registrate" },
  { to: "/superadmin/licenses", label: "Abbonamenti", description: "Stato licenze" },
  { to: "/superadmin/settings", label: "Impostazioni", description: "Configurazione" },
];

function loadPlansFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length) return parsed;
  } catch {
    /* ignore */
  }
  return null;
}

function savePlansToStorage(list) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

export default function Piani() {
  const [piani, setPiani] = useState(() => loadPlansFromStorage() ?? DEFAULT_PLANS);
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState(null);

  useEffect(() => {
    savePlansToStorage(piani);
  }, [piani]);

  const startAdd = () => {
    const id = uid();
    const empty = {
      id,
      nome: "Nuovo piano",
      prezzo: "",
      descrizione: "",
      funzionalita: [""],
    };
    setPiani((prev) => [...prev, empty]);
    setDraft(empty);
    setEditingId(id);
  };

  const startEdit = (p) => {
    setDraft({ ...p, funzionalita: [...(p.funzionalita || [])] });
    setEditingId(p.id);
  };

  const cancelEdit = () => {
    if (draft?.nome === "Nuovo piano") {
      setPiani((prev) => prev.filter((p) => p.id !== draft.id));
    }
    setEditingId(null);
    setDraft(null);
  };

  const saveDraft = () => {
    if (!draft || !draft.nome.trim()) return;
    const funz = (draft.funzionalita || []).map((s) => s.trim()).filter(Boolean);
    setPiani((prev) =>
      prev.map((p) =>
        p.id === draft.id ? { ...draft, funzionalita: funz.length ? funz : [""] } : p
      )
    );
    setEditingId(null);
    setDraft(null);
  };

  const updateDraftField = (field, value) => {
    setDraft((d) => (d ? { ...d, [field]: value } : d));
  };

  const updateDraftFeature = (index, value) => {
    setDraft((d) => {
      if (!d) return d;
      const arr = [...(d.funzionalita || [])];
      arr[index] = value;
      return { ...d, funzionalita: arr };
    });
  };

  const addFeatureRow = () => {
    setDraft((d) => (d ? { ...d, funzionalita: [...(d.funzionalita || []), ""] } : d));
  };

  const removeFeatureRow = (index) => {
    setDraft((d) => {
      if (!d) return d;
      const arr = (d.funzionalita || []).filter((_, i) => i !== index);
      return { ...d, funzionalita: arr.length ? arr : [""] };
    });
  };

  const removePlan = (id) => {
    if (!window.confirm("Eliminare questo piano dall’elenco?")) return;
    setPiani((prev) => prev.filter((p) => p.id !== id));
    if (editingId === id) {
      setEditingId(null);
      setDraft(null);
    }
  };

  return (
    <>
      <div style={{ marginBottom: 16 }}>
        <Link
          to="/superadmin/dashboard"
          style={{
            display: "inline-block",
            padding: "10px 20px",
            background: "#d35400",
            color: "#fff",
            borderRadius: 6,
            textDecoration: "none",
            fontWeight: 600,
            fontSize: 14,
          }}
        >
          ← Torna al Riepilogo
        </Link>
      </div>
      <div className="dashboard-page-header">
        <h1 className="dashboard-page-title">Piani di abbonamento</h1>
      </div>

      <div className="dashboard-box" style={{ marginBottom: 24, maxWidth: 720 }}>
        <h2 style={{ marginTop: 0, fontSize: 16 }}>Come funziona</h2>
        <p style={{ margin: "0 0 8px", fontSize: 14, color: "#555", lineHeight: 1.55 }}>
          Qui definisci i <strong>piani commerciali</strong> (nome, prezzo, cosa include ogni piano). Ogni cliente in{" "}
          <Link to="/superadmin/tenants">Clienti</Link> è associato a un codice piano (es. <strong>Prova 7 giorni</strong>,{" "}
          <strong>Pro</strong>, <strong>Enterprise</strong>).
        </p>
        <p style={{ margin: 0, fontSize: 14, color: "#555", lineHeight: 1.55 }}>
          <strong>Non esiste un piano “Free” permanente:</strong> chi inizia ha una <strong>prova di 7 giorni</strong> per
          valutare il servizio; poi sottoscrive uno dei piani che configuri qui sotto.
        </p>
        <p style={{ margin: "12px 0 0", fontSize: 13, color: "#666" }}>
          I dati sono salvati in questo browser (localStorage). Per pubblicarli su tutti i dispositivi e sulla landing
          pubblica servirà persistenza su database (es. tabella <code>piani</code> in Supabase).
        </p>
      </div>

      <div className="nav-cards cols-4" style={{ marginBottom: 32 }}>
        {SUPERADMIN_NAV.map((item) => (
          <Link key={item.to} to={item.to} className="nav-card">
            <h3>{item.label}</h3>
            <p>{item.description}</p>
            <span className="nav-card-link">Vai →</span>
          </Link>
        ))}
      </div>

      <div style={{ marginBottom: 16 }}>
        <button type="button" className="btn-primary-dashboard" onClick={startAdd}>
          + Aggiungi piano
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 20 }}>
        {piani.map((p) => {
          const isEditing = editingId === p.id && draft;
          return (
            <div key={p.id} className="dashboard-box" style={{ marginBottom: 0 }}>
              {isEditing ? (
                <>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Nome piano</label>
                  <input
                    type="text"
                    value={draft.nome}
                    onChange={(e) => updateDraftField("nome", e.target.value)}
                    style={{ width: "100%", padding: 8, marginBottom: 12, borderRadius: 6, border: "1px solid #ddd", boxSizing: "border-box" }}
                  />
                  <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Prezzo (testo libero)</label>
                  <input
                    type="text"
                    value={draft.prezzo}
                    onChange={(e) => updateDraftField("prezzo", e.target.value)}
                    placeholder="es. 29 €/mese"
                    style={{ width: "100%", padding: 8, marginBottom: 12, borderRadius: 6, border: "1px solid #ddd", boxSizing: "border-box" }}
                  />
                  <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Descrizione</label>
                  <textarea
                    value={draft.descrizione}
                    onChange={(e) => updateDraftField("descrizione", e.target.value)}
                    rows={3}
                    style={{ width: "100%", padding: 8, marginBottom: 12, borderRadius: 6, border: "1px solid #ddd", boxSizing: "border-box", resize: "vertical" }}
                  />
                  <span style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 8 }}>Cosa include (elenco punti)</span>
                  {(draft.funzionalita || [""]).map((line, i) => (
                    <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                      <input
                        type="text"
                        value={line}
                        onChange={(e) => updateDraftFeature(i, e.target.value)}
                        placeholder="Funzionalità"
                        style={{ flex: 1, padding: 8, borderRadius: 6, border: "1px solid #ddd" }}
                      />
                      <button type="button" onClick={() => removeFeatureRow(i)} style={{ padding: "0 10px" }}>
                        ×
                      </button>
                    </div>
                  ))}
                  <button type="button" className="btn-outline" style={{ marginBottom: 12 }} onClick={addFeatureRow}>
                    + riga
                  </button>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button type="button" className="btn-primary-dashboard" onClick={saveDraft}>
                      Salva
                    </button>
                    <button type="button" className="btn-outline" onClick={cancelEdit}>
                      Annulla
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                    <h2 style={{ margin: "0 0 8px", color: "#d35400", fontSize: 18 }}>{p.nome}</h2>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button type="button" className="btn-outline" style={{ fontSize: 12, padding: "4px 10px" }} onClick={() => startEdit(p)}>
                        Modifica
                      </button>
                      <button type="button" className="btn-outline" style={{ fontSize: 12, padding: "4px 10px" }} onClick={() => removePlan(p.id)}>
                        Elimina
                      </button>
                    </div>
                  </div>
                  <p style={{ fontSize: 17, fontWeight: 700, margin: "0 0 8px", color: "#2c2c2c" }}>{p.prezzo || "—"}</p>
                  {p.descrizione && (
                    <p style={{ fontSize: 14, color: "#555", margin: "0 0 12px" }}>{p.descrizione}</p>
                  )}
                  <ul style={{ margin: 0, paddingLeft: 18, fontSize: 14, color: "#444" }}>
                    {(p.funzionalita || []).filter(Boolean).map((f, i) => (
                      <li key={i}>{f}</li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
