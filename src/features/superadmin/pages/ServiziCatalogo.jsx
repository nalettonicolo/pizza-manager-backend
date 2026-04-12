import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Modal from "@/components/dashboard/Modal";
import { DEFAULT_SERVICES_CATALOG } from "@/features/superadmin/catalog/defaultCatalog";
import {
  createEmptyService,
  formatEuroMonth,
  loadServicesCatalog,
  saveServicesCatalog,
} from "@/features/superadmin/catalog/servicesStorage";
import { exportServiziCatalogCsv } from "@/features/superadmin/utils/exportSuperadminCsv";
import { applyServiziCsvToCatalog, parseServiziCsv } from "@/features/superadmin/utils/parseServiziCsv";
import SaListSearchField from "@/features/superadmin/components/SaListSearchField";
import { normalizeListSearchQuery, rowMatchesListSearch } from "@/utils/listSearchFilter";

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
  const navigate = useNavigate();
  const [services, setServices] = useState(() => loadServicesCatalog());
  const [modal, setModal] = useState(null);
  const importCsvRef = useRef(null);
  const [listQuery, setListQuery] = useState("");

  useEffect(() => {
    saveServicesCatalog(services);
  }, [services]);

  const servicesFiltered = useMemo(() => {
    const q = normalizeListSearchQuery(listQuery);
    if (!q) return services;
    return services.filter((s) =>
      rowMatchesListSearch(q, [
        s.nome,
        s.categoria,
        s.id,
        ...(Array.isArray(s.funzioni) ? s.funzioni : []),
        String(s.prezzoMensile ?? ""),
        s.attivo === false ? "disattivato" : "",
      ]),
    );
  }, [services, listQuery]);

  const byCategory = useMemo(() => {
    const m = new Map();
    for (const s of servicesFiltered) {
      const c = s.categoria || "Altro";
      if (!m.has(c)) m.set(c, []);
      m.get(c).push(s);
    }
    return Array.from(m.entries()).sort(([a], [b]) => a.localeCompare(b, "it"));
  }, [servicesFiltered]);

  const openAdd = () => {
    setModal({ mode: "add", ...createEmptyService(), funzioniText: "", avanzamentoPercentuale: 0 });
  };

  const onImportCsv = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      const rows = parseServiziCsv(String(reader.result || ""));
      setServices((prev) => applyServiziCsvToCatalog(prev, rows));
      e.target.value = "";
    };
    reader.readAsText(f, "UTF-8");
  };

  const openEdit = (s) => {
    setModal({
      mode: "edit",
      id: s.id,
      nome: s.nome,
      categoria: s.categoria || "Altro",
      attivo: s.attivo !== false,
      prezzoMensile: s.prezzoMensile ?? 0,
      avanzamentoPercentuale: s.avanzamentoPercentuale ?? 0,
      funzioniText: funzioniToText(s.funzioni),
    });
  };

  const closeModal = () => setModal(null);

  const saveModal = () => {
    if (!modal) return;
    const nome = modal.nome?.trim();
    if (!nome) return;
    const prezzoMensile = Math.max(0, Number(modal.prezzoMensile) || 0);
    const avanzamentoPercentuale = Math.min(100, Math.max(0, Math.round(Number(modal.avanzamentoPercentuale) || 0)));
    const funzioni = textToFunzioni(modal.funzioniText);
    const categoria = modal.categoria?.trim() || "Altro";
    const attivo = modal.attivo !== false;
    if (modal.mode === "add") {
      setServices((prev) => [
        ...prev,
        { id: modal.id, nome, categoria, funzioni, prezzoMensile, attivo, avanzamentoPercentuale },
      ]);
    } else {
      setServices((prev) =>
        prev.map((x) =>
          x.id === modal.id ? { ...x, nome, categoria, funzioni, prezzoMensile, attivo, avanzamentoPercentuale } : x,
        ),
      );
    }
    closeModal();
  };

  const toggleServiceAttivo = (serviceId) => {
    setServices((prev) =>
      prev.map((x) => (x.id === serviceId ? { ...x, attivo: x.attivo === false } : x)),
    );
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
      <div className="dashboard-page-header" style={{ alignItems: "flex-start", gap: 12 }}>
        <div style={{ flex: 1 }}>
          <h1 className="dashboard-page-title">Catalogo servizi</h1>
          <p style={{ margin: "8px 0 0", fontSize: 14, color: "#64748b", maxWidth: "100%", lineHeight: 1.55 }}>
            Elenco completo dei moduli vendibili: per ogni servizio indica le <strong>funzioni</strong> incluse e il{" "}
            <strong>prezzo base mensile</strong>. In <Link to="/superadmin/piani">Piani</Link> il canone del piano può essere
            calcolato automaticamente come somma dei servizi selezionati. L&apos;avanzamento di sviluppo (0–100%) si usa in{" "}
            <Link to="/superadmin/sviluppo">Sviluppo</Link> e nel CSV (<code>avanzamento_percentuale</code>).
          </p>
        </div>
      </div>

      <div className="dashboard-box" style={{ marginBottom: 20 }}>
        <h2 style={{ marginTop: 0, fontSize: 16 }}>Gerarchia suggerita dei piani</h2>
        <ul style={{ margin: 0, paddingLeft: 20, fontSize: 14, color: "#334155", lineHeight: 1.65 }}>
          <li>
            <strong>Base</strong> — ordini a cassa, stampa comanda riepilogo ordine, gestione consegne.
          </li>
          <li>
            <strong>Pro</strong> — tutto il Base più <strong>ordini online</strong> (cliente finale).
          </li>
          <li>
            <strong>Enterprise</strong> — tutto il Pro più <strong>schermate tablet dedicate per ruoli operativi</strong> (cassa,
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

      <div className="sa-page-toolbar" style={{ marginBottom: 16 }}>
        <SaListSearchField
          id="sa-servizi-search"
          value={listQuery}
          onChange={setListQuery}
          placeholder="Cerca servizio, categoria, id, funzione…"
          resultsCount={servicesFiltered.length}
          totalCount={services.length}
        />
        <div className="sa-page-toolbar-actions">
          <input ref={importCsvRef} type="file" accept=".csv,text/csv" style={{ display: "none" }} onChange={onImportCsv} />
          <button type="button" className="btn-primary-dashboard" onClick={openAdd}>
            + Nuovo servizio
          </button>
          <button type="button" onClick={() => importCsvRef.current?.click()} style={{ ...btnSecondary, fontSize: 13 }}>
            Importa CSV
          </button>
          <button
            type="button"
            onClick={() => exportServiziCatalogCsv(services)}
            style={{ ...btnSecondary, fontSize: 13 }}
            title="Scarica CSV (separatore ;) incluso avanzamento_percentuale"
          >
            Esporta CSV
          </button>
          <button type="button" onClick={resetCatalog} style={{ ...btnSecondary, fontSize: 13 }}>
            Ripristina catalogo predefinito
          </button>
        </div>
      </div>

      <p style={{ fontSize: 13, color: "#64748b", marginBottom: 16 }}>
        Dati salvati in questo browser (localStorage). Totale voci: <strong>{services.length}</strong>.
      </p>

      {services.length > 0 && servicesFiltered.length === 0 ? (
        <p style={{ margin: "0 0 20px", fontSize: 14, color: "#64748b" }}>Nessun servizio corrisponde alla ricerca.</p>
      ) : null}

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
                  <th style={{ textAlign: "right", whiteSpace: "nowrap" }}>Avanz.</th>
                  <th style={{ textAlign: "right", width: 260 }}>Azioni</th>
                </tr>
              </thead>
              <tbody>
                {items.map((s) => (
                  <tr key={s.id} style={{ opacity: s.attivo === false ? 0.65 : 1 }}>
                    <td style={{ fontWeight: 600, verticalAlign: "top" }}>
                      <button
                        type="button"
                        onClick={() => navigate(`/superadmin/servizi/${encodeURIComponent(s.id)}`)}
                        style={{
                          background: "none",
                          border: "none",
                          padding: 0,
                          margin: 0,
                          font: "inherit",
                          fontWeight: 600,
                          color: "#c2410c",
                          cursor: "pointer",
                          textAlign: "left",
                          textDecoration: "underline",
                        }}
                        title="Scheda implementazione e piani"
                      >
                        {s.nome}
                      </button>
                    </td>
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
                    <td style={{ textAlign: "right", fontWeight: 600, color: "#64748b", verticalAlign: "top" }}>
                      {Number(s.avanzamentoPercentuale) || 0}%
                    </td>
                    <td style={{ textAlign: "right", verticalAlign: "top" }}>
                      <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 8 }}>
                        <label style={{ display: "inline-flex", alignItems: "center", cursor: "pointer" }} title={s.attivo === false ? "Servizio disattivato" : "Servizio attivo"}>
                          <input
                            type="checkbox"
                            checked={s.attivo !== false}
                            onChange={() => toggleServiceAttivo(s.id)}
                            style={{ width: 16, height: 16 }}
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() => navigate(`/superadmin/servizi/${encodeURIComponent(s.id)}`)}
                          style={{ ...btnSecondary, fontSize: 12, padding: "6px 12px" }}
                          title="Dettaglio sviluppo / route"
                        >
                          Scheda
                        </button>
                      <button
                        type="button"
                        onClick={() => openEdit(s)}
                          style={{ ...btnSecondary, fontSize: 12, padding: "6px 12px" }}
                      >
                        Modifica
                      </button>
                        <button
                          type="button"
                          onClick={() => remove(s)}
                          style={{ ...btnSecondary, fontSize: 12, padding: "6px 10px", color: "#b91c1c", borderColor: "#fecaca" }}
                          title="Elimina servizio"
                        >
                          ✕
                        </button>
                      </div>
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
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <input
                id="svc-attivo"
                type="checkbox"
                checked={modal.attivo !== false}
                onChange={(e) => setModal((m) => (m ? { ...m, attivo: e.target.checked } : m))}
                style={{ width: 16, height: 16 }}
              />
              <label htmlFor="svc-attivo" style={{ fontSize: 13, color: "#334155", cursor: "pointer" }}>
                Servizio attivo
              </label>
            </div>
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
              Avanzamento sviluppo (0–100 %)
            </label>
            <input
              type="number"
              min={0}
              max={100}
              step={1}
              value={modal.avanzamentoPercentuale ?? 0}
              onChange={(e) => setModal((m) => (m ? { ...m, avanzamentoPercentuale: e.target.value } : m))}
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
