import { useState, useEffect, useMemo, useRef } from "react";
import { Link } from "react-router-dom";
import Modal from "@/components/dashboard/Modal";
import {
  buildDefaultPlans,
  defaultInclusioni,
  displayPrezzoForPlan,
  inclusioniFromIds,
  inclusioniIncluded,
  formatValiditaMesiLabel,
  loadPlansFromStorage,
  normalizePlan,
  savePlansToStorage,
} from "@/features/superadmin/catalog/plansStorage";
import {
  annualTotalFromMonthlyEuro,
  formatEuro,
  formatEuroMonth,
  loadServicesCatalog,
  sumMonthlyFromInclusioni,
} from "@/features/superadmin/catalog/servicesStorage";
import { exportPianiCsv } from "@/features/superadmin/utils/exportSuperadminCsv";
import { mergePianiImport, parsePianiCsv } from "@/features/superadmin/utils/parsePianiCsv";

function uid(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

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

export default function Piani() {
  const [services] = useState(() => loadServicesCatalog());
  const [piani, setPiani] = useState(() => {
    const sv = loadServicesCatalog();
    return loadPlansFromStorage(sv) ?? buildDefaultPlans(sv).map((p) => normalizePlan(p, sv));
  });
  const [planModalOpen, setPlanModalOpen] = useState(false);
  const [planModalMode, setPlanModalMode] = useState("add");
  const [draft, setDraft] = useState(null);
  const [modalError, setModalError] = useState(null);
  const [importPianiError, setImportPianiError] = useState(null);
  const filePianiRef = useRef(null);

  useEffect(() => {
    savePlansToStorage(piani);
  }, [piani]);

  useEffect(() => {
    setPiani((prev) => prev.map((p) => normalizePlan(p, services)));
  }, [services]);

  const draftInclusioni = draft?.inclusioni || defaultInclusioni(services);
  const computedMonthly = useMemo(
    () => sumMonthlyFromInclusioni(draftInclusioni, services),
    [draftInclusioni, services],
  );

  const toggleInclusione = (serviceId) => {
    setDraft((d) => {
      if (!d) return d;
      const inc = { ...defaultInclusioni(services), ...(d.inclusioni || {}) };
      inc[serviceId] = !inc[serviceId];
      return {
        ...d,
        inclusioni: inc,
        prezzo: formatEuroMonth(sumMonthlyFromInclusioni(inc, services)),
      };
    });
  };

  const openAddModal = () => {
    setModalError(null);
    const inc = defaultInclusioni(services);
    const prezzo = formatEuroMonth(sumMonthlyFromInclusioni(inc, services));
    setDraft(
      normalizePlan(
        {
          id: uid("p"),
          nome: "",
          prezzo,
          descrizione: "",
          attivo: true,
          validitaMesi: 1,
          scontoAbbonamentoAnnualePercent: 12,
          inclusioni: inc,
        },
        services,
      ),
    );
    setPlanModalMode("add");
    setPlanModalOpen(true);
  };

  const openEditModal = (p) => {
    setModalError(null);
    setDraft(normalizePlan({ ...p }, services));
    setPlanModalMode("edit");
    setPlanModalOpen(true);
  };

  const closePlanModal = () => {
    setPlanModalOpen(false);
    setDraft(null);
    setModalError(null);
  };

  const saveDraft = () => {
    if (!draft || !draft.nome.trim()) {
      setModalError("Inserisci il nome del piano.");
      return;
    }
    setModalError(null);
    const validitaMesi =
      draft.validitaMesi === "" || draft.validitaMesi == null
        ? 1
        : Math.max(1, Math.floor(Number(draft.validitaMesi)) || 1);
    const scontoAbbonamentoAnnualePercent = Math.min(
      100,
      Math.max(0, Number(String(draft.scontoAbbonamentoAnnualePercent ?? "").replace(",", ".")) || 0),
    );
    const inc = { ...defaultInclusioni(services), ...(draft.inclusioni || {}) };
    const prezzoFinale = formatEuroMonth(sumMonthlyFromInclusioni(inc, services));

    const saved = normalizePlan(
      {
        ...draft,
        validitaMesi,
        scontoAbbonamentoAnnualePercent,
        prezzo: prezzoFinale,
        inclusioni: inc,
      },
      services,
    );
    if (planModalMode === "add") {
      setPiani((prev) => [saved, ...prev]);
    } else {
      setPiani((prev) => prev.map((p) => (p.id === saved.id ? saved : p)));
    }
    closePlanModal();
  };

  const updateDraftField = (field, value) => {
    setDraft((d) => (d ? { ...d, [field]: value } : d));
  };

  const togglePlanAttivo = (id) => {
    setPiani((prev) =>
      prev.map((p) => (p.id === id ? normalizePlan({ ...p, attivo: !p.attivo }, services) : p)),
    );
  };

  const removePlan = (id) => {
    if (!window.confirm("Eliminare questo piano dall'elenco?")) return;
    setPiani((prev) => prev.filter((p) => p.id !== id));
    if (draft?.id === id) closePlanModal();
  };

  const onImportPianiCsv = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setImportPianiError(null);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const sv = loadServicesCatalog();
        const parsed = parsePianiCsv(String(reader.result || ""), sv);
        if (!parsed.length) {
          setImportPianiError("Nessuna riga valida nel CSV (serve colonna id e almeno una riga dati).");
          e.target.value = "";
          return;
        }
        setPiani((prev) => mergePianiImport(prev, parsed).map((p) => normalizePlan(p, sv)));
      } catch (err) {
        setImportPianiError(err?.message ?? "Import CSV non riuscito.");
      }
      e.target.value = "";
    };
    reader.onerror = () => {
      setImportPianiError("Lettura file non riuscita.");
      e.target.value = "";
    };
    reader.readAsText(f, "UTF-8");
  };

  const inclusioniCount = useMemo(() => {
    return services.filter((s) => draftInclusioni[s.id]).length;
  }, [draftInclusioni, services]);

  const modalTitle = planModalMode === "add" ? "Nuovo piano" : "Modifica piano";
  const noServices = services.length === 0;

  return (
    <>
      <header className="sa-page-header" style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", justifyContent: "space-between", gap: 16, maxWidth: "100%" }}>
        <div>
          <p className="sa-page-kicker">Super Admin · commerciale</p>
          <h1 className="dashboard-page-title sa-page-title">Piani e listini</h1>
          <p className="sa-page-lede">Componi i bundle vendibili a partire dal catalogo servizi (prezzi in localStorage).</p>
        </div>
        <Link to="/superadmin/servizi" className="btn-primary-dashboard" style={{ textDecoration: "none", alignSelf: "center" }}>
          Catalogo servizi →
        </Link>
      </header>

      <div className="dashboard-box" style={{ marginBottom: 24 }}>
        <h2 style={{ marginTop: 0, fontSize: 16 }}>Come funziona</h2>
        <p style={{ margin: "0 0 8px", fontSize: 14, color: "#555", lineHeight: 1.55 }}>
          Il <Link to="/superadmin/servizi">catalogo servizi</Link> definisce ogni modulo, le funzioni incluse e il{" "}
          <strong>prezzo base mensile</strong>. Qui componi i <strong>piani</strong> (Base, Pro, Enterprise, Full, Su misura
          o personalizzati): per ogni piano selezioni i servizi inclusi; il <strong>canone mensile</strong> è la{" "}
          <strong>somma</strong> dei prezzi del catalogo per quei servizi.
        </p>
        <p style={{ margin: "0 0 8px", fontSize: 14, color: "#555", lineHeight: 1.55 }}>
          La <strong>validità listino</strong> si esprime in <strong>mesi di calendario</strong> (non in giorni fissi), in
          linea con rinnovi e fatturazione reale.
        </p>
        <p style={{ margin: 0, fontSize: 14, color: "#555", lineHeight: 1.55 }}>
          I dati sono salvati in questo browser (localStorage). Per uso multi-dispositivo servirà persistenza su database.
        </p>
      </div>

      <div style={{ marginBottom: 16, display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
        <button type="button" className="btn-primary-dashboard" onClick={openAddModal} disabled={noServices}>
          + Aggiungi piano
        </button>
        <button
          type="button"
          onClick={() => exportPianiCsv(piani, loadServicesCatalog())}
          style={{ ...btnSecondary, fontSize: 13 }}
          disabled={!piani.length}
          title="Scarica CSV (separatore ;) con inclusioni e canone calcolato"
        >
          Esporta piani CSV
        </button>
        <input
          ref={filePianiRef}
          type="file"
          accept=".csv,text/csv"
          style={{ display: "none" }}
          onChange={onImportPianiCsv}
        />
        <button
          type="button"
          onClick={() => filePianiRef.current?.click()}
          style={{ ...btnSecondary, fontSize: 13 }}
          disabled={noServices}
          title="Stesso formato dell’export: aggiorna o aggiunge piani per id; i piani non presenti nel file restano in elenco"
        >
          Importa piani CSV
        </button>
        {importPianiError ? (
          <span style={{ fontSize: 13, color: "#b91c1c", flex: "1 1 100%" }} role="alert">
            {importPianiError}
          </span>
        ) : null}
        {noServices && (
          <span style={{ fontSize: 13, color: "#b45309" }}>
            Carica il catalogo servizi dalla pagina Catalogo.
          </span>
        )}
      </div>

      <Modal open={planModalOpen && !!draft} onClose={closePlanModal} title={modalTitle} wide closeOnOverlayClick>
        <div
          style={{
            maxHeight: "min(78vh, 720px)",
            overflowY: "auto",
            paddingRight: 4,
          }}
        >
          <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Nome piano</label>
          <input
            type="text"
            value={draft?.nome ?? ""}
            onChange={(e) => {
              setModalError(null);
              updateDraftField("nome", e.target.value);
            }}
            placeholder="es. Pro, Enterprise"
            style={inputBase}
            autoFocus
          />
          {modalError && (
            <p style={{ margin: "-4px 0 12px", fontSize: 13, color: "#b91c1c" }} role="alert">
              {modalError}
            </p>
          )}

          <div
            style={{
              marginBottom: 16,
              padding: 12,
              background: "#f0fdf4",
              border: "1px solid #bbf7d0",
              borderRadius: 8,
            }}
          >
            <p style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 600, color: "#166534" }}>
              Totale mensile dai servizi selezionati
            </p>
            <p style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#14532d" }}>{formatEuroMonth(computedMonthly)}</p>
            <p style={{ margin: "8px 0 0", fontSize: 12, color: "#15803d" }}>
              Somma dei prezzi base del catalogo per le voci spuntate sotto ({inclusioniCount} servizi).
            </p>
          </div>

          <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
            Validità listino (mesi di calendario)
          </label>
          <input
            type="number"
            min={1}
            step={1}
            value={draft?.validitaMesi ?? 1}
            onChange={(e) => {
              const v = e.target.value;
              updateDraftField("validitaMesi", v === "" ? 1 : v);
            }}
            placeholder="es. 1"
            style={inputBase}
          />
          <p style={{ fontSize: 12, color: "#64748b", margin: "-8px 0 12px" }}>
            Un mese = <strong>mese solare</strong> (gennaio, febbraio, … con i loro giorni reali), non 30 giorni fissi.
            L&apos;<strong>abbonamento annuale</strong> del cliente (12 mesi + sconto) si imposta in{" "}
            <strong>Clienti → Abbonamento</strong>.
          </p>

          <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
            Sconto se abbonamento annuale (anticipo 12 mensilità) %
          </label>
          <input
            type="number"
            min={0}
            max={100}
            step={0.5}
            value={draft?.scontoAbbonamentoAnnualePercent ?? 0}
            onChange={(e) => updateDraftField("scontoAbbonamentoAnnualePercent", e.target.value)}
            style={inputBase}
          />
          <p style={{ fontSize: 12, color: "#64748b", margin: "-8px 0 12px" }}>
            Se il cliente paga <strong>un&apos;unica rata annuale</strong>, questo è lo sconto sul totale{" "}
            <strong>12 × canone mensile</strong> (indicativo commercialmente; il valore effettivo lo registri sul cliente).
          </p>
          {computedMonthly > 0 && Number(draft?.scontoAbbonamentoAnnualePercent) > 0 ? (
            <p style={{ fontSize: 12, color: "#166534", margin: "-4px 0 12px", fontWeight: 600 }}>
              Esempio annuale: {formatEuro(annualTotalFromMonthlyEuro(computedMonthly, draft.scontoAbbonamentoAnnualePercent))}{" "}
              /anno (al netto dello sconto) vs {formatEuroMonth(computedMonthly)} × 12.
            </p>
          ) : null}

          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
            <input
              type="checkbox"
              id="plan-modal-attivo"
              checked={draft?.attivo !== false}
              onChange={(e) => updateDraftField("attivo", e.target.checked)}
              style={{ width: 18, height: 18, flexShrink: 0 }}
            />
            <label htmlFor="plan-modal-attivo" style={{ fontSize: 14, cursor: "pointer", color: "#334155" }}>
              Piano abilitato (se disattivato non è disponibile per nuove sottoscrizioni)
            </label>
          </div>

          <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Descrizione (facoltativa)</label>
          <textarea
            value={draft?.descrizione ?? ""}
            onChange={(e) => updateDraftField("descrizione", e.target.value)}
            rows={2}
            style={{ ...inputBase, resize: "vertical", minHeight: 56 }}
          />

          <div
            style={{
              marginTop: 8,
              marginBottom: 12,
              paddingTop: 16,
              borderTop: "1px solid #e2e8f0",
            }}
          >
            <h4 style={{ margin: "0 0 4px", fontSize: 14, color: "#0f172a" }}>Servizi inclusi (dal catalogo)</h4>
            <p style={{ margin: "0 0 12px", fontSize: 13, color: "#64748b" }}>
              {inclusioniCount} selezionati su {services.length}. Accanto a ogni voce il prezzo base mensile.
            </p>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
                gap: 10,
              }}
            >
              {services.map((s) => (
                <label
                  key={s.id}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 10,
                    padding: "10px 12px",
                    border: "1px solid #e2e8f0",
                    borderRadius: 8,
                    cursor: "pointer",
                    background: draftInclusioni[s.id] ? "#fff7ed" : "#fff",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={!!draftInclusioni[s.id]}
                    onChange={() => toggleInclusione(s.id)}
                    style={{ marginTop: 3, width: 18, height: 18, flexShrink: 0 }}
                  />
                  <span style={{ fontSize: 14, color: "#334155", lineHeight: 1.45 }}>
                    <strong>{s.nome}</strong>
                    <span style={{ color: "#64748b", fontWeight: 500 }}> · {formatEuroMonth(s.prezzoMensile)}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <div
          style={{
            marginTop: 20,
            paddingTop: 16,
            borderTop: "1px solid #e2e8f0",
            display: "flex",
            justifyContent: "flex-end",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          <button type="button" onClick={closePlanModal} style={btnSecondary}>
            Annulla
          </button>
          <button type="button" className="btn-primary-dashboard" onClick={saveDraft}>
            Salva piano
          </button>
        </div>
      </Modal>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 20 }}>
        {piani.map((p) => {
          const included = inclusioniIncluded(p.inclusioni, services);
          const prezzoCard = displayPrezzoForPlan(p, services);
          return (
            <div
              id={`plan-card-${p.id}`}
              key={p.id}
              className="dashboard-box"
              style={{
                marginBottom: 0,
                opacity: p.attivo === false ? 0.88 : 1,
                borderStyle: p.attivo === false ? "dashed" : "solid",
                borderColor: p.attivo === false ? "#cbd5e1" : undefined,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h2 style={{ margin: "0 0 6px", color: "#d35400", fontSize: 18 }}>{p.nome}</h2>
                  {p.attivo === false && (
                    <span
                      style={{
                        display: "inline-block",
                        fontSize: 11,
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                        color: "#64748b",
                        background: "#f1f5f9",
                        padding: "2px 8px",
                        borderRadius: 4,
                        marginBottom: 8,
                      }}
                    >
                      Disabilitato
                    </span>
                  )}
                </div>
                <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                  <button type="button" style={{ ...btnSecondary, fontSize: 12, padding: "4px 10px" }} onClick={() => openEditModal(p)}>
                    Modifica
                  </button>
                  <button type="button" style={{ ...btnSecondary, fontSize: 12, padding: "4px 10px" }} onClick={() => removePlan(p.id)}>
                    Elimina
                  </button>
                </div>
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  marginBottom: 12,
                  padding: "8px 10px",
                  background: p.attivo === false ? "#f8fafc" : "#f0fdf4",
                  borderRadius: 6,
                  border: `1px solid ${p.attivo === false ? "#e2e8f0" : "#bbf7d0"}`,
                }}
              >
                <input
                  type="checkbox"
                  id={`attivo-${p.id}`}
                  checked={p.attivo !== false}
                  onChange={() => togglePlanAttivo(p.id)}
                  style={{ width: 18, height: 18, flexShrink: 0, cursor: "pointer" }}
                />
                <label htmlFor={`attivo-${p.id}`} style={{ fontSize: 13, cursor: "pointer", color: "#334155", flex: 1 }}>
                  Piano abilitato
                </label>
              </div>
              <p style={{ fontSize: 17, fontWeight: 700, margin: "0 0 4px", color: "#2c2c2c" }}>{prezzoCard}</p>
              <p style={{ fontSize: 12, color: "#64748b", margin: "0 0 8px" }}>
                Totale = somma dei servizi inclusi (prezzi del catalogo).
              </p>
              {p.validitaMesi != null && (
                <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 8px" }}>
                  Validità listino: <strong>{formatValiditaMesiLabel(p.validitaMesi)}</strong> (calendario)
                </p>
              )}
              {Number(p.scontoAbbonamentoAnnualePercent) > 0 && sumMonthlyFromInclusioni(p.inclusioni, services) > 0 ? (
                <p style={{ fontSize: 13, color: "#166534", margin: "0 0 8px" }}>
                  Annuale (indicativo): <strong>−{Number(p.scontoAbbonamentoAnnualePercent)}%</strong> sul totale 12 mesi →{" "}
                  <strong>
                    {formatEuro(
                      annualTotalFromMonthlyEuro(
                        sumMonthlyFromInclusioni(p.inclusioni, services),
                        p.scontoAbbonamentoAnnualePercent,
                      ),
                    )}
                    /anno
                  </strong>
                </p>
              ) : null}
              {p.descrizione && (
                <p style={{ fontSize: 14, color: "#555", margin: "0 0 12px" }}>{p.descrizione}</p>
              )}
              <p style={{ fontSize: 12, fontWeight: 600, color: "#334155", margin: "0 0 6px" }}>Include:</p>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 14, color: "#444" }}>
                {included.length === 0 ? (
                  <li style={{ color: "#94a3b8" }}>Nessun servizio selezionato</li>
                ) : (
                  included.map((sv) => (
                    <li key={sv.id}>
                      {sv.nome}
                      <span style={{ color: "#94a3b8", fontSize: 12 }}> ({formatEuroMonth(sv.prezzoMensile)})</span>
                    </li>
                  ))
                )}
              </ul>
            </div>
          );
        })}
      </div>
    </>
  );
}
