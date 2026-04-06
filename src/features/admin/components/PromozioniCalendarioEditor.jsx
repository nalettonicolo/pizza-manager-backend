import { useMemo } from "react";

const GIORNI = [
  { v: 0, label: "Lunedì" },
  { v: 1, label: "Martedì" },
  { v: 2, label: "Mercoledì" },
  { v: 3, label: "Giovedì" },
  { v: 4, label: "Venerdì" },
  { v: 5, label: "Sabato" },
  { v: 6, label: "Domenica" },
];

function newRule() {
  return {
    id: `pc_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    nome: "",
    giorno_settimana: 0,
    ora_inizio: "11:00",
    ora_fine: "15:00",
    prezzo_fisso_euro: "",
    categoria_ids: [],
    solo_senza_modifiche_ingredienti: true,
    disabilita_fidelity: false,
    attivo: true,
  };
}

export default function PromozioniCalendarioEditor({ categories = [], value = [], onChange }) {
  const rules = Array.isArray(value) ? value : [];

  const catOptions = useMemo(
    () =>
      (categories || []).map((c) => ({
        id: String(c.id),
        nome: c.nome || "Categoria",
      })),
    [categories],
  );

  const updateAt = (idx, patch) => {
    const next = rules.map((r, i) => (i === idx ? { ...r, ...patch } : r));
    onChange(next);
  };

  const removeAt = (idx) => {
    onChange(rules.filter((_, i) => i !== idx));
  };

  const toggleCategory = (idx, catId) => {
    const r = rules[idx];
    const set = new Set(Array.isArray(r.categoria_ids) ? r.categoria_ids.map(String) : []);
    const id = String(catId);
    if (set.has(id)) set.delete(id);
    else set.add(id);
    updateAt(idx, { categoria_ids: [...set] });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <p className="dashboard-settings-hint" style={{ fontSize: 13, color: "#64748b", margin: 0 }}>
        Promozioni per <strong>giorno della settimana</strong> e <strong>fascia oraria</strong>. Esempio: il lunedì, in fascia
        pranzo, pizze delle categorie selezionate a prezzo fisso, senza aggiunte o rimozioni ingredienti (vetrina e cassa su
        pizza standard). Fascia notturna: ora fine precedente all&apos;ora inizio nello stesso giorno (es. 22:00 → 02:00).
      </p>
      {rules.map((rule, idx) => (
        <div
          key={rule.id || idx}
          style={{
            border: "1px solid #e2e8f0",
            borderRadius: 8,
            padding: 12,
            background: "#fafafa",
          }}
        >
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "flex-end", marginBottom: 10 }}>
            <label style={{ flex: "1 1 160px" }}>
              Nome
              <input
                type="text"
                value={rule.nome || ""}
                onChange={(e) => updateAt(idx, { nome: e.target.value })}
                placeholder="es. Lunedì pranzo"
                style={{ marginTop: 4, padding: "8px 10px", width: "100%", boxSizing: "border-box" }}
              />
            </label>
            <label>
              Giorno
              <select
                value={Number(rule.giorno_settimana) || 0}
                onChange={(e) => updateAt(idx, { giorno_settimana: Number(e.target.value) })}
                style={{ marginTop: 4, padding: "8px 10px", display: "block" }}
              >
                {GIORNI.map((g) => (
                  <option key={g.v} value={g.v}>
                    {g.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Da
              <input
                type="time"
                value={rule.ora_inizio || "11:00"}
                onChange={(e) => updateAt(idx, { ora_inizio: e.target.value })}
                style={{ marginTop: 4, padding: "8px 10px", display: "block" }}
              />
            </label>
            <label>
              A
              <input
                type="time"
                value={rule.ora_fine || "15:00"}
                onChange={(e) => updateAt(idx, { ora_fine: e.target.value })}
                style={{ marginTop: 4, padding: "8px 10px", display: "block" }}
              />
            </label>
            <label>
              Prezzo fisso €
              <input
                type="number"
                min={0}
                step={0.5}
                value={rule.prezzo_fisso_euro === "" || rule.prezzo_fisso_euro == null ? "" : rule.prezzo_fisso_euro}
                onChange={(e) =>
                  updateAt(idx, {
                    prezzo_fisso_euro: e.target.value === "" ? "" : e.target.value,
                  })
                }
                style={{ marginTop: 4, padding: "8px 10px", width: 100 }}
              />
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={rule.attivo !== false}
                onChange={(e) => updateAt(idx, { attivo: e.target.checked })}
              />
              Attiva
            </label>
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", marginBottom: 10 }}>
            <input
              type="checkbox"
              checked={rule.solo_senza_modifiche_ingredienti === true}
              onChange={(e) => updateAt(idx, { solo_senza_modifiche_ingredienti: e.target.checked })}
            />
            Solo prodotti senza modifiche aggiunte/rimosse ingredienti (pizza di listino)
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", marginBottom: 10 }}>
            <input
              type="checkbox"
              checked={rule.disabilita_fidelity === true}
              onChange={(e) => updateAt(idx, { disabilita_fidelity: e.target.checked })}
            />
            Non accreditare punti fidelity sugli ordini che ricadono in questa promo (giorno/fascia/categorie)
          </label>
          <div>
            <span style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6 }}>Categorie incluse</span>
            <p style={{ fontSize: 12, color: "#64748b", margin: "0 0 8px" }}>
              Nessuna selezione = tutte le categorie. Altrimenti solo quelle spuntate.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {catOptions.map((c) => {
                const sel = (Array.isArray(rule.categoria_ids) ? rule.categoria_ids : []).map(String).includes(c.id);
                return (
                  <label
                    key={c.id}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      fontSize: 13,
                      cursor: "pointer",
                      padding: "4px 8px",
                      borderRadius: 6,
                      border: sel ? "1px solid #0f766e" : "1px solid #e2e8f0",
                      background: sel ? "#ecfdf5" : "#fff",
                    }}
                  >
                    <input type="checkbox" checked={sel} onChange={() => toggleCategory(idx, c.id)} />
                    {c.nome}
                  </label>
                );
              })}
            </div>
          </div>
          <button
            type="button"
            onClick={() => removeAt(idx)}
            style={{
              marginTop: 12,
              padding: "6px 12px",
              fontSize: 13,
              color: "#b91c1c",
              border: "1px solid #fecaca",
              background: "#fff",
              borderRadius: 6,
              cursor: "pointer",
            }}
          >
            Rimuovi promozione
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...rules, newRule()])}
        style={{
          alignSelf: "flex-start",
          padding: "8px 14px",
          borderRadius: 8,
          border: "1px solid #cbd5e1",
          background: "#fff",
          cursor: "pointer",
          fontWeight: 600,
        }}
      >
        + Aggiungi promozione
      </button>
    </div>
  );
}
