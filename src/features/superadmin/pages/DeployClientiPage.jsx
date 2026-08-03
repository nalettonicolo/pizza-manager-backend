import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { getTenants } from "@/features/superadmin/services/superadminService";
import SaListSearchField from "@/features/superadmin/components/SaListSearchField";
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

      {/* Analisi + modello semplificato (fonte operativa per Super Admin) */}
      <section
        aria-label="Analisi e consigli deploy"
        style={{
          marginBottom: 28,
          padding: "20px 22px",
          borderRadius: 12,
          border: "1px solid #fdba74",
          background: "#fff7ed",
          boxShadow: "0 6px 20px rgba(15, 23, 42, 0.06)",
        }}
      >
        <p
          style={{
            margin: "0 0 8px",
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: "#9a3412",
          }}
        >
          Analisi situazione · consigli operativi
        </p>
        <h2 style={{ margin: "0 0 12px", fontSize: 18, color: "#0f172a", fontWeight: 800, lineHeight: 1.35 }}>
          Un solo sito piattaforma, tanti locali: non serve un deploy per ogni cliente
        </h2>

        <p style={{ margin: "0 0 14px", fontSize: 14, lineHeight: 1.65, color: "#334155" }}>
          Oggi PizzaManager è <strong>un&apos;unica webapp</strong> pubblicata su Firebase (es.{" "}
          <a href="https://pizzamanager.it" target="_blank" rel="noopener noreferrer" style={{ color: "#c0392b", fontWeight: 600 }}>
            pizzamanager.it
          </a>
          ). Ogni pizzeria non ha un build separato: il browser apre lo stesso codice e il sistema riconosce il locale
          dallo <strong>hostname</strong> (dominio proprio) o dallo <strong>slug</strong> su piattaforma. Per questo la
          pagina storica “deploy cliente” risultava macchinosa: mescolava go-live DNS, checklist locali e comandi{" "}
          <code>npm run deploy</code> come se ogni tenant richiedesse una pubblicazione dedicata.
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: 12,
            marginBottom: 14,
          }}
        >
          <div style={{ padding: 14, borderRadius: 10, background: "#fff", border: "1px solid #fed7aa" }}>
            <p style={{ margin: "0 0 6px", fontSize: 12, fontWeight: 800, color: "#9a3412" }}>COSA FUNZIONA GIÀ</p>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.55, color: "#334155" }}>
              <li>Un deploy frontend aggiorna <em>tutti</em> i clienti contemporaneamente.</li>
              <li>Dominio e stato go-live sono salvati sul tenant (<code>public_domain</code>).</li>
              <li>Esiste già la pagina dedicata «Pubblicazione dominio» per DNS / Firebase.</li>
            </ul>
          </div>
          <div style={{ padding: 14, borderRadius: 10, background: "#fff", border: "1px solid #fecaca" }}>
            <p style={{ margin: "0 0 6px", fontSize: 12, fontWeight: 800, color: "#b91c1c" }}>COSA È MACCHINOSO</p>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.55, color: "#334155" }}>
              <li>Due pagine simili (Deploy siti + Pubblicazione dominio) con istruzioni che si sovrappongono.</li>
              <li>Checklist solo in questo browser (localStorage), non condivisa col team.</li>
              <li>Confusione tra «sito web marketing» e «dominio menu» del locale.</li>
              <li>Comandi repo e DNS mescolati nello stesso flusso go-live.</li>
            </ul>
          </div>
        </div>

        <h3 style={{ margin: "0 0 8px", fontSize: 15, color: "#0f172a", fontWeight: 800 }}>
          Modello consigliato (semplice)
        </h3>
        <ol style={{ margin: "0 0 14px", paddingLeft: 20, fontSize: 14, lineHeight: 1.75, color: "#1e293b" }}>
          <li>
            <strong>Aggiornamenti prodotto</strong> — una volta sola:{" "}
            <code>npm run deploy:full:ci</code> (o pipeline CI). Vale per tutta la piattaforma.
          </li>
          <li>
            <strong>Nuovo cliente online</strong> — solo tre passi:
            <br />
            (A) slug attivo in anagrafica → anteprima su piattaforma;
            <br />
            (B) dominio proprio: CNAME verso Firebase + salvataggio in{" "}
            <Link to="/superadmin/pubblicazione-sito" style={{ color: "#c0392b", fontWeight: 700 }}>
              Pubblicazione dominio
            </Link>
            ;
            <br />
            (C) Redirect Auth Supabase per quel dominio (reset password / login).
          </li>
          <li>
            <strong>Non rifare il deploy</strong> quando aggiungi un dominio: aggiungi l&apos;host in Firebase Hosting
            e aggiorna il record DNS. Il codice è già lo stesso.
          </li>
          <li>
            <strong>Un solo campo “dominio menu”</strong> — usa <em>dominio pubblico</em> per il menu/ordini; tieni
            «sito web cliente» solo se è un sito marketing esterno diverso.
          </li>
        </ol>

        <h3 style={{ margin: "0 0 8px", fontSize: 15, color: "#0f172a", fontWeight: 800 }}>
          Prossimi miglioramenti (roadmap tecnica)
        </h3>
        <ul style={{ margin: "0 0 12px", paddingLeft: 20, fontSize: 13, lineHeight: 1.65, color: "#475569" }}>
          <li>
            Unificare questa pagina con Pubblicazione dominio in un’unica «Go-live cliente» (stato DNS + link smoke
            test).
          </li>
          <li>Checklist go-live salvata su database (condivisa), non solo in questo PC.</li>
          <li>
            Wildcard <code>*.pizzamanager.it</code> + automazione CNAME/custom domain Firebase (meno passaggi manuali).
          </li>
          <li>Script/checklist Auth Redirect URLs per ogni nuovo hostname.</li>
        </ul>

        <p
          style={{
            margin: 0,
            padding: "10px 12px",
            borderRadius: 8,
            background: "#ecfdf5",
            border: "1px solid #a7f3d0",
            fontSize: 13,
            color: "#14532d",
            lineHeight: 1.55,
          }}
        >
          <strong>In pratica oggi:</strong> per pubblicare codice → un deploy piattaforma. Per far uscire un locale sul
          suo dominio → Pubblicazione dominio + DNS + Auth. Sotto restano elenco clienti e checklist di verifica
          go-live (utile, ma non sostituisce i passi DNS).
        </p>
      </section>

      <p style={{ maxWidth: "100%", fontSize: 15, lineHeight: 1.65, color: "#334155", marginBottom: 24 }}>
        Usa l&apos;elenco sotto per scegliere il cliente, controllare slug / dominio e completare la checklist di
        verifica. La configurazione tecnica del dominio resta in{" "}
        <Link
          to="/superadmin/pubblicazione-sito"
          style={{ color: "#c0392b", fontWeight: 700 }}
        >
          Pubblicazione dominio
        </Link>
        .
      </p>

      <section className="dashboard-box dashboard-settings-section" style={sectionCardStyle}>
        <h2 className="dashboard-settings-section-title">Flusso go-live (senza macchinismi)</h2>
        <p style={{ margin: "0 0 12px", fontSize: 14, color: "#475569", lineHeight: 1.65 }}>
          Separare sempre <strong>aggiornamento piattaforma</strong> e <strong>attivazione dominio cliente</strong>:
        </p>
        <ol style={{ margin: 0, paddingLeft: 20, fontSize: 14, lineHeight: 1.8, color: "#334155" }}>
          <li>
            Seleziona il cliente e verifica slug (URL piattaforma) e dominio pubblico, se già impostato.
          </li>
          <li>
            Apri{" "}
            <Link to="/superadmin/pubblicazione-sito" style={{ fontWeight: 700, color: "#c0392b" }}>
              Pubblicazione dominio
            </Link>{" "}
            → salva hostname → configura CNAME verso Firebase.
          </li>
          <li>Completa la checklist di verifica sotto (menu, legali, smoke test).</li>
          <li>
            Solo se hai cambiato il codice prodotto: un deploy globale (
            <code>npm run deploy:full:ci</code>), non «per questo cliente».
          </li>
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
          Nota: un deploy piattaforma aggiorna automaticamente l&apos;esperienza di <strong>tutti</strong> i clienti
          già online.
        </div>
      </section>

      <section className="dashboard-box dashboard-settings-section" style={sectionCardStyle}>
        <h2 className="dashboard-settings-section-title">Clienti collegati al deploy</h2>
        <p style={{ margin: "0 0 10px", fontSize: 14, color: "#475569" }}>
          Questa pagina ora usa i dati reali dei clienti registrati (tenant) per preparare e tracciare il go-live.
        </p>
        <div style={{ marginBottom: 12, maxWidth: "min(480px, 100%)" }}>
          <SaListSearchField
            id="sa-deploy-tenants-search"
            value={query}
            onChange={setQuery}
            placeholder="Cerca per nome, slug o URL sito web…"
            resultsCount={filteredTenants.length}
            totalCount={tenants.length}
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
          <li>Verifica anagrafica e slug (URL su piattaforma).</li>
          <li>Configura dominio menu in Pubblicazione dominio + DNS CNAME verso Firebase.</li>
          <li>Aggiungi Redirect URL Auth Supabase per quel hostname.</li>
          <li>Smoke test: home, menu, login, privacy/cookie/termini.</li>
          <li>Deploy codice solo se hai rilasciato nuove funzioni piattaforma (globale, non per-tenant).</li>
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
