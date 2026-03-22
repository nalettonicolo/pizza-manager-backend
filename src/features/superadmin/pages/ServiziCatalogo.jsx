import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Modal from "@/components/dashboard/Modal";
import { DEFAULT_SERVICES_CATALOG } from "@/features/superadmin/catalog/defaultCatalog";
import {
  createEmptyService,
  formatEuroMonth,
  loadServicesCatalog,
  saveServicesCatalog,
} from "@/features/superadmin/catalog/servicesStorage";

const btnSecondary = {
  padding: "8px 16px",
  border: "1px solid #cbd5e1",
  borderRadius: 6,
  background: "#fff",
  color: "#334155",
  fontSize: 14,
  cursor: "pointer",
};

const inputBase = {
  width: "100%",
  padding: 8,
  marginBottom: 12,
  borderRadius: 6,
  border: "1px solid #ddd",
  boxSizing: "border-box",
};

function funzioniToText(arr) {
  return Array.isArray(arr) ? arr.join("\n") : "";
}

function textToFunzioni(text) {
  return String(text || "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

export default function ServiziCatalogo() {
  const [services, setServices] = useState(() => loadServicesCatalog());
  const [modal, setModal] = useState(null);

  useEffect(() => {
    saveServicesCatalog(services);
  }, [services]);

  const byCategory = useMemo(() => {
    const m = new Map();
    for (const s of services) {
      const c = s.categoria || "Altro";
      if (!m.has(c)) m.set(c, []);
      m.get(c).push(s);
    }
    return Array.from(m.entries()).sort(([a], [b]) => a.localeCompare(b, "it"));
  }, [services]);

  const openAdd = () => {
    setModal({ mode: "add", ...createEmptyService(), funzioniText: "" });
  };

  const openEdit = (s) => {
    setModal({
      mode: "edit",
      id: s.id,
      nome: s.nome,
      categoria: s.categoria || "Altro",
      prezzoMensile: s.prezzoMensile ?? 0,
      funzioniText: funzioniToText(s.funzioni),
    });
  };

  const closeModal = () => setModal(null);

  const saveModal = () => {
    if (!modal) return;
    const nome = modal.nome?.trim();
    if (!nome) return;
    const prezzoMensile = Math.max(0, Number(modal.prezzoMensile) || 0);
    const funzioni = textToFunzioni(modal.funzioniText);
    const categoria = modal.categoria?.trim() || "Altro";
    if (modal.mode === "add") {
      setServices((prev) => [...prev, { id: modal.id, nome, categoria, funzioni, prezzoMensile }]);
    } else {
      setServices((prev) =>
        prev.map((x) => (x.id === modal.id ? { ...x, nome, categoria, funzioni, prezzoMensile } : x)),
      );
    }
    closeModal();
  };

  const remove = (s) => {
    const isBuiltIn = DEFAULT_SERVICES_CATALOG.some((d) => d.id === s.id);
    if (isBuiltIn) {
      window.alert(
        "I servizi predefiniti non si eliminano: puoi modificarne nome, funzioni e prezzo, oppure impostare il prezzo a 0 € se non lo vendi.",
      );
      return;
    }
    if (!window.confirm(`Eliminare definitivamente il servizio "${s.nome}"?`)) return;
    setServices((prev) => prev.filter((x) => x.id !== s.id));
  };

  const resetCatalog = () => {
    if (!window.confirm("Ripristinare il catalogo predefinito (tutti i servizi e prezzi di fabbrica)? I tuoi adattamenti andranno persi.")) {
      return;
    }
    setServices(DEFAULT_SERVICES_CATALOG.map((s) => ({ ...s })));
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

      <div className="dashboard-page-header" style={{ alignItems: "flex-start", gap: 12 }}>
        <div style={{ flex: 1 }}>
          <h1 className="dashboard-page-title">Catalogo servizi</h1>
          <p style={{ margin: "8px 0 0", fontSize: 14, color: "#64748b", maxWidth: 720, lineHeight: 1.55 }}>
            Elenco completo dei moduli vendibili: per ogni servizio indica le <strong>funzioni</strong> incluse e il{" "}
            <strong>prezzo base mensile</strong>. In <Link to="/superadmin/piani">Piani</Link> il canone del piano può essere
            calcolato automaticamente come somma dei servizi selezionati.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link to="/superadmin/piani" className="btn-primary-dashboard" style={{ textDecoration: "none" }}>
            Piani di abbonamento →
          </Link>
        </div>
      </div>

      <div className="dashboard-box" style={{ marginBottom: 20 }}>
        <h2 style={{ marginTop: 0, fontSize: 16 }}>Gerarchia suggerita dei piani</h2>
        <ul style={{ margin: 0, paddingLeft: 20, fontSize: 14, color: "#334155", lineHeight: 1.65 }}>
          <li>
            <strong>Base</strong> — ordini a cassa, stampa comanda in cucina, gestione consegne.
          </li>
          <li>
            <strong>Pro</strong> — tutto il Base più <strong>ordini online</strong> (cliente finale).
          </li>
          <li>
            <strong>Enterprise</strong> — tutto il Pro più <strong>schermate tablet per ruoli operativi</strong> (cassa,
            bancone, cucina, delivery, pizzaiolo, ecc.).
          </li>
          <li>
            <strong>Full</strong> — tutti i servizi del catalogo.
          </li>
          <li>
            <strong>Su misura</strong> — si selezionano solo i servizi richiesti; il prezzo è la somma dei relativi canoni.
          </li>
        </ul>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
        <button type="button" className="btn-primary-dashboard" onClick={openAdd}>
          + Nuovo servizio
        </button>
        <button type="button" onClick={resetCatalog} style={{ ...btnSecondary, fontSize: 13 }}>
          Ripristina catalogo predefinito
        </button>
      </div>

      <p style={{ fontSize: 13, color: "#64748b", marginBottom: 16 }}>
        Dati salvati in questo browser (localStorage). Totale voci: <strong>{services.length}</strong>.
      </p>

      {byCategory.map(([categoria, items]) => (
        <div key={categoria} className="dashboard-box" style={{ marginBottom: 24 }}>
          <h2 style={{ marginTop: 0, fontSize: 17, color: "#0f172a" }}>{categoria}</h2>
          <div className="dashboard-table-wrap" style={{ overflowX: "auto" }}>
            <table style={{ minWidth: 720 }}>
              <thead>
                <tr>
                  <th>Servizio</th>
                  <th style={{ minWidth: 280 }}>Funzioni incluse</th>
                  <th style={{ textAlign: "right", whiteSpace: "nowrap" }}>Prezzo base</th>
                  <th style={{ textAlign: "right", width: 200 }}>Azioni</th>
                </tr>
              </thead>
              <tbody>
                {items.map((s) => (
                  <tr key={s.id}>
                    <td style={{ fontWeight: 600, verticalAlign: "top" }}>{s.nome}</td>
                    <td style={{ fontSize: 13, color: "#475569", verticalAlign: "top" }}>
                      {s.funzioni?.length ? (
                        <ul style={{ margin: 0, paddingLeft: 18 }}>
                          {s.funzioni.map((f, i) => (
                            <li key={i}>{f}</li>
                          ))}
                        </ul>
                      ) : (
                        <span style={{ color: "#94a3b8" }}>—</span>
                      )}
                    </td>
                    <td style={{ textAlign: "right", fontWeight: 700, whiteSpace: "nowrap", verticalAlign: "top" }}>
                      {formatEuroMonth(s.prezzoMensile)}
                    </td>
                    <td style={{ textAlign: "right", verticalAlign: "top" }}>
                      <button
                        type="button"
                        onClick={() => openEdit(s)}
                        style={{ ...btnSecondary, fontSize: 12, padding: "6px 12px", marginRight: 8 }}
                      >
                        Modifica
                      </button>
                      {!DEFAULT_SERVICES_CATALOG.some((d) => d.id === s.id) && (
                        <button type="button" onClick={() => remove(s)} style={{ ...btnSecondary, fontSize: 12, padding: "6px 12px" }}>
                          Elimina
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      <Modal
        open={!!modal}
        onClose={closeModal}
        title={modal?.mode === "add" ? "Nuovo servizio" : "Modifica servizio"}
        wide
        closeOnOverlayClick
      >
        {modal && (
          <>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Nome</label>
            <input
              type="text"
              value={modal.nome}
              onChange={(e) => setModal((m) => (m ? { ...m, nome: e.target.value } : m))}
              style={inputBase}
              placeholder="es. Ordini online"
            />
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Categoria</label>
            <input
              type="text"
              value={modal.categoria}
              onChange={(e) => setModal((m) => (m ? { ...m, categoria: e.target.value } : m))}
              style={inputBase}
              placeholder="es. Canale vendita"
            />
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
              Prezzo base mensile (€)
            </label>
            <input
              type="number"
              min={0}
              step={0.5}
              value={modal.prezzoMensile}
              onChange={(e) => setModal((m) => (m ? { ...m, prezzoMensile: e.target.value } : m))}
              style={inputBase}
            />
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
              Funzioni (una per riga)
            </label>
            <textarea
              value={modal.funzioniText}
              onChange={(e) => setModal((m) => (m ? { ...m, funzioniText: e.target.value } : m))}
              rows={6}
              style={{ ...inputBase, resize: "vertical", minHeight: 120, fontFamily: "inherit" }}
              placeholder="Descrivi cosa include il servizio..."
            />
            <p style={{ fontSize: 12, color: "#64748b", marginTop: -8 }}>
              ID interno: <code style={{ fontSize: 12 }}>{modal.id}</code>
              {modal.mode === "add" && (
                <>
                  {" "}
                  (generato automaticamente; puoi rinominare il servizio dopo il salvataggio)
                </>
              )}
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
              <button type="button" onClick={closeModal} style={btnSecondary}>
                Annulla
              </button>
              <button type="button" className="btn-primary-dashboard" onClick={saveModal}>
                Salva
              </button>
            </div>
          </>
        )}
      </Modal>
    </>
  );
}
