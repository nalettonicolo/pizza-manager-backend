import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import Modal from "@/components/dashboard/Modal";

const STORAGE_KEY_V2 = "pizzamanager_superadmin_plans_v2";
const STORAGE_KEY_V1 = "pizzamanager_superadmin_plans_v1";
const SERVICES_STORAGE_KEY = "pizzamanager_superadmin_services_v1";

/** Elenco iniziale servizi (stessi id della vecchia lista fissa → compatibilità dati salvati) */
const DEFAULT_SERVICES = [
  { id: "punti_vendita_multipli", nome: "Punti vendita multipli" },
  { id: "report_analisi", nome: "Report e analisi" },
  { id: "ruoli_permessi", nome: "Ruoli e permessi avanzati" },
  { id: "supporto_prioritario", nome: "Supporto prioritario" },
  { id: "menu_listini", nome: "Menu e listini avanzati" },
  { id: "ordini_online", nome: "Ordini online / cliente finale" },
  { id: "cassa_integrata", nome: "Cassa integrata" },
  { id: "api_integrazioni", nome: "API e integrazioni" },
  { id: "account_manager", nome: "Account manager dedicato" },
  { id: "sla_personalizzazioni", nome: "SLA e personalizzazioni" },
];

function uid(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function defaultInclusioni(services) {
  return Object.fromEntries((services || []).map((s) => [s.id, false]));
}

function loadServicesFromStorage() {
  try {
    const raw = localStorage.getItem(SERVICES_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length) {
        return parsed
          .filter((s) => s && typeof s.id === "string" && String(s.nome || "").trim())
          .map((s) => ({ id: s.id, nome: String(s.nome).trim() }));
      }
    }
  } catch {
    /* ignore */
  }
  return DEFAULT_SERVICES.map((s) => ({ ...s }));
}

function saveServicesToStorage(list) {
  try {
    localStorage.setItem(SERVICES_STORAGE_KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

const DEFAULT_PLANS = (services) => {
  const z = defaultInclusioni(services);
  return [
    {
      id: "seed_pro",
      nome: "Pro",
      prezzo: "29 €/mese",
      descrizione: "Per pizzerie che vogliono crescere: report, ruoli avanzati, multi-sede.",
      attivo: true,
      validitaGiorni: 30,
      inclusioni: {
        ...z,
        punti_vendita_multipli: true,
        report_analisi: true,
        ruoli_permessi: true,
        supporto_prioritario: true,
      },
    },
    {
      id: "seed_enterprise",
      nome: "Enterprise",
      prezzo: "Su misura",
      descrizione: "Gruppi e franchising: integrazioni, SLA e account dedicato.",
      attivo: true,
      validitaGiorni: 365,
      inclusioni: {
        ...z,
        punti_vendita_multipli: true,
        report_analisi: true,
        ruoli_permessi: true,
        supporto_prioritario: true,
        menu_listini: true,
        ordini_online: true,
        cassa_integrata: true,
        api_integrazioni: true,
        account_manager: true,
        sla_personalizzazioni: true,
      },
    },
  ];
};

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

const SUPERADMIN_NAV = [
  { to: "/superadmin/dashboard", label: "Riepilogo", description: "Torna alla home" },
  { to: "/superadmin/tenants", label: "Clienti", description: "Pizzerie registrate" },
  { to: "/superadmin/licenses", label: "Abbonamenti", description: "Stato licenze" },
  { to: "/superadmin/settings", label: "Impostazioni", description: "Configurazione" },
];

/** Legacy: etichette note per migrazione da funzionalita[] */
const LEGACY_LABEL_HINTS = DEFAULT_SERVICES.map((s) => ({ id: s.id, needle: s.nome.toLowerCase().slice(0, 12) }));

function migrateLegacyPlan(p, services) {
  const inc = defaultInclusioni(services);
  const lines = (p.funzionalita || []).map((s) => String(s).toLowerCase());
  for (const { id, needle } of LEGACY_LABEL_HINTS) {
    if (lines.some((line) => line.includes(needle) || line.includes(id.replace(/_/g, " ")))) {
      inc[id] = true;
    }
  }
  if (lines.some((l) => l.includes("pro") && l.includes("tutto"))) {
    services.forEach((s) => {
      inc[s.id] = true;
    });
  }
  const merged = { ...inc, ...(p.inclusioni || {}) };
  const out = defaultInclusioni(services);
  for (const s of services) {
    out[s.id] = merged[s.id] === true;
  }
  return {
    id: p.id,
    nome: p.nome ?? "",
    prezzo: p.prezzo ?? "",
    descrizione: p.descrizione ?? "",
    attivo: p.attivo === false ? false : true,
    validitaGiorni: p.validitaGiorni != null && p.validitaGiorni !== "" ? Number(p.validitaGiorni) : null,
    inclusioni: out,
  };
}

function normalizePlan(p, services) {
  const base = migrateLegacyPlan(p, services);
  if (typeof base.attivo !== "boolean") base.attivo = true;
  return base;
}

function loadPlansFromStorage(services) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_V2);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length) return parsed.map((p) => normalizePlan(p, services));
    }
    const rawV1 = localStorage.getItem(STORAGE_KEY_V1);
    if (rawV1) {
      const parsed = JSON.parse(rawV1);
      if (Array.isArray(parsed) && parsed.length) {
        const migrated = parsed.map((p) => migrateLegacyPlan(p, services));
        try {
          localStorage.setItem(STORAGE_KEY_V2, JSON.stringify(migrated));
        } catch {
          /* ignore */
        }
        return migrated;
      }
    }
  } catch {
    /* ignore */
  }
  return null;
}

function savePlansToStorage(list) {
  try {
    localStorage.setItem(STORAGE_KEY_V2, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

function inclusioniIncluded(inc, services) {
  if (!inc || !services?.length) return [];
  return services.filter((s) => inc[s.id] === true);
}

export default function Piani() {
  const [services, setServices] = useState(() => loadServicesFromStorage());
  const [piani, setPiani] = useState(() => {
    const sv = loadServicesFromStorage();
    return loadPlansFromStorage(sv) ?? DEFAULT_PLANS(sv).map((p) => normalizePlan(p, sv));
  });
  const [planModalOpen, setPlanModalOpen] = useState(false);
  const [planModalMode, setPlanModalMode] = useState("add");
  const [draft, setDraft] = useState(null);
  const [modalError, setModalError] = useState(null);

  const [serviceModal, setServiceModal] = useState(null);

  useEffect(() => {
    savePlansToStorage(piani);
  }, [piani]);

  useEffect(() => {
    saveServicesToStorage(services);
  }, [services]);

  /** Allinea inclusioni dei piani quando cambia il catalogo servizi (nuovi id o rinomina). */
  useEffect(() => {
    setPiani((prev) => prev.map((p) => normalizePlan(p, services)));
  }, [services]);

  const draftInclusioni = draft?.inclusioni || defaultInclusioni(services);

  const toggleInclusione = (serviceId) => {
    setDraft((d) => {
      if (!d) return d;
      const inc = { ...defaultInclusioni(services), ...(d.inclusioni || {}) };
      inc[serviceId] = !inc[serviceId];
      return { ...d, inclusioni: inc };
    });
  };

  const openAddModal = () => {
    setModalError(null);
    setDraft(
      normalizePlan(
        {
          id: uid("p"),
          nome: "",
          prezzo: "",
          descrizione: "",
          attivo: true,
          validitaGiorni: 30,
          inclusioni: defaultInclusioni(services),
        },
        services,
      ),
    );
    setPlanModalMode("add");
    setPlanModalOpen(true);
  };

  const openEditModal = (p) => {
    setModalError(null);
    setDraft(normalizePlan(p, services));
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
    const validitaGiorni =
      draft.validitaGiorni === "" || draft.validitaGiorni == null
        ? null
        : Math.max(1, Math.floor(Number(draft.validitaGiorni)) || 1);
    const saved = normalizePlan(
      {
        ...draft,
        validitaGiorni,
        inclusioni: { ...defaultInclusioni(services), ...(draft.inclusioni || {}) },
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
    if (!window.confirm("Eliminare questo piano dall’elenco?")) return;
    setPiani((prev) => prev.filter((p) => p.id !== id));
    if (draft?.id === id) closePlanModal();
  };

  const addService = () => {
    const nome = window.prompt("Nome del nuovo servizio:");
    if (nome == null) return;
    const t = nome.trim();
    if (!t) return;
    setServices((prev) => [...prev, { id: uid("svc"), nome: t }]);
  };

  const openEditService = (s) => {
    setServiceModal({ id: s.id, nome: s.nome });
  };

  const saveServiceEdit = () => {
    if (!serviceModal) return;
    const nome = serviceModal.nome?.trim();
    if (!nome) return;
    setServices((prev) => prev.map((s) => (s.id === serviceModal.id ? { ...s, nome } : s)));
    setServiceModal(null);
  };

  const removeService = (s) => {
    if (!window.confirm(`Rimuovere il servizio "${s.nome}"? Verrà tolto da tutti i piani.`)) return;
    setServices((prev) => prev.filter((x) => x.id !== s.id));
    setDraft((d) => {
      if (!d) return d;
      const inc = { ...d.inclusioni };
      delete inc[s.id];
      return { ...d, inclusioni: inc };
    });
    if (serviceModal?.id === s.id) setServiceModal(null);
  };

  const inclusioniCount = useMemo(() => {
    return services.filter((s) => draftInclusioni[s.id]).length;
  }, [draftInclusioni, services]);

  const modalTitle = planModalMode === "add" ? "Nuovo piano" : "Modifica piano";

  const noServices = services.length === 0;

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
          Prima definisci i <strong>servizi</strong> disponibili (catalogo sotto). Poi, per ogni <strong>piano</strong>, scegli
          quali servizi sono inclusi: ogni piano ha la propria combinazione di inclusioni.
        </p>
        <p style={{ margin: 0, fontSize: 14, color: "#555", lineHeight: 1.55 }}>
          I dati sono salvati in questo browser (localStorage). Per uso multi-dispositivo servirà persistenza su database.
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

      <div className="dashboard-box" style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 17, color: "#0f172a" }}>Catalogo servizi</h2>
          <button type="button" className="btn-primary-dashboard" onClick={addService}>
            + Aggiungi servizio
          </button>
        </div>
        <p style={{ margin: "0 0 16px", fontSize: 14, color: "#64748b" }}>
          Questi sono i servizi che puoi includere nei piani. Modifica il nome o elimina un servizio: l’elenco dei piani si
          aggiorna di conseguenza.
        </p>
        {noServices ? (
          <p style={{ color: "#94a3b8", fontSize: 14 }}>Nessun servizio. Aggiungine almeno uno.</p>
        ) : (
          <div className="dashboard-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Servizio</th>
                  <th style={{ textAlign: "right", width: 200 }}>Azioni</th>
                </tr>
              </thead>
              <tbody>
                {services.map((s) => (
                  <tr key={s.id}>
                    <td style={{ fontWeight: 500 }}>{s.nome}</td>
                    <td style={{ textAlign: "right" }}>
                      <button
                        type="button"
                        onClick={() => openEditService(s)}
                        style={{ ...btnSecondary, fontSize: 12, padding: "6px 12px", marginRight: 8 }}
                      >
                        Rinomina
                      </button>
                      <button type="button" onClick={() => removeService(s)} style={{ ...btnSecondary, fontSize: 12, padding: "6px 12px" }}>
                        Elimina
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={!!serviceModal} onClose={() => setServiceModal(null)} title="Rinomina servizio" closeOnOverlayClick>
        {serviceModal && (
          <>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Nome</label>
            <input
              type="text"
              value={serviceModal.nome}
              onChange={(e) => setServiceModal((m) => (m ? { ...m, nome: e.target.value } : m))}
              style={inputBase}
            />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
              <button type="button" onClick={() => setServiceModal(null)} style={btnSecondary}>
                Annulla
              </button>
              <button type="button" className="btn-primary-dashboard" onClick={saveServiceEdit}>
                Salva
              </button>
            </div>
          </>
        )}
      </Modal>

      <div style={{ marginBottom: 16 }}>
        <button type="button" className="btn-primary-dashboard" onClick={openAddModal} disabled={noServices}>
          + Aggiungi piano
        </button>
        {noServices && (
          <span style={{ marginLeft: 12, fontSize: 13, color: "#b45309" }}>Aggiungi almeno un servizio al catalogo.</span>
        )}
      </div>

      <Modal
        open={planModalOpen && !!draft}
        onClose={closePlanModal}
        title={modalTitle}
        wide
        closeOnOverlayClick
      >
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

          <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Prezzo</label>
          <input
            type="text"
            value={draft?.prezzo ?? ""}
            onChange={(e) => updateDraftField("prezzo", e.target.value)}
            placeholder="es. 29 €/mese"
            style={inputBase}
          />

          <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Validità (giorni)</label>
          <input
            type="number"
            min={1}
            step={1}
            value={draft?.validitaGiorni ?? ""}
            onChange={(e) => {
              const v = e.target.value;
              updateDraftField("validitaGiorni", v === "" ? null : v);
            }}
            placeholder="es. 30"
            style={inputBase}
          />
          <p style={{ fontSize: 12, color: "#64748b", margin: "-8px 0 12px" }}>
            Durata dell’abbonamento o del periodo di fatturazione, in giorni.
          </p>

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
            <h4 style={{ margin: "0 0 4px", fontSize: 14, color: "#0f172a" }}>Cosa include (dal catalogo servizi)</h4>
            <p style={{ margin: "0 0 12px", fontSize: 13, color: "#64748b" }}>
              Seleziona i servizi inclusi in questo piano ({inclusioniCount} selezionati su {services.length} disponibili).
            </p>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
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
                  <span style={{ fontSize: 14, color: "#334155", lineHeight: 1.4 }}>{s.nome}</span>
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
              <p style={{ fontSize: 17, fontWeight: 700, margin: "0 0 8px", color: "#2c2c2c" }}>{p.prezzo || "—"}</p>
              {p.validitaGiorni != null && (
                <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 8px" }}>
                  Validità: <strong>{p.validitaGiorni} giorni</strong>
                </p>
              )}
              {p.descrizione && (
                <p style={{ fontSize: 14, color: "#555", margin: "0 0 12px" }}>{p.descrizione}</p>
              )}
              <p style={{ fontSize: 12, fontWeight: 600, color: "#334155", margin: "0 0 6px" }}>Include:</p>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 14, color: "#444" }}>
                {included.length === 0 ? (
                  <li style={{ color: "#94a3b8" }}>Nessun servizio selezionato</li>
                ) : (
                  included.map((sv) => (
                    <li key={sv.id}>{sv.nome}</li>
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
