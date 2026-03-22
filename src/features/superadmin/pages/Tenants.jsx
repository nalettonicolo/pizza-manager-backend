import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  getTenants,
  createTenant,
  updateTenant,
} from "@/features/superadmin/services/superadminService";
import { pianoDisplayLabel } from "@/features/superadmin/utils/pianoLabels";

const PIANO_OPTIONS = [
  { value: "TRIAL", label: "Prova (7 giorni)" },
  { value: "FREE", label: "Gratuito (legacy)" },
  { value: "PRO", label: "Pro" },
  { value: "ENTERPRISE", label: "Enterprise" },
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

function emptyModal(mode) {
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
  };
}

function tenantToModal(t, mode) {
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
  };
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

  const load = async () => {
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
  };

  useEffect(() => {
    load();
  }, []);

  const openCreate = () => {
    setModal(emptyModal("create"));
  };

  const openEdit = (t) => {
    setModal(tenantToModal(t, "edit"));
  };

  const closeModal = () => setModal(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!modal) return;
    setSaving(true);
    try {
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
      const next = { ...m, [field]: value };
      if (field === "nome" && m.mode === "create") {
        next.slug = slugify(value);
      }
      return next;
    });
  };

  const inputStyle = {
    width: "100%",
    padding: "8px 12px",
    border: "1px solid #ddd",
    borderRadius: 6,
    boxSizing: "border-box",
    fontSize: 14,
  };

  const labelStyle = { display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6, color: "#334155" };

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
        <div>
          <h1 className="dashboard-page-title">Clienti</h1>
        </div>
        <button type="button" className="btn-primary-dashboard" onClick={openCreate}>
          Nuovo cliente
        </button>
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
              <th>Piano</th>
              <th>Stato</th>
              <th>Creato</th>
              <th style={{ textAlign: "right" }}>Azioni</th>
            </tr>
          </thead>
          <tbody>
            {list.length === 0 ? (
              <tr>
                <td colSpan={12} style={{ padding: 32, textAlign: "center", color: "#666", fontSize: 14 }}>
                  Nessun cliente. Clicca &quot;Nuovo cliente&quot; per aggiungerne uno.
                </td>
              </tr>
            ) : (
              list.map((t) => (
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
                    {t.sconto_percentuale != null && Number(t.sconto_percentuale) > 0
                      ? `${Number(t.sconto_percentuale)}%`
                      : "—"}
                  </td>
                  <td style={{ fontSize: 13 }}>{pianoDisplayLabel(t.piano)}</td>
                  <td>
                    <span className={t.attivo ? "badge badge-success" : "badge badge-neutral"}>
                      {t.attivo ? "Attivo" : "Disattivo"}
                    </span>
                  </td>
                  <td style={{ color: "#666", fontSize: 13 }}>
                    {t.created_at ? new Date(t.created_at).toLocaleDateString("it-IT") : "—"}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <button
                      type="button"
                      onClick={() => openEdit(t)}
                      style={{ background: "none", border: "none", color: "#c0392b", cursor: "pointer", fontSize: 13 }}
                    >
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
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 50,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0,0,0,0.5)",
            padding: 16,
            overflowY: "auto",
          }}
          onClick={closeModal}
        >
          <div
            className="dashboard-box"
            style={{ maxWidth: 720, width: "100%", margin: "auto", maxHeight: "min(92vh, 900px)", overflowY: "auto" }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ marginTop: 0, marginBottom: 8 }}>
              {modal.mode === "create" ? "Nuovo cliente" : "Modifica cliente"}
            </h2>
            <p style={{ margin: "0 0 20px", fontSize: 13, color: "#64748b" }}>
              Dati anagrafici della pizzeria, fatturazione e opzioni di abbonamento (addebito mensile e sconto concordato).
            </p>
            <p
              style={{
                margin: "0 0 16px",
                padding: "10px 12px",
                background: "#fff7ed",
                border: "1px solid #fed7aa",
                borderRadius: 8,
                fontSize: 13,
                color: "#9a3412",
              }}
            >
              <strong>Scorri in basso</strong> per le sezioni <em>Dati fiscali e contatti</em> e{" "}
              <em>Abbonamento e pagamento</em> (P.IVA, email, PEC, SDI, rinnovo automatico).
            </p>
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <section>
                <h3 style={{ margin: "0 0 12px", fontSize: 15, color: "#0f172a" }}>Generale</h3>
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
                    <label style={labelStyle}>Piano</label>
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

              <section>
                <h3 style={{ margin: "0 0 12px", fontSize: 15, color: "#0f172a" }}>Dati fiscali e contatti</h3>
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
                    <label style={labelStyle}>Codice univoco / SDI (fatturazione elettronica)</label>
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

              <section>
                <h3 style={{ margin: "0 0 12px", fontSize: 15, color: "#0f172a" }}>Abbonamento e pagamento</h3>
                <div
                  style={{
                    padding: 12,
                    background: "#f8fafc",
                    borderRadius: 8,
                    border: "1px solid #e2e8f0",
                    marginBottom: 16,
                  }}
                >
                  <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={modal.addebito_automatico_mensile}
                      onChange={(e) => setModalField("addebito_automatico_mensile", e.target.checked)}
                      style={{ marginTop: 3, width: 18, height: 18 }}
                    />
                    <span style={{ fontSize: 14, color: "#334155", lineHeight: 1.45 }}>
                      <strong>Pagamento online con addebito automatico mensile</strong>
                      <br />
                      Il rinnovo è impostato all&apos;inizio di ogni mese solare, a partire dalla data di attivazione
                      indicata sotto (integrazione gateway di pagamento da configurare lato piattaforma).
                    </span>
                  </label>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 16 }}>
                  <div>
                    <label style={labelStyle}>Data attivazione abbonamento / primo addebito</label>
                    <input
                      type="date"
                      value={modal.data_attivazione_abbonamento}
                      onChange={(e) => setModalField("data_attivazione_abbonamento", e.target.value)}
                      style={inputStyle}
                    />
                  </div>
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
                    <p style={{ margin: "6px 0 0", fontSize: 12, color: "#64748b" }}>
                      Percentuale concordata con il cliente (0 = nessuno sconto).
                    </p>
                  </div>
                </div>
              </section>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                <button type="button" onClick={closeModal} style={{ padding: "10px 18px", color: "#666", background: "none", border: "none", cursor: "pointer", fontSize: 14 }}>
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
