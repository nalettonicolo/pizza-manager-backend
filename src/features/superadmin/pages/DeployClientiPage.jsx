import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { getTenants } from "@/features/superadmin/services/superadminService";
import { pianoDisplayLabel } from "@/features/superadmin/utils/pianoLabels";

const secondaryBtnStyle = {
  display: "inline-block",
  padding: "10px 14px",
  borderRadius: 8,
  border: "1px solid #cbd5e1",
  color: "#334155",
  background: "#fff",
  fontWeight: 600,
};

export default function DeployClientiPage() {
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState("");
  const [selectedTenantId, setSelectedTenantId] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        setError(null);
        const data = await getTenants();
        if (!cancelled) {
          setTenants(data || []);
          if (!selectedTenantId && data?.length) setSelectedTenantId(data[0].id);
        }
      } catch (err) {
        if (!cancelled) setError(err?.message || "Errore caricamento clienti.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredTenants = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return tenants;
    return tenants.filter((t) => {
      const nome = String(t.nome || "").toLowerCase();
      const slug = String(t.slug || "").toLowerCase();
      return nome.includes(q) || slug.includes(q);
    });
  }, [tenants, query]);

  const selectedTenant =
    filteredTenants.find((t) => t.id === selectedTenantId) ||
    tenants.find((t) => t.id === selectedTenantId) ||
    null;

  const tenantPublicUrl = selectedTenant?.slug
    ? `https://${selectedTenant.slug}.pizzamanager.it`
    : "n/d";

  return (
    <div className="dashboard-settings-page">
      <h1 className="dashboard-page-title">Deploy siti clienti</h1>

      <p style={{ maxWidth: 860, fontSize: 15, lineHeight: 1.6, color: "#334155", marginBottom: 24 }}>
        Da questa area gestisci la pubblicazione del sistema/menu sul dominio del cliente. La pipeline completamente
        automatica tenant-by-tenant e in evoluzione; oggi la procedura operativa resta guidata (checklist + deploy
        piattaforma).
      </p>

      <section className="dashboard-box dashboard-settings-section" style={{ marginBottom: 20 }}>
        <h2 className="dashboard-settings-section-title">Clienti collegati al deploy</h2>
        <p style={{ margin: "0 0 10px", fontSize: 14, color: "#475569" }}>
          Questa pagina ora usa i dati reali dei clienti registrati (tenant) per preparare e tracciare il go-live.
        </p>
        <div style={{ marginBottom: 12 }}>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cerca cliente per nome o slug..."
            style={{ width: "100%", maxWidth: 420, padding: "8px 10px", borderRadius: 8, border: "1px solid #cbd5e1" }}
          />
        </div>

        {loading ? (
          <p style={{ margin: 0, fontSize: 14, color: "#475569" }}>Caricamento clienti...</p>
        ) : error ? (
          <p style={{ margin: 0, fontSize: 14, color: "#b91c1c" }}>{error}</p>
        ) : filteredTenants.length === 0 ? (
          <p style={{ margin: 0, fontSize: 14, color: "#475569" }}>Nessun cliente trovato.</p>
        ) : (
          <div className="dashboard-table-wrap" style={{ overflowX: "auto" }}>
            <table style={{ minWidth: 820 }}>
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Slug</th>
                  <th>Piano</th>
                  <th>Stato</th>
                  <th style={{ textAlign: "right" }}>Azioni</th>
                </tr>
              </thead>
              <tbody>
                {filteredTenants.map((t) => (
                  <tr key={t.id} style={{ background: selectedTenantId === t.id ? "#fff7ed" : undefined }}>
                    <td style={{ fontWeight: 600 }}>{t.nome || "—"}</td>
                    <td style={{ color: "#475569" }}>{t.slug || "—"}</td>
                    <td>{pianoDisplayLabel(t.piano)}</td>
                    <td>
                      <span className={t.attivo ? "badge badge-success" : "badge badge-neutral"}>
                        {t.attivo ? "Attivo" : "Disattivo"}
                      </span>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <button
                        type="button"
                        onClick={() => setSelectedTenantId(t.id)}
                        style={{ ...secondaryBtnStyle, padding: "6px 10px", marginRight: 6, cursor: "pointer" }}
                      >
                        Seleziona
                      </button>
                      <Link to="/superadmin/tenants" style={{ ...secondaryBtnStyle, padding: "6px 10px", textDecoration: "none" }}>
                        Modifica
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="dashboard-box dashboard-settings-section" style={{ marginBottom: 20 }}>
        <h2 className="dashboard-settings-section-title">Stato area deploy</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
          <div style={{ border: "1px solid #d1fae5", background: "#f0fdf4", borderRadius: 8, padding: 12 }}>
            <p style={{ margin: 0, fontSize: 12, color: "#166534", fontWeight: 700 }}>FRONTEND</p>
            <p style={{ margin: "4px 0 0", fontSize: 14, color: "#14532d" }}>Deploy guidato disponibile</p>
          </div>
          <div style={{ border: "1px solid #ffedd5", background: "#fff7ed", borderRadius: 8, padding: 12 }}>
            <p style={{ margin: 0, fontSize: 12, color: "#9a3412", fontWeight: 700 }}>BACKEND</p>
            <p style={{ margin: "4px 0 0", fontSize: 14, color: "#7c2d12" }}>Deploy automatico via push repo</p>
          </div>
          <div style={{ border: "1px solid #e2e8f0", background: "#f8fafc", borderRadius: 8, padding: 12 }}>
            <p style={{ margin: 0, fontSize: 12, color: "#334155", fontWeight: 700 }}>TENANT</p>
            <p style={{ margin: "4px 0 0", fontSize: 14, color: "#0f172a" }}>
              {selectedTenant ? `${selectedTenant.nome} (${selectedTenant.slug || "slug mancante"})` : "Seleziona un cliente"}
            </p>
          </div>
        </div>
        <p style={{ margin: "10px 0 0", fontSize: 13, color: "#64748b" }}>
          URL pubblico atteso: <code>{tenantPublicUrl}</code>
        </p>
      </section>

      <section className="dashboard-box dashboard-settings-section" style={{ marginBottom: 20 }}>
        <h2 className="dashboard-settings-section-title">Procedura operativa attuale</h2>
        <ul style={{ margin: 0, paddingLeft: 20, fontSize: 14, lineHeight: 1.75, color: "#334155" }}>
          <li>Verifica anagrafica tenant, host pubblico e configurazione menu.</li>
          <li>Conferma DNS del dominio cliente verso l&apos;hosting della piattaforma.</li>
          <li>Esegui deploy frontend (build + hosting) dalla root del progetto.</li>
          <li>Controlla il tenant online: home, menu pubblico, privacy/cookie/termini.</li>
          <li>Registra esito e timestamp nel processo interno.</li>
        </ul>
      </section>

      <section className="dashboard-box dashboard-settings-section" style={{ marginBottom: 20 }}>
        <h2 className="dashboard-settings-section-title">Comandi rapidi</h2>
        <p style={{ margin: "0 0 10px", fontSize: 14, color: "#475569" }}>
          Documentazione interna della pipeline:
        </p>
        <ul style={{ margin: 0, paddingLeft: 20, fontSize: 14, lineHeight: 1.7, color: "#334155" }}>
          <li>
            <code>DEPLOY_COMANDI.md</code> (procedura completa)
          </li>
          <li>
            <code>deploy-firebase.ps1</code> (script hosting frontend)
          </li>
          <li>
            <code>docs/GUIDA_SUPERADMIN.md</code> (processo operativo piattaforma)
          </li>
        </ul>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
          <Link to="/superadmin/tenants" className="btn-primary-dashboard" style={{ textDecoration: "none" }}>
            Apri clienti
          </Link>
          <Link to="/superadmin/piani" style={{ ...secondaryBtnStyle, textDecoration: "none" }}>
            Verifica piani
          </Link>
          <Link to="/superadmin/servizi" style={{ ...secondaryBtnStyle, textDecoration: "none" }}>
            Verifica servizi
          </Link>
        </div>
      </section>

      <section className="dashboard-box dashboard-settings-section" style={{ marginBottom: 20 }}>
        <h2 className="dashboard-settings-section-title">Vai ai tenant</h2>
        <p style={{ margin: "0 0 12px", fontSize: 14, color: "#475569" }}>
          Per operare su un cliente specifico, apri prima l&apos;anagrafica del tenant.
        </p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link to="/superadmin/tenants" className="btn-primary-dashboard" style={{ textDecoration: "none" }}>
            Apri clienti →
          </Link>
          <Link to="/superadmin/dashboard" style={{ ...secondaryBtnStyle, textDecoration: "none" }}>
            Torna al riepilogo
          </Link>
        </div>
      </section>
    </div>
  );
}
