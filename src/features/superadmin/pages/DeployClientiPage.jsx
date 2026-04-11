import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { getTenants } from "@/features/superadmin/services/superadminService";
import { pianoDisplayLabel } from "@/features/superadmin/utils/pianoLabels";

const DEPLOY_CHECKLIST_STORAGE_KEY = "pizzamanager_deploy_checklist_v1";

const CHECKLIST_ITEMS = [
  { id: "anagrafica", label: "Anagrafica tenant verificata" },
  { id: "dns", label: "DNS dominio cliente configurato" },
  { id: "menu", label: "Menu pubblico verificato" },
  { id: "legali", label: "Privacy / Cookie / Termini verificati" },
  { id: "smoke_test", label: "Smoke test finale completato" },
];

function publicDomainStatusLabel(v) {
  const m = {
    none: "—",
    requested: "Richiesta piattaforma",
    dns_pending: "DNS / Firebase",
    live: "Live",
  };
  return m[v] || v || "—";
}

function loadChecklistByTenant() {
  try {
    const raw = localStorage.getItem(DEPLOY_CHECKLIST_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveChecklistByTenant(data) {
  try {
    localStorage.setItem(DEPLOY_CHECKLIST_STORAGE_KEY, JSON.stringify(data));
  } catch {
    // ignore storage failures
  }
}

function getChecklistForTenant(checklistByTenant, tenantId) {
  const src = checklistByTenant?.[tenantId] || {};
  const out = {};
  for (const item of CHECKLIST_ITEMS) {
    out[item.id] = src[item.id] === true;
  }
  return out;
}

const secondaryBtnStyle = {
  display: "inline-block",
  padding: "10px 14px",
  borderRadius: 8,
  border: "1px solid #cbd5e1",
  color: "#334155",
  background: "#fff",
  fontWeight: 600,
};

const sectionCardStyle = {
  marginBottom: 24,
  padding: 24,
  borderRadius: 12,
  boxShadow: "0 6px 20px rgba(15, 23, 42, 0.06)",
};

export default function DeployClientiPage() {
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState("");
  const [selectedTenantId, setSelectedTenantId] = useState(null);
  const [checklistByTenant, setChecklistByTenant] = useState(() => loadChecklistByTenant());

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        setError(null);
        const data = await getTenants();
        if (!cancelled) {
          setTenants(data || []);
          setSelectedTenantId((prev) => prev ?? (data?.length ? data[0].id : null));
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
      const sito = String(t.sito_web_cliente || "").toLowerCase();
      return nome.includes(q) || slug.includes(q) || sito.includes(q);
    });
  }, [tenants, query]);

  const selectedTenant =
    filteredTenants.find((t) => t.id === selectedTenantId) ||
    tenants.find((t) => t.id === selectedTenantId) ||
    null;

  const tenantPublicUrl = selectedTenant?.slug
    ? `https://${selectedTenant.slug}.pizzamanager.it`
    : "n/d";
  const checklist = selectedTenant ? getChecklistForTenant(checklistByTenant, selectedTenant.id) : null;
  const checkedCount = checklist
    ? CHECKLIST_ITEMS.reduce((acc, item) => acc + (checklist[item.id] ? 1 : 0), 0)
    : 0;
  const totalChecks = CHECKLIST_ITEMS.length + 1; // +1 = aggiornamenti automatici sempre inclusi
  const completionPercent = selectedTenant
    ? Math.round(((checkedCount + 1) / totalChecks) * 100)
    : 0;
  const isDeployReady = selectedTenant ? checkedCount === CHECKLIST_ITEMS.length : false;

  const toggleChecklistItem = (itemId) => {
    if (!selectedTenant?.id) return;
    setChecklistByTenant((prev) => {
      const current = getChecklistForTenant(prev, selectedTenant.id);
      const nextTenantChecklist = { ...current, [itemId]: !current[itemId] };
      const next = { ...prev, [selectedTenant.id]: nextTenantChecklist };
      saveChecklistByTenant(next);
      return next;
    });
  };

  return (
    <div className="dashboard-settings-page superadmin-deploy-page">
      <h1 className="dashboard-page-title">Deploy siti clienti</h1>

      <p style={{ maxWidth: "100%", fontSize: 15, lineHeight: 1.65, color: "#334155", marginBottom: 24 }}>
        Da questa area gestisci la pubblicazione del sistema/menu sul dominio del cliente. La pipeline completamente
        automatica tenant-by-tenant e in evoluzione; oggi la procedura operativa resta guidata (checklist + deploy
        piattaforma).
      </p>

      <section className="dashboard-box dashboard-settings-section" style={sectionCardStyle}>
        <h2 className="dashboard-settings-section-title">Come fare deploy sul sito cliente</h2>
        <p style={{ margin: "0 0 12px", fontSize: 14, color: "#475569", lineHeight: 1.65 }}>
          Flusso consigliato per andare online in sicurezza su un tenant:
        </p>
        <ol style={{ margin: 0, paddingLeft: 20, fontSize: 14, lineHeight: 1.8, color: "#334155" }}>
          <li>Seleziona il cliente dalla tabella e verifica lo slug/URL pubblico atteso.</li>
          <li>Completa la checklist di verifica (anagrafica, DNS, menu, legali, smoke test).</li>
          <li>Esegui deploy frontend dalla root del progetto con <code>npm run deploy</code>.</li>
          <li>Per backend usa <code>git commit</code> + <code>git push</code> (trigger deploy automatico piattaforma).</li>
          <li>Apri l&apos;URL cliente e verifica home, menu, login, privacy/cookie/termini.</li>
          <li>Registra esito con timestamp interno e lascia la checklist completa al 100%.</li>
        </ol>
        <div
          style={{
            marginTop: 14,
            padding: "12px 14px",
            borderRadius: 10,
            border: "1px solid #dbeafe",
            background: "#eff6ff",
            color: "#1e3a8a",
            fontSize: 13,
          }}
        >
          Nota: gli <strong>aggiornamenti automatici del sistema</strong> sono sempre inclusi nel deploy cliente.
        </div>
      </section>

      <section className="dashboard-box dashboard-settings-section" style={sectionCardStyle}>
        <h2 className="dashboard-settings-section-title">Clienti collegati al deploy</h2>
        <p style={{ margin: "0 0 10px", fontSize: 14, color: "#475569" }}>
          Questa pagina ora usa i dati reali dei clienti registrati (tenant) per preparare e tracciare il go-live.
        </p>
        <div style={{ marginBottom: 12 }}>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cerca per nome, slug o URL sito web..."
            style={{ width: "100%", maxWidth: "min(560px, 100%)", padding: "8px 10px", borderRadius: 8, border: "1px solid #cbd5e1" }}
          />
        </div>

        {loading ? (
          <p style={{ margin: 0, fontSize: 14, color: "#475569" }}>Caricamento clienti...</p>
        ) : error ? (
          <p style={{ margin: 0, fontSize: 14, color: "#b91c1c" }}>{error}</p>
        ) : filteredTenants.length === 0 ? (
          <p style={{ margin: 0, fontSize: 14, color: "#475569" }}>Nessun cliente trovato.</p>
        ) : (
          <div className="dashboard-table-wrap" style={{ overflowX: "auto", borderRadius: 10 }}>
            <table style={{ width: "100%", minWidth: 0 }}>
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Slug</th>
                  <th>Sito web cliente</th>
                  <th>Dominio pubblico</th>
                  <th>Stato dominio</th>
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
                    <td style={{ fontSize: 12, maxWidth: 200 }}>
                      {t.sito_web_cliente ? (
                        <a href={t.sito_web_cliente} target="_blank" rel="noopener noreferrer" style={{ color: "#c0392b", wordBreak: "break-all" }}>
                          {t.sito_web_cliente}
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td style={{ color: "#475569", fontSize: 13 }}>{t.public_domain || "—"}</td>
                    <td style={{ fontSize: 13 }}>{publicDomainStatusLabel(t.public_domain_status)}</td>
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

      <section className="dashboard-box dashboard-settings-section" style={sectionCardStyle}>
        <h2 className="dashboard-settings-section-title">Stato area deploy</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14 }}>
          <div style={{ border: "1px solid #d1fae5", background: "#f0fdf4", borderRadius: 10, padding: 16 }}>
            <p style={{ margin: 0, fontSize: 12, color: "#166534", fontWeight: 700 }}>FRONTEND</p>
            <p style={{ margin: "4px 0 0", fontSize: 14, color: "#14532d" }}>Deploy guidato disponibile</p>
          </div>
          <div style={{ border: "1px solid #ffedd5", background: "#fff7ed", borderRadius: 10, padding: 16 }}>
            <p style={{ margin: 0, fontSize: 12, color: "#9a3412", fontWeight: 700 }}>BACKEND</p>
            <p style={{ margin: "4px 0 0", fontSize: 14, color: "#7c2d12" }}>Deploy automatico via push repo</p>
          </div>
          <div style={{ border: "1px solid #e2e8f0", background: "#f8fafc", borderRadius: 10, padding: 16 }}>
            <p style={{ margin: 0, fontSize: 12, color: "#334155", fontWeight: 700 }}>TENANT</p>
            <p style={{ margin: "4px 0 0", fontSize: 14, color: "#0f172a" }}>
              {selectedTenant ? `${selectedTenant.nome} (${selectedTenant.slug || "slug mancante"})` : "Seleziona un cliente"}
            </p>
          </div>
        </div>
        <p style={{ margin: "10px 0 0", fontSize: 13, color: "#64748b" }}>
          URL piattaforma (subdominio): <code>{tenantPublicUrl}</code>
        </p>
        {selectedTenant?.sito_web_cliente ? (
          <p style={{ margin: "6px 0 0", fontSize: 13, color: "#334155" }}>
            Sito web cliente:{" "}
            <a href={selectedTenant.sito_web_cliente} target="_blank" rel="noopener noreferrer" style={{ color: "#c0392b", fontWeight: 600 }}>
              {selectedTenant.sito_web_cliente}
            </a>
          </p>
        ) : null}
        {selectedTenant?.public_domain ? (
          <p style={{ margin: "6px 0 0", fontSize: 13, color: "#0f172a" }}>
            Dominio cliente registrato in app:{" "}
            <code>
              https://{selectedTenant.public_domain}
            </code>{" "}
            · stato: <strong>{publicDomainStatusLabel(selectedTenant.public_domain_status)}</strong>
          </p>
        ) : (
          <p style={{ margin: "6px 0 0", fontSize: 13, color: "#64748b" }}>
            Dominio cliente: non ancora impostato — configura da{" "}
            <Link
              to={
                selectedTenant?.id
                  ? `/superadmin/pubblicazione-sito?tenant=${encodeURIComponent(selectedTenant.id)}`
                  : "/superadmin/pubblicazione-sito"
              }
              style={{ fontWeight: 600 }}
            >
              Pubblicazione dominio
            </Link>
            .
          </p>
        )}
        {selectedTenant?.id ? (
          <p style={{ margin: "8px 0 0", fontSize: 13 }}>
            <Link
              to={`/superadmin/pubblicazione-sito?tenant=${encodeURIComponent(selectedTenant.id)}`}
              style={{ fontWeight: 600, color: "#c0392b" }}
            >
              Apri guida tecnica e form dominio per questo cliente →
            </Link>
          </p>
        ) : null}
        {selectedTenant && (
          <p style={{ margin: "8px 0 0", fontSize: 13, color: "#0f172a" }}>
            Completamento deploy: <strong>{completionPercent}%</strong>
            {" · "}
            <span
              style={{
                color: isDeployReady ? "#166534" : "#9a3412",
                fontWeight: 700,
              }}
            >
              {isDeployReady ? "Pronto per pubblicazione cliente" : "Checklist non completa"}
            </span>
          </p>
        )}
      </section>

      <section className="dashboard-box dashboard-settings-section" style={sectionCardStyle}>
        <h2 className="dashboard-settings-section-title">Procedura operativa attuale</h2>
        <ul style={{ margin: 0, paddingLeft: 20, fontSize: 14, lineHeight: 1.75, color: "#334155" }}>
          <li>Verifica anagrafica tenant, host pubblico e configurazione menu.</li>
          <li>Conferma DNS del dominio cliente verso l&apos;hosting della piattaforma.</li>
          <li>Esegui deploy frontend (build + hosting) dalla root del progetto.</li>
          <li>Controlla il tenant online: home, menu pubblico, privacy/cookie/termini.</li>
          <li>Registra esito e timestamp nel processo interno.</li>
        </ul>
      </section>

      <section className="dashboard-box dashboard-settings-section" style={sectionCardStyle}>
        <h2 className="dashboard-settings-section-title">Verifica completamento deploy</h2>
        {!selectedTenant ? (
          <p style={{ margin: 0, fontSize: 14, color: "#475569" }}>
            Seleziona prima un cliente per compilare la checklist.
          </p>
        ) : (
          <>
            <p style={{ margin: "0 0 12px", fontSize: 14, color: "#475569" }}>
              Cliente selezionato: <strong>{selectedTenant.nome}</strong> ({selectedTenant.slug || "slug mancante"})
            </p>
            <div
              style={{
                marginBottom: 10,
                padding: "10px 12px",
                borderRadius: 8,
                border: "1px solid #d1fae5",
                background: "#f0fdf4",
              }}
            >
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: "#14532d" }}>
                <input type="checkbox" checked readOnly style={{ width: 16, height: 16 }} />
                Aggiornamenti automatici del sistema inclusi (sempre attivi)
              </label>
            </div>
            <div style={{ display: "grid", gap: 8 }}>
              {CHECKLIST_ITEMS.map((item) => (
                <label
                  key={item.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    fontSize: 14,
                    color: "#334155",
                    background: "#fff",
                    border: "1px solid #e2e8f0",
                    borderRadius: 8,
                    padding: "8px 10px",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={!!checklist?.[item.id]}
                    onChange={() => toggleChecklistItem(item.id)}
                    style={{ width: 16, height: 16 }}
                  />
                  {item.label}
                </label>
              ))}
            </div>
          </>
        )}
      </section>

      <section className="dashboard-box dashboard-settings-section" style={sectionCardStyle}>
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

      <section className="dashboard-box dashboard-settings-section" style={sectionCardStyle}>
        <h2 className="dashboard-settings-section-title">Vai ai tenant</h2>
        <p style={{ margin: "0 0 12px", fontSize: 14, color: "#475569" }}>
          Per operare su un cliente specifico, apri prima l&apos;anagrafica del tenant.
        </p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link to="/superadmin/tenants" className="btn-primary-dashboard" style={{ textDecoration: "none" }}>
            Apri clienti →
          </Link>
        </div>
      </section>
    </div>
  );
}
