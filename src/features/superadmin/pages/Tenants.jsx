import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  getTenants,
  createTenant,
  updateTenant,
} from "@/features/superadmin/services/superadminService";

const PIANO_OPTIONS = [
  { value: "FREE", label: "Free" },
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
    setModal({
      mode: "create",
      nome: "",
      slug: "",
      piano: "FREE",
      attivo: true,
    });
  };

  const openEdit = (t) => {
    setModal({
      mode: "edit",
      id: t.id,
      nome: t.nome,
      slug: t.slug,
      piano: t.piano ?? "FREE",
      attivo: !!t.attivo,
    });
  };

  const closeModal = () => setModal(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!modal) return;
    setSaving(true);
    try {
      if (modal.mode === "create") {
        await createTenant({
          nome: modal.nome,
          slug: modal.slug || slugify(modal.nome),
          piano: modal.piano,
          attivo: modal.attivo,
        });
      } else {
        await updateTenant(modal.id, {
          nome: modal.nome,
          slug: modal.slug,
          piano: modal.piano,
          attivo: modal.attivo,
        });
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

      <div className="dashboard-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Nome</th>
              <th>Slug</th>
              <th>Piano</th>
              <th>Stato</th>
              <th>Creato</th>
              <th style={{ textAlign: "right" }}>Azioni</th>
            </tr>
          </thead>
          <tbody>
            {list.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: 32, textAlign: "center", color: "#666", fontSize: 14 }}>
                  Nessun cliente. Clicca "Nuovo cliente" per aggiungerne uno.
                </td>
              </tr>
            ) : (
              list.map((t) => (
                <tr key={t.id}>
                  <td style={{ fontWeight: 600 }}>{t.nome}</td>
                  <td style={{ color: "#666" }}>{t.slug}</td>
                  <td>{t.piano ?? "FREE"}</td>
                  <td>
                    <span className={t.attivo ? "badge badge-success" : "badge badge-neutral"}>
                      {t.attivo ? "Attivo" : "Disattivo"}
                    </span>
                  </td>
                  <td style={{ color: "#666" }}>
                    {t.created_at ? new Date(t.created_at).toLocaleDateString("it-IT") : "—"}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <button type="button" onClick={() => openEdit(t)} style={{ background: "none", border: "none", color: "#c0392b", cursor: "pointer", fontSize: 13 }}>
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
        <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.5)" }} onClick={closeModal}>
          <div
            className="dashboard-box"
            style={{ maxWidth: 400, width: "100%", margin: 16 }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ marginBottom: 16 }}>
              {modal.mode === "create" ? "Nuovo cliente" : "Modifica cliente"}
            </h2>
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 4 }}>Nome</label>
                <input
                  type="text"
                  value={modal.nome}
                  onChange={(e) => setModalField("nome", e.target.value)}
                  style={{ width: "100%", padding: "8px 12px", border: "1px solid #ddd", borderRadius: 6, boxSizing: "border-box" }}
                  required
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 4 }}>Slug</label>
                <input
                  type="text"
                  value={modal.slug}
                  onChange={(e) => setModalField("slug", e.target.value)}
                  style={{ width: "100%", padding: "8px 12px", border: "1px solid #ddd", borderRadius: 6, boxSizing: "border-box" }}
                  required
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 4 }}>Piano</label>
                <select
                  value={modal.piano}
                  onChange={(e) => setModalField("piano", e.target.value)}
                  style={{ width: "100%", padding: "8px 12px", border: "1px solid #ddd", borderRadius: 6 }}
                >
                  {PIANO_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input type="checkbox" id="attivo" checked={modal.attivo} onChange={(e) => setModalField("attivo", e.target.checked)} />
                <label htmlFor="attivo" style={{ fontSize: 14 }}>Attivo</label>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
                <button type="button" onClick={closeModal} style={{ padding: "8px 16px", color: "#666", background: "none", border: "none", cursor: "pointer" }}>
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
