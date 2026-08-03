import { Fragment, useMemo, useState } from "react";
import AdminModuleShell from "@/features/admin/components/AdminModuleShell";
import { newLocalId } from "@/features/admin/hooks/useTenantLocalJson";
import { useMagazzinoFornitoriStorage } from "@/features/admin/hooks/useMagazzinoFornitoriStorage";

const emptyFornitore = () => ({
  id: newLocalId(),
  nome: "",
  tipo: "grossista",
  note: "",
  listino: [],
});

const emptyListinoRow = () => ({
  id: newLocalId(),
  descrizione: "",
  prezzoUnitario: "",
  unita: "kg",
  qtyMinimaRiordino: "",
});

/** Colonne allineate su intestazione, righe dati e riga inserimento (stessa griglia = stessi allineamenti). */
const LISTINO_GRID = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) 108px 88px 96px 112px",
  columnGap: 12,
  rowGap: 10,
  alignItems: "center",
};

const cellInput = {
  width: "100%",
  minWidth: 0,
  boxSizing: "border-box",
  padding: 8,
  borderRadius: 6,
  border: "1px solid #cbd5e1",
};

export default function OrdiniFornitoriPage() {
  const {
    fornitori,
    addFornitore: persistFornitore,
    updateFornitore,
    removeFornitore,
    ready,
    backend,
    loadErr,
  } = useMagazzinoFornitoriStorage();
  const [selectedId, setSelectedId] = useState(null);
  const [draft, setDraft] = useState(emptyFornitore);
  const [editingListino, setEditingListino] = useState(emptyListinoRow);
  const [showForm, setShowForm] = useState(false);

  const selected = useMemo(
    () => fornitori.find((f) => f.id === selectedId) || null,
    [fornitori, selectedId],
  );

  if (!ready) {
    return <p className="text-gray-400 text-sm">Caricamento…</p>;
  }

  function addFornitore() {
    const row = { ...draft, nome: draft.nome.trim() || "Fornitore senza nome", listino: [] };
    void persistFornitore(row).then((saved) => {
      setDraft(emptyFornitore());
      setShowForm(false);
      setSelectedId(saved.id);
    });
  }

  function removeFornitoreHandler(id) {
    if (!window.confirm("Eliminare questo fornitore e il suo listino?")) return;
    void removeFornitore(id);
    if (selectedId === id) setSelectedId(null);
  }

  function patchSelectedFornitore(patchFn) {
    if (!selected) return;
    void updateFornitore(patchFn(selected));
  }

  function addListinoRow() {
    if (!selected) return;
    const row = {
      ...editingListino,
      descrizione: editingListino.descrizione.trim() || "Voce",
      prezzoUnitario: Number(editingListino.prezzoUnitario) || 0,
      qtyMinimaRiordino: Number(editingListino.qtyMinimaRiordino) || 0,
    };
    patchSelectedFornitore((f) => ({ ...f, listino: [...f.listino, row] }));
    setEditingListino(emptyListinoRow());
  }

  function removeListinoRow(fId, rowId) {
    const f = fornitori.find((x) => x.id === fId)
    if (!f) return
    void updateFornitore({ ...f, listino: f.listino.filter((r) => r.id !== rowId) })
  }

  return (
    <AdminModuleShell
      title="Ordini fornitori"
      lead="Anagrafica grossisti e agenti, listino prezzi e quantità minima per suggerimenti di riordino (base per flusso semi-automatico)."
      specTitle="Come usarlo"
      specChildren={
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          <li>
            <strong>Listino:</strong> una riga per articolo. <strong>Prezzo</strong> è il costo per <strong>UM</strong> (kg,
            litri, pezzi, colli). Serve per confrontare fornitori e, in seguito, per suggerimenti di ordine.
          </li>
          <li>
            <strong>Qtà min.</strong> (quantità minima di riordino): soglia sotto la quale conviene ordinare di nuovo
            (es. scorte in magazzino o consumo stimato). È un valore nella stessa UM del prezzo.
          </li>
          <li>
            Distingui <strong>grossista</strong> e <strong>agente</strong> per organizzare contatti e condizioni (es.
            pagamento alla consegna nelle note del fornitore).
          </li>
        </ul>
      }
    >
      {backend === "db" ? (
        <p style={{ fontSize: 13, color: "#166534", margin: "0 0 12px" }} role="status">
          Dati salvati su Supabase (multi-dispositivo).
        </p>
      ) : (
        <p style={{ fontSize: 13, color: "#92400e", margin: "0 0 12px" }} role="status">
          Storage locale di emergenza — le tabelle magazzino su Supabase non risultano raggiungibili.
        </p>
      )}
      {loadErr ? (
        <p style={{ fontSize: 13, color: "#b91c1c", margin: "0 0 12px" }} role="alert">
          {loadErr}
        </p>
      ) : null}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 24, alignItems: "flex-start" }}>
        <div style={{ flex: "1 1 280px", minWidth: 260 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h2 style={{ margin: 0, fontSize: 16, color: "#0f172a" }}>Fornitori</h2>
            <button type="button" className="btn-primary" style={{ fontSize: 13 }} onClick={() => setShowForm((s) => !s)}>
              {showForm ? "Chiudi" : "+ Nuovo"}
            </button>
          </div>
          {showForm ? (
            <div
              style={{
                padding: 14,
                border: "1px solid #e2e8f0",
                borderRadius: 8,
                marginBottom: 12,
                background: "#fff",
              }}
            >
              <label style={{ display: "block", fontSize: 12, color: "#64748b", marginBottom: 4 }}>Nome</label>
              <input
                value={draft.nome}
                onChange={(e) => setDraft((d) => ({ ...d, nome: e.target.value }))}
                style={{ width: "100%", marginBottom: 10, padding: 8, borderRadius: 6, border: "1px solid #cbd5e1" }}
              />
              <label style={{ display: "block", fontSize: 12, color: "#64748b", marginBottom: 4 }}>Tipo</label>
              <select
                value={draft.tipo}
                onChange={(e) => setDraft((d) => ({ ...d, tipo: e.target.value }))}
                style={{ width: "100%", marginBottom: 10, padding: 8, borderRadius: 6, border: "1px solid #cbd5e1" }}
              >
                <option value="grossista">Grossista</option>
                <option value="agente">Agente / intermediario</option>
              </select>
              <label style={{ display: "block", fontSize: 12, color: "#64748b", marginBottom: 4 }}>Note</label>
              <textarea
                value={draft.note}
                onChange={(e) => setDraft((d) => ({ ...d, note: e.target.value }))}
                rows={2}
                style={{ width: "100%", marginBottom: 10, padding: 8, borderRadius: 6, border: "1px solid #cbd5e1" }}
              />
              <button type="button" className="btn-primary" onClick={addFornitore}>
                Salva fornitore
              </button>
            </div>
          ) : null}
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {fornitori.map((f) => (
              <li key={f.id} style={{ marginBottom: 8 }}>
                <button
                  type="button"
                  onClick={() => setSelectedId(f.id)}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    padding: "10px 12px",
                    borderRadius: 8,
                    border: `1px solid ${selectedId === f.id ? "#c2410c" : "#e2e8f0"}`,
                    background: selectedId === f.id ? "#fff7ed" : "#fff",
                    cursor: "pointer",
                    font: "inherit",
                  }}
                >
                  <strong style={{ color: "#0f172a" }}>{f.nome}</strong>
                  <span style={{ fontSize: 12, color: "#64748b", marginLeft: 8 }}>
                    {f.tipo === "agente" ? "Agente" : "Grossista"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {fornitori.length === 0 ? (
            <p style={{ fontSize: 13, color: "#94a3b8" }}>Nessun fornitore. Aggiungi il primo con «Nuovo».</p>
          ) : null}
        </div>

        <div style={{ flex: "2 1 360px", minWidth: 280 }}>
          {!selected ? (
            <p style={{ color: "#94a3b8", fontSize: 14 }}>Seleziona un fornitore per gestire il listino.</p>
          ) : (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                <div>
                  <h2 style={{ margin: "0 0 4px 0", fontSize: 16, color: "#0f172a" }}>{selected.nome}</h2>
                  <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>{selected.note || "—"}</p>
                </div>
                <button type="button" className="btn-logout btn-logout-red" style={{ fontSize: 12 }} onClick={() => removeFornitoreHandler(selected.id)}>
                  Elimina
                </button>
              </div>

              <h3 style={{ fontSize: 14, color: "#334155", margin: "0 0 6px 0" }}>Listino e soglie</h3>
              <p style={{ margin: "0 0 14px 0", fontSize: 13, color: "#64748b", lineHeight: 1.5, maxWidth: 720 }}>
                Ogni riga è un articolo: <strong>prezzo in euro</strong> riferito all’<strong>unità di misura</strong> (es.
                €/kg). <strong>Qtà min.</strong> è la soglia (nella stessa UM) sotto cui segnalare un riordino.
              </p>

              <div style={{ ...LISTINO_GRID, marginBottom: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#64748b" }}>Descrizione</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#64748b", textAlign: "right" }}>Prezzo (€)</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#64748b", textAlign: "center" }}>UM</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#64748b", textAlign: "right" }}>Qtà min.</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#64748b", textAlign: "end" }}>Azioni</div>

                {selected.listino.map((r) => (
                  <Fragment key={r.id}>
                    <div style={{ fontSize: 14, color: "#0f172a", wordBreak: "break-word" }}>{r.descrizione}</div>
                    <div style={{ fontSize: 14, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                      € {Number(r.prezzoUnitario).toFixed(2)}
                    </div>
                    <div style={{ fontSize: 14, textAlign: "center", color: "#334155" }}>{r.unita}</div>
                    <div style={{ fontSize: 14, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                      {r.qtyMinimaRiordino}
                    </div>
                    <div style={{ justifySelf: "stretch", display: "flex", justifyContent: "flex-end" }}>
                      <button
                        type="button"
                        style={{ border: "none", background: "none", color: "#b91c1c", cursor: "pointer", fontSize: 12 }}
                        onClick={() => removeListinoRow(selected.id, r.id)}
                      >
                        Rimuovi
                      </button>
                    </div>
                  </Fragment>
                ))}

                <div
                  style={{
                    gridColumn: "1 / -1",
                    height: 1,
                    background: "#e2e8f0",
                    margin: "6px 0 4px 0",
                  }}
                />

                <input
                  placeholder="Prodotto / articolo"
                  value={editingListino.descrizione}
                  onChange={(e) => setEditingListino((x) => ({ ...x, descrizione: e.target.value }))}
                  style={cellInput}
                />
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0,00"
                  value={editingListino.prezzoUnitario}
                  onChange={(e) => setEditingListino((x) => ({ ...x, prezzoUnitario: e.target.value }))}
                  style={{ ...cellInput, textAlign: "right" }}
                />
                <select
                  value={editingListino.unita}
                  onChange={(e) => setEditingListino((x) => ({ ...x, unita: e.target.value }))}
                  style={{ ...cellInput, textAlign: "center" }}
                >
                  <option value="kg">kg</option>
                  <option value="l">l</option>
                  <option value="pz">pz</option>
                  <option value="ct">ct</option>
                </select>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Soglia"
                  value={editingListino.qtyMinimaRiordino}
                  onChange={(e) => setEditingListino((x) => ({ ...x, qtyMinimaRiordino: e.target.value }))}
                  style={{ ...cellInput, textAlign: "right" }}
                />
                <button
                  type="button"
                  className="btn-primary"
                  style={{ fontSize: 13, width: "100%", boxSizing: "border-box", justifySelf: "stretch" }}
                  onClick={addListinoRow}
                >
                  Aggiungi
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </AdminModuleShell>
  );
}
