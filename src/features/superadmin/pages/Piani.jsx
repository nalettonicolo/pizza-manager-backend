import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import Modal from "@/components/dashboard/Modal";
import {
  IDS_BASE,
  IDS_ENTERPRISE,
  IDS_FULL,
  IDS_PRO,
} from "@/features/superadmin/catalog/defaultCatalog";
import {
  formatEuroMonth,
  loadServicesCatalog,
  sumMonthlyFromInclusioni,
} from "@/features/superadmin/catalog/servicesStorage";

const STORAGE_KEY_V2 = "pizzamanager_superadmin_plans_v2";
const STORAGE_KEY_V1 = "pizzamanager_superadmin_plans_v1";

function uid(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function defaultInclusioni(services) {
  return Object.fromEntries((services || []).map((s) => [s.id, false]));
}

function inclusioniFromIds(services, ids) {
  const set = new Set(ids);
  return Object.fromEntries((services || []).map((s) => [s.id, set.has(s.id)]));
}

/** Canone: somma dei prezzi base dei servizi inclusi (unica fonte). */
function displayPrezzoForPlan(p, services) {
  return formatEuroMonth(sumMonthlyFromInclusioni(p.inclusioni, services));
}

function buildDefaultPlans(services) {
  const z = defaultInclusioni(services);
  const sumForIds = (ids) => sumMonthlyFromInclusioni(inclusioniFromIds(services, ids), services);

  return [
    {
      id: "seed_base",
      nome: "Base",
      prezzo: formatEuroMonth(sumForIds(IDS_BASE)),
      descrizione: "Ordini a cassa, stampa comanda riepilogo ordine e gestione consegne.",
      attivo: true,
      validitaGiorni: 30,
      inclusioni: { ...z, ...inclusioniFromIds(services, IDS_BASE) },
    },
    {
      id: "seed_pro",
      nome: "Pro",
      prezzo: formatEuroMonth(sumForIds(IDS_PRO)),
      descrizione: "Include tutto il Base più ordini online (cliente finale).",
      attivo: true,
      validitaGiorni: 30,
      inclusioni: { ...z, ...inclusioniFromIds(services, IDS_PRO) },
    },
    {
      id: "seed_enterprise",
      nome: "Enterprise",
      prezzo: formatEuroMonth(sumForIds(IDS_ENTERPRISE)),
      descrizione: "Include tutto il Pro più interfacce tablet dedicate per ruoli operativi (cassa, bancone, cucina, delivery, pizzaiolo).",
      attivo: true,
      validitaGiorni: 30,
      inclusioni: { ...z, ...inclusioniFromIds(services, IDS_ENTERPRISE) },
    },
    {
      id: "seed_full",
      nome: "Full",
      prezzo: formatEuroMonth(sumForIds(IDS_FULL)),
      descrizione: "Tutti i servizi del catalogo.",
      attivo: true,
      validitaGiorni: 365,
      inclusioni: { ...z, ...inclusioniFromIds(services, IDS_FULL) },
    },
    {
      id: "seed_su_misura",
      nome: "Su misura",
      prezzo: formatEuroMonth(0),
      descrizione: "Il cliente sceglie i servizi dal catalogo; il canone è la somma dei servizi selezionati.",
      attivo: true,
      validitaGiorni: 30,
      inclusioni: { ...z },
    },
  ];
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

const SUPERADMIN_NAV = [
  { to: "/superadmin/dashboard", label: "Riepilogo", description: "Torna alla home" },
  { to: "/superadmin/tenants", label: "Clienti", description: "Pizzerie registrate" },
  { to: "/superadmin/servizi", label: "Catalogo servizi", description: "Servizi e prezzi" },
  { to: "/superadmin/deploy-clienti", label: "Deploy siti clienti", description: "Pubblicazione e go-live" },
  { to: "/superadmin/licenses", label: "Abbonamenti", description: "Stato licenze" },
  { to: "/superadmin/settings", label: "Impostazioni", description: "Configurazione" },
];

const LEGACY_LABEL_HINTS = [
  { id: "ordini_online", needle: "ordini online" },
  { id: "tablet_ruoli", needle: "tablet" },
  { id: "report_analisi", needle: "report" },
  { id: "multi_sede", needle: "multipli" },
  { id: "ruoli_avanzati", needle: "ruoli" },
  { id: "supporto_prioritario", needle: "supporto" },
  { id: "menu_listini", needle: "menu" },
  { id: "api_integrazioni", needle: "api" },
  { id: "account_manager", needle: "account" },
  { id: "sla_personalizzazioni", needle: "sla" },
];

function migrateLegacyPlan(p, services) {
  const inc = defaultInclusioni(services);
  const lines = (p.funzionalita || []).map((s) => String(s).toLowerCase());
  for (const { id, needle } of LEGACY_LABEL_HINTS) {
    if (lines.some((line) => line.includes(needle) || line.includes(id.replace(/_/g, " ")))) {
      if (services.some((s) => s.id === id)) inc[id] = true;
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
  const prezzoDaSomma = formatEuroMonth(sumMonthlyFromInclusioni(out, services));
  return {
    id: p.id,
    nome: p.nome ?? "",
    prezzo: prezzoDaSomma,
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
  const [services] = useState(() => loadServicesCatalog());
  const [piani, setPiani] = useState(() => {
    const sv = loadServicesCatalog();
    return loadPlansFromStorage(sv) ?? buildDefaultPlans(sv).map((p) => normalizePlan(p, sv));
  });
  const [planModalOpen, setPlanModalOpen] = useState(false);
  const [planModalMode, setPlanModalMode] = useState("add");
  const [draft, setDraft] = useState(null);
  const [modalError, setModalError] = useState(null);

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
          validitaGiorni: 30,
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
    const validitaGiorni =
      draft.validitaGiorni === "" || draft.validitaGiorni == null
        ? null
        : Math.max(1, Math.floor(Number(draft.validitaGiorni)) || 1);
    const inc = { ...defaultInclusioni(services), ...(draft.inclusioni || {}) };
    const prezzoFinale = formatEuroMonth(sumMonthlyFromInclusioni(inc, services));

    const saved = normalizePlan(
      {
        ...draft,
        validitaGiorni,
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
      <div className="dashboard-page-header" style={{ flexWrap: "wrap", gap: 12 }}>
        <h1 className="dashboard-page-title">Piani di abbonamento</h1>
        <Link to="/superadmin/servizi" className="btn-primary-dashboard" style={{ textDecoration: "none" }}>
          Catalogo servizi e prezzi →
        </Link>
      </div>

      <div className="dashboard-box" style={{ marginBottom: 24, maxWidth: 800 }}>
        <h2 style={{ marginTop: 0, fontSize: 16 }}>Come funziona</h2>
        <p style={{ margin: "0 0 8px", fontSize: 14, color: "#555", lineHeight: 1.55 }}>
          Il <Link to="/superadmin/servizi">catalogo servizi</Link> definisce ogni modulo, le funzioni incluse e il{" "}
          <strong>prezzo base mensile</strong>. Qui componi i <strong>piani</strong> (Base, Pro, Enterprise, Full, Su misura
          o personalizzati): per ogni piano selezioni i servizi inclusi; il <strong>canone mensile</strong> è la{" "}
          <strong>somma</strong> dei prezzi del catalogo per quei servizi.
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

      <div style={{ marginBottom: 16 }}>
        <button type="button" className="btn-primary-dashboard" onClick={openAddModal} disabled={noServices}>
          + Aggiungi piano
        </button>
        {noServices && (
          <span style={{ marginLeft: 12, fontSize: 13, color: "#b45309" }}>
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
            Durata dell&apos;abbonamento o del periodo di fatturazione, in giorni.
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
