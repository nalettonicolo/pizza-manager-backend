import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { serviziIdsIncludedForPiano } from "@/app/hooks/useTenantServizi";
import TenantServiziPlanFields from "@/features/superadmin/components/TenantServiziPlanFields";
import { defaultInclusioni, loadPlansResolved } from "@/features/superadmin/catalog/plansStorage";
import { loadServicesCatalog } from "@/features/superadmin/catalog/servicesStorage";
import {
  listArchivioPasswordAccounts,
  upsertStaffPasswordNote,
} from "@/features/admin/services/adminService";
import {
  createTenant,
  getSubscriptionRow,
  getTenants,
  updateTenant,
} from "@/features/superadmin/services/superadminService";
import { labelFromEmailPrefix } from "@/utils/emailDisplayLabel";
import { pianoDisplayLabel, tenantListinoLabel } from "@/features/superadmin/utils/pianoLabels";
import SaListSearchField from "@/features/superadmin/components/SaListSearchField";
import { normalizeListSearchQuery, rowMatchesListSearch } from "@/utils/listSearchFilter";

const PIANO_OPTIONS = [
  { value: "TRIAL", label: "Prova (14 gg) — bundle come Pro" },
  { value: "FREE", label: "Gratuito — solo bundle Base" },
  { value: "PRO", label: "Pro" },
  { value: "ENTERPRISE", label: "Enterprise" },
];

const MODAL_TABS = [
  { id: "anagrafica", label: "Anagrafica" },
  { id: "servizi", label: "Contratto e servizi" },
  { id: "fiscale", label: "Fiscale e contatti" },
  { id: "canone", label: "Canone servizio" },
  { id: "account", label: "Account attivi" },
];

function slugify(s) {
  return s
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

function toDateInputValue(v) {
  if (v == null || v === "") return "";
  const d = typeof v === "string" ? new Date(v) : v;
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function emptyModal(mode, services, reloadInclusioniFromPiano) {
  return {
    mode,
    nome: "",
    slug: "",
    piano: "TRIAL",
    attivo: true,
    partita_iva: "",
    email_fatturazione: "",
    pec: "",
    codice_univoco_sdi: "",
    addebito_automatico_mensile: false,
    data_attivazione_abbonamento: "",
    sconto_percentuale: "0",
    sconto_importo_euro: "0",
    prova_valida_fino: "",
    serviziPersonalizzati: false,
    pianoTemplateId: "",
    pianoCommercialeNome: "",
    inclusioni: reloadInclusioniFromPiano("TRIAL", services),
    parametriOperativiBase: {},
    abbonamentoCicloGiorni: 30,
    abbonamentoScontoAnnualePercent: "",
    sito_web_cliente: "",
    public_domain: "",
    public_domain_status: "none",
  };
}

function tenantToModal(t, mode, services, reloadInclusioniFromPiano) {
  const po = t.parametri_operativi && typeof t.parametri_operativi === "object" ? { ...t.parametri_operativi } : {};
  const serviziPersonalizzati = po.servizi_personalizzati === true;
  const ids = Array.isArray(po.servizi_abilitati) ? po.servizi_abilitati : [];
  let inclusioni;
  if (serviziPersonalizzati && ids.length) {
    inclusioni = defaultInclusioni(services);
    for (const id of ids) {
      if (Object.prototype.hasOwnProperty.call(inclusioni, id)) inclusioni[id] = true;
    }
  } else {
    inclusioni = reloadInclusioniFromPiano(t.piano, services);
  }
  return {
    mode,
    id: t.id,
    nome: t.nome ?? "",
    slug: t.slug ?? "",
    piano: t.piano ?? "TRIAL",
    attivo: !!t.attivo,
    partita_iva: t.partita_iva ?? "",
    email_fatturazione: t.email_fatturazione ?? "",
    pec: t.pec ?? "",
    codice_univoco_sdi: t.codice_univoco_sdi ?? "",
    addebito_automatico_mensile: !!t.addebito_automatico_mensile,
    data_attivazione_abbonamento: toDateInputValue(t.data_attivazione_abbonamento),
    sconto_percentuale:
      t.sconto_percentuale != null && t.sconto_percentuale !== ""
        ? String(t.sconto_percentuale)
        : "0",
    sconto_importo_euro:
      po.sconto_importo_euro != null && po.sconto_importo_euro !== ""
        ? String(po.sconto_importo_euro)
        : "0",
    prova_valida_fino: toDateInputValue(t.prova_valida_fino),
    serviziPersonalizzati,
    pianoTemplateId: "",
    pianoCommercialeNome: typeof po.piano_listino_nome === "string" ? po.piano_listino_nome.trim() : "",
    inclusioni,
    parametriOperativiBase: po,
    abbonamentoCicloGiorni: 30,
    abbonamentoScontoAnnualePercent: "",
    sito_web_cliente: t.sito_web_cliente ?? "",
    public_domain: t.public_domain ?? "",
    public_domain_status: t.public_domain_status ?? "none",
  };
}

function extractHostname(rawUrl) {
  const v = String(rawUrl || "").trim();
  if (!v) return "";
  const candidate = /^https?:\/\//i.test(v) ? v : `https://${v}`;
  try {
    const u = new URL(candidate);
    return String(u.hostname || "").trim().toLowerCase();
  } catch {
    return "";
  }
}

function CellEllipsis({ children, title }) {
  return (
    <td
      style={{
        maxWidth: 140,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        fontSize: 13,
        color: "#444",
      }}
      title={title ?? (typeof children === "string" ? children : undefined)}
    >
      {children}
    </td>
  );
}

export default function Tenants() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modal, setModal] = useState(null);
  const [saving, setSaving] = useState(false);
  const [modalTab, setModalTab] = useState("anagrafica");
  const [listQuery, setListQuery] = useState("");
  /** Modale Modifica cliente: staff + note archivio password (stessa tabella che vede Admin → Ruoli). */
  const [archivio, setArchivio] = useState({
    loading: false,
    error: null,
    ruoli: [],
    drafts: {},
    savingUserId: null,
  });

  const catalogServices = useMemo(() => loadServicesCatalog(), []);
  const commercialPlans = useMemo(() => {
    const { plans } = loadPlansResolved();
    return plans.filter((p) => p.attivo !== false);
  }, []);

  const filteredList = useMemo(() => {
    const q = normalizeListSearchQuery(listQuery);
    if (!q) return list;
    return list.filter((t) =>
      rowMatchesListSearch(q, [
        t.nome,
        t.slug,
        t.partita_iva,
        t.email_fatturazione,
        t.pec,
        t.codice_univoco_sdi,
        t.piano,
        pianoDisplayLabel(t.piano),
        tenantListinoLabel(t),
        t.attivo ? "attivo" : "disattivo",
        t.prova_valida_fino,
        t.created_at,
      ]),
    );
  }, [list, listQuery]);

  const reloadInclusioniFromPiano = useCallback((piano, services) => {
    const set = serviziIdsIncludedForPiano(piano);
    const z = defaultInclusioni(services);
    for (const id of set) {
      if (Object.prototype.hasOwnProperty.call(z, id)) z[id] = true;
    }
    return z;
  }, []);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getTenants();
      setList(data);
    } catch (err) {
      setError(err?.message ?? "Errore caricamento tenant");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!modal || modal.mode !== "edit" || !modal.id) {
      setArchivio({ loading: false, error: null, ruoli: [], drafts: {}, savingUserId: null });
      return undefined;
    }
    const tenantId = modal.id;
    let cancelled = false;
    (async () => {
      setArchivio({ loading: true, error: null, ruoli: [], drafts: {}, savingUserId: null });
      try {
        const { accounts, notesByUser } = await listArchivioPasswordAccounts(tenantId);
        if (cancelled) return;
        const drafts = {};
        for (const r of accounts || []) {
          drafts[r.user_id] = notesByUser[r.user_id] ?? "";
        }
        setArchivio({ loading: false, error: null, ruoli: accounts || [], drafts, savingUserId: null });
      } catch (err) {
        if (cancelled) return;
        setArchivio({
          loading: false,
          error: err?.message ?? "Impossibile caricare account o password archiviate.",
          ruoli: [],
          drafts: {},
          savingUserId: null,
        });
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `modal` cambia a ogni campo del form; serve solo tenant/mode
  }, [modal?.mode, modal?.id]);

  const saveArchivioNote = async (userId, text) => {
    const tid = modal?.id;
    if (!tid || !userId) return;
    setArchivio((a) => ({ ...a, savingUserId: userId }));
    try {
      await upsertStaffPasswordNote(tid, userId, text);
    } catch (err) {
      setError(err?.message ?? "Salvataggio password archivio non riuscito.");
      setArchivio((a) => ({ ...a, savingUserId: null }));
      return;
    }
    setArchivio((a) => ({ ...a, savingUserId: null }));
  };

  const openCreate = () => {
    setModalTab("anagrafica");
    setModal(emptyModal("create", catalogServices, reloadInclusioniFromPiano));
  };

  const openEdit = (t) => {
    setModalTab("anagrafica");
    const base = tenantToModal(t, "edit", catalogServices, reloadInclusioniFromPiano);
    setModal(base);
    void getSubscriptionRow(t.id).then((sub) => {
      if (!sub) return;
      setModal((m) => {
        if (!m || m.id !== t.id || m.mode !== "edit") return m;
        return {
          ...m,
          abbonamentoCicloGiorni: sub.ciclo_fatturazione_giorni ?? 30,
          abbonamentoScontoAnnualePercent:
            sub.sconto_annuale_percent != null && String(sub.sconto_annuale_percent).trim() !== ""
              ? String(sub.sconto_annuale_percent)
              : "",
        };
      });
    });
  };

  const closeModal = () => {
    setModal(null);
    setModalTab("anagrafica");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!modal) return;
    setSaving(true);
    try {
      const enabledIds = Object.entries(modal.inclusioni || {})
        .filter(([, v]) => v)
        .map(([id]) => id);
      const basePo = { ...(modal.parametriOperativiBase || {}) };
      const nextPo = {
        ...basePo,
        servizi_personalizzati: modal.serviziPersonalizzati,
        servizi_abilitati: modal.serviziPersonalizzati ? enabledIds : [],
      };
      if (modal.pianoCommercialeNome && String(modal.pianoCommercialeNome).trim()) {
        nextPo.piano_listino_nome = String(modal.pianoCommercialeNome).trim();
      } else {
        delete nextPo.piano_listino_nome;
      }

      const euroFisso = Math.max(
        0,
        Math.round((Number(String(modal.sconto_importo_euro ?? "").replace(",", ".")) || 0) * 100) / 100,
      );
      nextPo.sconto_importo_euro = euroFisso;

      const ciclo = Number(modal.abbonamentoCicloGiorni) === 365 ? 365 : 30;
      const payload = {
        nome: modal.nome,
        slug: modal.slug || slugify(modal.nome),
        piano: modal.piano,
        attivo: modal.attivo,
        partita_iva: modal.partita_iva,
        email_fatturazione: modal.email_fatturazione,
        pec: modal.pec,
        codice_univoco_sdi: modal.codice_univoco_sdi,
        addebito_automatico_mensile: modal.addebito_automatico_mensile,
        data_attivazione_abbonamento: modal.data_attivazione_abbonamento || null,
        sconto_percentuale: modal.sconto_percentuale,
        prova_valida_fino: modal.prova_valida_fino || null,
        parametri_operativi: nextPo,
        sito_web_cliente: modal.sito_web_cliente || null,
        public_domain: modal.public_domain || extractHostname(modal.sito_web_cliente) || null,
        public_domain_status: modal.public_domain_status || "none",
        abbonamento_ciclo_giorni: ciclo,
        abbonamento_sconto_annuale_percent:
          ciclo === 365 && String(modal.abbonamentoScontoAnnualePercent ?? "").trim() !== ""
            ? modal.abbonamentoScontoAnnualePercent
            : null,
      };
      if (modal.mode === "create") {
        await createTenant(payload);
      } else {
        await updateTenant(modal.id, payload);
      }
      closeModal();
      load();
    } catch (err) {
      setError(err?.message ?? "Errore salvataggio");
    } finally {
      setSaving(false);
    }
  };

  const setModalField = (field, value) => {
    setModal((m) => {
      if (!m) return m;
      const next = { ...m, [field]: value };
      if (field === "nome" && m.mode === "create") {
        next.slug = slugify(value);
      }
      if (field === "piano" && !m.serviziPersonalizzati && !m.pianoTemplateId) {
        next.inclusioni = reloadInclusioniFromPiano(value, catalogServices);
      }
      return next;
    });
  };

  const inputStyle = {
    width: "100%",
    padding: "8px 12px",
    border: "1px solid #cbd5e1",
    borderRadius: 8,
    boxSizing: "border-box",
    fontSize: 14,
    background: "#fff",
  };

  const labelStyle = { display: "block", fontSize: 12, fontWeight: 600, marginBottom: 6, color: "#475569" };

  if (loading) {
    return (
      <div className="dashboard-loading">
        <div className="skeleton" />
        <div className="skeleton-row" />
        <div className="skeleton-row" />
      </div>
    );
  }

  return (
    <>
      <header className="sa-page-header">
        <p className="sa-page-kicker">Super Admin · commerciale</p>
        <h1 className="dashboard-page-title sa-page-title">Clienti (tenant)</h1>
        <p className="sa-page-lede">
          Anagrafica pizzerie, livello contratto e — se serve — servizi personalizzati rispetto al listino.
        </p>
      </header>

      <div className="sa-page-toolbar">
        <SaListSearchField
          id="sa-tenants-search"
          value={listQuery}
          onChange={setListQuery}
          placeholder="Cerca per nome, slug, email, P.IVA, piano, listino…"
          resultsCount={filteredList.length}
          totalCount={list.length}
        />
        <div className="sa-page-toolbar-actions">
          <button type="button" className="btn-primary-dashboard" onClick={openCreate}>
            Nuovo cliente
          </button>
        </div>
      </div>

      {error && <div className="dashboard-error" style={{ marginBottom: 16 }}>{error}</div>}

      <div className="dashboard-table-wrap" style={{ overflowX: "auto" }}>
        <table style={{ minWidth: 960 }}>
          <thead>
            <tr>
              <th>Nome</th>
              <th>Slug</th>
              <th>P.IVA</th>
              <th>Email</th>
              <th>PEC</th>
              <th>Cod. univoco</th>
              <th>Addebito auto.</th>
              <th>Sconto %</th>
              <th>Contratto</th>
              <th>Listino</th>
              <th>Prova fino al</th>
              <th>Stato</th>
              <th>Creato</th>
              <th style={{ textAlign: "right" }}>Azioni</th>
            </tr>
          </thead>
          <tbody>
            {list.length === 0 ? (
              <tr>
                <td colSpan={14} style={{ padding: 32, textAlign: "center", color: "#666", fontSize: 14 }}>
                  Nessun cliente. Clicca &quot;Nuovo cliente&quot; per aggiungerne uno.
                </td>
              </tr>
            ) : filteredList.length === 0 ? (
              <tr>
                <td colSpan={14} style={{ padding: 32, textAlign: "center", color: "#666", fontSize: 14 }}>
                  Nessun risultato per la ricerca. Modifica o cancella il filtro nel campo di ricerca sopra.
                </td>
              </tr>
            ) : (
              filteredList.map((t) => (
                <tr key={t.id}>
                  <td style={{ fontWeight: 600, fontSize: 14 }}>{t.nome}</td>
                  <CellEllipsis title={t.slug}>{t.slug || "—"}</CellEllipsis>
                  <CellEllipsis title={t.partita_iva}>{t.partita_iva || "—"}</CellEllipsis>
                  <CellEllipsis title={t.email_fatturazione}>{t.email_fatturazione || "—"}</CellEllipsis>
                  <CellEllipsis title={t.pec}>{t.pec || "—"}</CellEllipsis>
                  <CellEllipsis title={t.codice_univoco_sdi}>{t.codice_univoco_sdi || "—"}</CellEllipsis>
                  <td style={{ fontSize: 13 }}>
                    {t.addebito_automatico_mensile ? (
                      <span className="badge badge-success">Sì</span>
                    ) : (
                      <span className="badge badge-neutral">No</span>
                    )}
                  </td>
                  <td style={{ fontSize: 13, color: "#444" }}>
                    {(() => {
                      const po =
                        t.parametri_operativi && typeof t.parametri_operativi === "object"
                          ? t.parametri_operativi
                          : {};
                      const euro = Number(po.sconto_importo_euro) || 0;
                      const pct = t.sconto_percentuale != null && Number(t.sconto_percentuale) > 0;
                      const bits = [];
                      if (pct) bits.push(`${Number(t.sconto_percentuale)}%`);
                      if (euro > 0) bits.push(`−${euro} €`);
                      return bits.length ? bits.join(" · ") : "—";
                    })()}
                  </td>
                  <td style={{ fontSize: 13 }}>{pianoDisplayLabel(t.piano)}</td>
                  <td style={{ fontSize: 13, color: "#64748b" }}>{tenantListinoLabel(t) ?? "—"}</td>
                  <td style={{ color: "#666", fontSize: 13 }}>
                    {t.prova_valida_fino
                      ? new Date(t.prova_valida_fino + "T12:00:00").toLocaleDateString("it-IT")
                      : "—"}
                  </td>
                  <td>
                    <span className={t.attivo ? "badge badge-success" : "badge badge-neutral"}>
                      {t.attivo ? "Attivo" : "Disattivo"}
                    </span>
                  </td>
                  <td style={{ color: "#666", fontSize: 13 }}>
                    {t.created_at ? new Date(t.created_at).toLocaleDateString("it-IT") : "—"}
                  </td>
                  <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                    <Link to={`/superadmin/tenants/${t.id}/archivio-password`} className="sa-table-action">
                      Archivio password
                    </Link>
                    <button type="button" onClick={() => openEdit(t)} className="sa-table-action" style={{ marginLeft: 8 }}>
                      Modifica
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {modal && (
        <div className="sa-modal-overlay" role="presentation">
          <div
            className="dashboard-box sa-modal-panel"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-labelledby="sa-tenant-modal-title"
          >
            <h2 id="sa-tenant-modal-title" className="sa-modal-title">
              {modal.mode === "create" ? "Nuovo cliente" : "Modifica cliente"}
            </h2>
            <p className="sa-modal-subtitle">
              Struttura cliente a finestre: anagrafica, servizi, fiscale, canone e account attivi.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
              {MODAL_TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={modalTab === t.id ? "btn-primary-dashboard" : "sa-btn-ghost"}
                  onClick={() => setModalTab(t.id)}
                  style={{ padding: "8px 12px" }}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <form onSubmit={handleSubmit} className="sa-modal-form">
              {modalTab === "anagrafica" ? (
                <section className="sa-form-section">
                <h3 className="sa-form-section-title">Anagrafica e contratto</h3>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 16 }}>
                  <div>
                    <label style={labelStyle}>Nome attività</label>
                    <input
                      type="text"
                      value={modal.nome}
                      onChange={(e) => setModalField("nome", e.target.value)}
                      style={inputStyle}
                      required
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Slug</label>
                    <input
                      type="text"
                      value={modal.slug}
                      onChange={(e) => setModalField("slug", e.target.value)}
                      style={inputStyle}
                      required
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Livello contratto (subscription)</label>
                    <select
                      value={modal.piano}
                      onChange={(e) => setModalField("piano", e.target.value)}
                      style={inputStyle}
                    >
                      {PIANO_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                    <p style={{ margin: "6px 0 0", fontSize: 12, color: "#64748b" }}>
                      Valore tecnico su DB e abbonamenti; il bundle operativo predefinito segue questo livello se non
                      personalizzi i servizi.
                    </p>
                  </div>
                  <div>
                    <label style={labelStyle}>Prova valida fino al (incluso)</label>
                    <input
                      type="date"
                      value={modal.prova_valida_fino}
                      onChange={(e) => setModalField("prova_valida_fino", e.target.value)}
                      style={inputStyle}
                    />
                  </div>
                  <div style={{ gridColumn: "1 / -1" }}>
                    <label style={labelStyle}>URL sito cliente</label>
                    <input
                      type="text"
                      value={modal.sito_web_cliente}
                      onChange={(e) => setModalField("sito_web_cliente", e.target.value)}
                      style={inputStyle}
                      placeholder="https://francypizza.pizzamanager.it"
                      autoComplete="off"
                    />
                    <p style={{ margin: "6px 0 0", fontSize: 12, color: "#64748b" }}>
                      URL completo della vetrina cliente. Se il dominio pubblico è vuoto, al salvataggio viene derivato da qui.
                    </p>
                  </div>
                  <div style={{ gridColumn: "1 / -1" }}>
                    <label style={labelStyle}>Hostname pubblico (routing tenant)</label>
                    <input
                      type="text"
                      value={modal.public_domain}
                      onChange={(e) => setModalField("public_domain", e.target.value)}
                      style={inputStyle}
                      placeholder="francypizza.pizzamanager.it"
                      autoComplete="off"
                    />
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12 }}>
                  <input
                    type="checkbox"
                    id="attivo"
                    checked={modal.attivo}
                    onChange={(e) => setModalField("attivo", e.target.checked)}
                  />
                  <label htmlFor="attivo" style={{ fontSize: 14 }}>
                    Cliente attivo
                  </label>
                </div>
              </section>
              ) : null}

              {modalTab === "servizi" ? (
                <section className="sa-form-section">
                  <h3 className="sa-form-section-title">Contratto e servizi inclusi</h3>
                  <TenantServiziPlanFields
                modal={modal}
                catalogServices={catalogServices}
                commercialPlans={commercialPlans}
                labelStyle={labelStyle}
                inputStyle={inputStyle}
                setModal={setModal}
                reloadInclusioniFromPiano={reloadInclusioniFromPiano}
              />
                </section>
              ) : null}

              {modalTab === "fiscale" ? (
                <section className="sa-form-section">
                <h3 className="sa-form-section-title">Dati fiscali e contatti</h3>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 16 }}>
                  <div>
                    <label style={labelStyle}>Partita IVA</label>
                    <input
                      type="text"
                      value={modal.partita_iva}
                      onChange={(e) => setModalField("partita_iva", e.target.value)}
                      style={inputStyle}
                      placeholder="es. IT01234567890"
                      autoComplete="off"
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Email (azienda / fatturazione)</label>
                    <input
                      type="email"
                      value={modal.email_fatturazione}
                      onChange={(e) => setModalField("email_fatturazione", e.target.value)}
                      style={inputStyle}
                      placeholder="fatturazione@esempio.it"
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>PEC</label>
                    <input
                      type="email"
                      value={modal.pec}
                      onChange={(e) => setModalField("pec", e.target.value)}
                      style={inputStyle}
                      placeholder="nome@pec.it"
                    />
                  </div>
                  <div style={{ gridColumn: "1 / -1" }}>
                    <label style={labelStyle}>Codice univoco / SDI</label>
                    <input
                      type="text"
                      value={modal.codice_univoco_sdi}
                      onChange={(e) => setModalField("codice_univoco_sdi", e.target.value)}
                      style={inputStyle}
                      placeholder="es. codice destinatario o '0000000'"
                      autoComplete="off"
                    />
                  </div>
                </div>
              </section>
              ) : null}

              {modalTab === "account" && modal.mode === "edit" && modal.id ? (
                <section className="sa-form-section">
                  <h3 className="sa-form-section-title">Account attivi cliente</h3>
                  <p style={{ margin: "0 0 12px", fontSize: 13, color: "#64748b", lineHeight: 1.55 }}>
                    In questa finestra puoi vedere gli account attivi e aggiornare la password archivio (nota operativa). Per
                    gestione avanzata resta disponibile la{" "}
                    <Link to={`/superadmin/tenants/${modal.id}/archivio-password`} style={{ fontWeight: 600 }}>
                      pagina dedicata «Archivio password»
                    </Link>
                    .
                  </p>
                  {archivio.loading ? (
                    <p style={{ fontSize: 14, color: "#64748b" }}>Caricamento account staff…</p>
                  ) : null}
                  {archivio.error ? (
                    <div className="dashboard-error" style={{ marginBottom: 12, fontSize: 13 }}>
                      {archivio.error}
                    </div>
                  ) : null}
                  {!archivio.loading && !archivio.error && archivio.ruoli.length === 0 ? (
                    <p style={{ fontSize: 14, color: "#64748b" }}>Nessun account staff collegato a questo tenant.</p>
                  ) : null}
                  {!archivio.loading && archivio.ruoli.length > 0 ? (
                    <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                      {archivio.ruoli.map((r) => (
                        <li
                          key={r.user_id}
                          style={{
                            padding: "14px 0",
                            borderBottom: "1px solid #e2e8f0",
                          }}
                        >
                          <div style={{ fontWeight: 600, fontSize: 14 }}>{labelFromEmailPrefix(r.email)}</div>
                          <div style={{ fontSize: 12, color: "#64748b", marginBottom: 8 }}>
                            {r.email} · ruolo: {r.ruolo}
                            {r.archivio_tipo === "cliente" ? " · area cliente" : " · Utente attivo sul tenant"}
                          </div>
                          <label style={labelStyle}>Password archivio (nota interna)</label>
                          <textarea
                            value={archivio.drafts[r.user_id] ?? ""}
                            onChange={(e) =>
                              setArchivio((a) => ({
                                ...a,
                                drafts: { ...a.drafts, [r.user_id]: e.target.value },
                              }))
                            }
                            rows={2}
                            style={{ ...inputStyle, resize: "vertical", minHeight: 52 }}
                            autoComplete="off"
                            spellCheck={false}
                          />
                          <div style={{ marginTop: 8 }}>
                            <button
                              type="button"
                              className="sa-table-action"
                              disabled={archivio.savingUserId === r.user_id}
                              onClick={() => saveArchivioNote(r.user_id, archivio.drafts[r.user_id] ?? "")}
                            >
                              {archivio.savingUserId === r.user_id ? "Salvataggio…" : "Salva password"}
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </section>
              ) : null}

              {modalTab === "canone" ? (
                <section className="sa-form-section">
                <h3 className="sa-form-section-title">Abbonamento e pagamento</h3>
                <p style={{ margin: "0 0 14px", fontSize: 13, color: "#64748b", lineHeight: 1.55, maxWidth: 720 }}>
                  Il <strong>prossimo rinnovo</strong> (pagina Abbonamenti) si calcola dalla{" "}
                  <strong>data di attivazione</strong> con <strong>mesi di calendario</strong>: un mese dopo per il
                  mensile, dodici mesi dopo per l&apos;annuale (non giorni fissi: febbraio, mesi da 30/31, ecc.). In caso
                  annuale puoi registrare uno <strong>sconto %</strong> sul totale delle 12 mensilità (unica rata); il
                  listino può suggerire lo stesso sconto in <strong>Piani</strong>.
                </p>
                <div className="sa-callout-muted">
                  <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={modal.addebito_automatico_mensile}
                      onChange={(e) => setModalField("addebito_automatico_mensile", e.target.checked)}
                      style={{ marginTop: 3, width: 18, height: 18 }}
                    />
                    <span style={{ fontSize: 14, color: "#334155", lineHeight: 1.45 }}>
                      <strong>Addebito / rinnovo automatico</strong>
                      <br />
                      Allineato al ciclo scelto (mensile o annuale in mesi solari); gateway di pagamento da configurare.
                    </span>
                  </label>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 16 }}>
                  <div>
                    <label style={labelStyle}>Data attivazione / primo addebito</label>
                    <input
                      type="date"
                      value={modal.data_attivazione_abbonamento}
                      onChange={(e) => setModalField("data_attivazione_abbonamento", e.target.value)}
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Ciclo fatturazione</label>
                    <select
                      value={String(modal.abbonamentoCicloGiorni ?? 30)}
                      onChange={(e) => setModalField("abbonamentoCicloGiorni", Number(e.target.value))}
                      style={inputStyle}
                    >
                      <option value="30">Mensile (1 mese di calendario)</option>
                      <option value="365">Annuale (12 mesi di calendario, una rata)</option>
                    </select>
                  </div>
                  {Number(modal.abbonamentoCicloGiorni) === 365 ? (
                    <div>
                      <label style={labelStyle}>Sconto pagamento annuale (%)</label>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step={0.5}
                        value={modal.abbonamentoScontoAnnualePercent}
                        onChange={(e) => setModalField("abbonamentoScontoAnnualePercent", e.target.value)}
                        style={inputStyle}
                        placeholder="es. 12"
                      />
                      <p style={{ margin: "6px 0 0", fontSize: 12, color: "#64748b" }}>
                        Applicato al totale 12× canone mensile (prima degli sconti commerciali sotto, se li usi a parte).
                      </p>
                    </div>
                  ) : null}
                  <div>
                    <label style={labelStyle}>Sconto sul canone (%)</label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={0.5}
                      value={modal.sconto_percentuale}
                      onChange={(e) => setModalField("sconto_percentuale", e.target.value)}
                      style={inputStyle}
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Sconto fisso sul canone (€ / mese)</label>
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      value={modal.sconto_importo_euro}
                      onChange={(e) => setModalField("sconto_importo_euro", e.target.value)}
                      style={inputStyle}
                      placeholder="0"
                    />
                    <p style={{ margin: "6px 0 0", fontSize: 12, color: "#64748b" }}>
                      Si applica sul totale dopo lo sconto percentuale; salvato con il cliente (parametri operativi).
                    </p>
                  </div>
                </div>
              </section>
              ) : null}

              <div className="sa-modal-actions">
                <button type="button" onClick={closeModal} className="sa-btn-ghost">
                  Annulla
                </button>
                <button type="submit" disabled={saving} className="btn-primary-dashboard">
                  {saving ? "Salvataggio..." : "Salva"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
