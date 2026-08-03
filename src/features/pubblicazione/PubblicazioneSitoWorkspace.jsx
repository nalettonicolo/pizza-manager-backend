import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { getTenant, updateTenantPublicDomain } from "@/features/superadmin/services/superadminService";
import {
  PUBLIC_DOMAIN_CNAME_TARGET,
  PUBLIC_DOMAIN_FIREBASE_DOCS_URL,
  PUBLIC_SAAS_BASE_URL,
} from "@/config/publicDomain";
import {
  isPlausibleHostname,
  normalizeClienteSitoWebUrl,
  normalizePublicDomainHostname,
} from "@/utils/publicDomain";
import PubblicazioneDeployGuideModal from "@/features/admin/pages/PubblicazioneDeployGuideModal";

const DEFAULT_BASE_PATH = "/superadmin/go-live";

const DOMAIN_STATUS = [
  { value: "none", label: "Non configurato" },
  { value: "requested", label: "Richiesta salvata in piattaforma" },
  { value: "dns_pending", label: "DNS / Firebase in configurazione" },
  { value: "live", label: "Dominio online" },
];

const card = {
  marginBottom: 20,
  padding: 22,
  borderRadius: 12,
  border: "1px solid #e2e8f0",
  background: "#fff",
  boxShadow: "0 4px 14px rgba(15, 23, 42, 0.05)",
};

const labelStyle = { display: "block", fontSize: 13, fontWeight: 600, color: "#334155", marginBottom: 6 };

/** Form dominio / stato pubblicazione — solo Super Admin (console piattaforma). */
export default function PubblicazioneSitoWorkspace({ tenantId, basePath = DEFAULT_BASE_PATH, embedded = false }) {
  const location = useLocation();
  const BASE_PATH = basePath || DEFAULT_BASE_PATH;
  const [guideOpen, setGuideOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [savedMsg, setSavedMsg] = useState(null);

  const [slug, setSlug] = useState("");
  const [nome, setNome] = useState("");
  const [domainInput, setDomainInput] = useState("");
  const [sitoWebClienteInput, setSitoWebClienteInput] = useState("");
  const [status, setStatus] = useState("none");
  const [requestedAt, setRequestedAt] = useState(null);

  const load = useCallback(async () => {
    if (!tenantId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const row = await getTenant(tenantId);
      setSlug(String(row?.slug || ""));
      setNome(String(row?.nome || ""));
      setDomainInput(row?.public_domain ? String(row.public_domain) : "");
      setSitoWebClienteInput(row?.sito_web_cliente ? String(row.sito_web_cliente) : "");
      setStatus(
        row?.public_domain_status && DOMAIN_STATUS.some((s) => s.value === row.public_domain_status)
          ? row.public_domain_status
          : "none",
      );
      setRequestedAt(row?.public_domain_requested_at || null);
    } catch (e) {
      setError(e?.message || "Impossibile caricare i dati.");
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    void load();
  }, [load]);

  const openGuide = useCallback(() => setGuideOpen(true), []);
  const closeGuide = useCallback(() => {
    setGuideOpen(false);
    if (window.location.hash === "#guida-deploy") {
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
    }
  }, []);

  useEffect(() => {
    if (location.hash === "#guida-deploy") {
      setGuideOpen(true);
    }
  }, [location.hash]);

  const defaultPlatformUrl = useMemo(() => {
    if (!slug) return `${PUBLIC_SAAS_BASE_URL.replace(/\/$/, "")}/negozio`;
    return `https://${slug}.pizzamanager.it`;
  }, [slug]);

  const normalizedPreview = useMemo(() => normalizePublicDomainHostname(domainInput), [domainInput]);

  const onSave = async () => {
    if (!tenantId) return;
    const normalized = normalizePublicDomainHostname(domainInput);
    if (domainInput.trim() && !isPlausibleHostname(normalized)) {
      setError("Inserisci un dominio valido (es. menu.tuosito.it) senza https://");
      return;
    }
    const normalizedSitoWeb = normalizeClienteSitoWebUrl(sitoWebClienteInput);
    if (sitoWebClienteInput.trim() && !normalizedSitoWeb) {
      setError("URL del sito web non valido (es. https://sites.google.com/view/... )");
      return;
    }
    setSaving(true);
    setError(null);
    setSavedMsg(null);
    try {
      const nowIso = new Date().toISOString();
      const payload = {
        public_domain: normalized,
        public_domain_status: normalized ? status || "requested" : "none",
        public_domain_requested_at: normalized ? nowIso : null,
        sito_web_cliente: normalizedSitoWeb,
      };
      await updateTenantPublicDomain(tenantId, payload);
      setRequestedAt(payload.public_domain_requested_at);
      setSavedMsg("Salvato. Completa DNS e Firebase come da guida.");
      await load();
    } catch (e) {
      setError(e?.message || "Salvataggio non riuscito.");
    } finally {
      setSaving(false);
    }
  };

  const copy = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      setSavedMsg("Copiato negli appunti.");
      setTimeout(() => setSavedMsg(null), 2500);
    } catch {
      setError("Impossibile copiare (permessi browser).");
    }
  };

  if (!tenantId) return null;

  return (
    <div className={embedded ? undefined : "dashboard-settings-page"}>
      {!embedded ? (
        <p style={{ maxWidth: "100%", fontSize: 15, lineHeight: 1.65, color: "#334155", marginBottom: 14 }}>
          Sul <strong>dominio del cliente</strong> viene servito lo stesso <strong>frontend</strong> della webapp (build
          unica su Firebase): a runtime, le <strong>impostazioni del tenant</strong> (menu, layout, orari, dati pizzeria) si
          applicano in base all&apos;hostname. Qui registri dominio e stato operativo; DNS e SSL si configurano in Firebase
          e dal registrar.
        </p>
      ) : null}

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 12,
          marginBottom: 22,
          padding: "14px 16px",
          borderRadius: 10,
          border: "1px solid #fecaca",
          background: "linear-gradient(135deg, #fff7ed 0%, #fff 50%)",
        }}
      >
        <div style={{ flex: "1 1 220px" }}>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#9a3412" }}>Guida dominio / DNS</p>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "#64748b", lineHeight: 1.5 }}>
            Passi: slug → salva dominio menu → Firebase host → DNS CNAME. Il deploy codice è globale (
            <code>npm run deploy:full:ci</code>), non per ogni cliente.
          </p>
        </div>
        <button
          type="button"
          onClick={openGuide}
          className="btn-primary"
          style={{ padding: "10px 18px", fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}
        >
          Apri guida passo passo
        </button>
        <Link
          to={`${BASE_PATH}#guida-deploy`}
          onClick={(e) => {
            e.preventDefault();
            openGuide();
            window.history.replaceState(null, "", `${BASE_PATH}${location.search || ""}#guida-deploy`);
          }}
          style={{ fontSize: 13, color: "#c0392b", fontWeight: 600 }}
        >
          Link diretto a questa guida
        </Link>
      </div>

      <PubblicazioneDeployGuideModal open={guideOpen} onClose={closeGuide} />

      {loading ? (
        <p style={{ color: "#64748b" }}>Caricamento…</p>
      ) : (
        <>
          {error ? (
            <div
              style={{
                marginBottom: 16,
                padding: "10px 12px",
                borderRadius: 8,
                background: "#fef2f2",
                border: "1px solid #fecaca",
                color: "#991b1b",
                fontSize: 14,
              }}
            >
              {error}
            </div>
          ) : null}
          {savedMsg ? (
            <div
              style={{
                marginBottom: 16,
                padding: "10px 12px",
                borderRadius: 8,
                background: "#f0fdf4",
                border: "1px solid #bbf7d0",
                color: "#166534",
                fontSize: 14,
              }}
            >
              {savedMsg}
            </div>
          ) : null}

          <p style={{ margin: "0 0 16px", fontSize: 14, color: "#475569" }}>
            Cliente: <strong>{nome || "—"}</strong> · slug: <strong>{slug || "—"}</strong>
          </p>

          <section className="dashboard-box dashboard-settings-section" style={card}>
            <h2 className="dashboard-settings-section-title" style={{ marginTop: 0 }}>
              1. URL sulla piattaforma (subdominio)
            </h2>
            <p style={{ margin: "0 0 8px", fontSize: 14, color: "#475569" }}>
              Subito disponibile dopo il deploy, senza dominio dedicato:
            </p>
            <p style={{ margin: 0, fontSize: 15 }}>
              <code style={{ background: "#f1f5f9", padding: "4px 8px", borderRadius: 6 }}>{defaultPlatformUrl}</code>
            </p>
          </section>

          <section className="dashboard-box dashboard-settings-section" style={card}>
            <h2 className="dashboard-settings-section-title" style={{ marginTop: 0 }}>
              2. Dominio del cliente (vetrina/menu)
            </h2>
            <div
              style={{
                margin: "0 0 12px",
                padding: "10px 12px",
                borderRadius: 8,
                border: "1px solid #bfdbfe",
                background: "#eff6ff",
                color: "#1e40af",
                fontSize: 13,
                lineHeight: 1.55,
              }}
            >
              <strong>Regola chiave:</strong> qui va solo l&apos;<strong>hostname pubblico</strong> che deve aprire la webapp
              PizzaManager (senza <code>https://</code>). Deve coincidere con dominio aggiunto su Firebase e record DNS.
            </div>
            <p style={{ margin: "0 0 14px", fontSize: 14, lineHeight: 1.65, color: "#475569" }}>
              Inserisci l&apos;hostname che deve aprire la webapp (deve coincidere con il dominio aggiunto in Firebase
              Hosting e con il record DNS). Esempi: <code>menu.tuonome.it</code>, <code>ordini.ristorante.it</code>.
            </p>

            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Dominio menu (pubblico)</label>
              <input
                type="text"
                value={domainInput}
                onChange={(e) => setDomainInput(e.target.value)}
                placeholder="es. menu.ristorante.it"
                style={{
                  width: "100%",
                  maxWidth: 420,
                  padding: "10px 12px",
                  borderRadius: 8,
                  border: "1px solid #cbd5e1",
                  fontSize: 15,
                }}
                autoComplete="off"
              />
              {normalizedPreview ? (
                <p style={{ margin: "8px 0 0", fontSize: 13, color: "#64748b" }}>
                  Salvataggio come: <strong>{normalizedPreview}</strong>
                </p>
              ) : null}
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Sito web marketing (opzionale)</label>
              <p style={{ margin: "0 0 8px", fontSize: 13, color: "#64748b", lineHeight: 1.55 }}>
                Solo se il locale ha un sito vetrina esterno diverso dal dominio menu PizzaManager (es. Google Sites).
                Non sostituisce il dominio menu per ordini.
              </p>
              <input
                type="url"
                value={sitoWebClienteInput}
                onChange={(e) => setSitoWebClienteInput(e.target.value)}
                placeholder="https://sites.google.com/view/..."
                style={{
                  width: "100%",
                  maxWidth: 520,
                  padding: "10px 12px",
                  borderRadius: 8,
                  border: "1px solid #cbd5e1",
                  fontSize: 15,
                }}
                autoComplete="url"
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Stato pubblicazione</label>
              <p style={{ margin: "0 0 8px", fontSize: 13, color: "#64748b", lineHeight: 1.5 }}>
                Usa <strong>DNS / Firebase in configurazione</strong> finché propagazione e certificato SSL non sono
                completati. Passa a <strong>Dominio online</strong> solo dopo test reale del dominio cliente.
              </p>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                style={{
                  maxWidth: 420,
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 8,
                  border: "1px solid #cbd5e1",
                  fontSize: 14,
                  background: "#fff",
                }}
              >
                {DOMAIN_STATUS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            {requestedAt ? (
              <p style={{ fontSize: 13, color: "#64748b", marginBottom: 12 }}>
                Ultimo aggiornamento richiesta: {new Date(requestedAt).toLocaleString("it-IT")}
              </p>
            ) : null}

            <button
              type="button"
              className="btn-primary"
              disabled={saving}
              onClick={() => void onSave()}
              style={{ padding: "10px 20px", fontWeight: 700, cursor: saving ? "wait" : "pointer" }}
            >
              {saving ? "Salvataggio…" : "Salva dominio e stato"}
            </button>
          </section>

          <section className="dashboard-box dashboard-settings-section" style={card}>
            <h2 className="dashboard-settings-section-title" style={{ marginTop: 0 }}>
              3. DNS del cliente
            </h2>
            <p style={{ margin: "0 0 12px", fontSize: 14, lineHeight: 1.65, color: "#475569" }}>
              Dal pannello DNS del dominio acquistato dal cliente (es. Aruba, OVH, Cloudflare), crea un record che punti
              all&apos;hosting della webapp. Guide dettagliate per ogni registrar: sezione{" "}
              <a href="#guida-dns-host" style={{ fontWeight: 600, color: "#c0392b" }}>
                Guide DNS per host
              </a>{" "}
              nella pagina Go-live, oppure «Apri guida passo passo».
            </p>
            <ul style={{ margin: "0 0 12px", paddingLeft: 20, fontSize: 14, color: "#334155", lineHeight: 1.7 }}>
              <li>
                Tipo: <strong>CNAME</strong> (consigliato per sottodominio) oppure A/ALIAS se il registrar lo richiede —
                segui la procedura Firebase dopo aver aggiunto il dominio.
              </li>
              <li>
                Nome / Host: la parte che hai scelto (es. <code>menu</code> per <code>menu.esempio.it</code>).
              </li>
              <li>
                Valore / Target:{" "}
                <code style={{ background: "#f1f5f9", padding: "2px 6px", borderRadius: 4 }}>
                  {PUBLIC_DOMAIN_CNAME_TARGET}
                </code>{" "}
                <button
                  type="button"
                  onClick={() => void copy(PUBLIC_DOMAIN_CNAME_TARGET)}
                  style={{
                    marginLeft: 8,
                    padding: "4px 10px",
                    fontSize: 12,
                    borderRadius: 6,
                    border: "1px solid #cbd5e1",
                    background: "#fff",
                    cursor: "pointer",
                  }}
                >
                  Copia target
                </button>
              </li>
            </ul>
            <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>
              Il target esatto può essere fornito da Firebase dopo l&apos;aggiunta del dominio (a volte è un dominio{" "}
              <code>*.web.app</code>). Allinea sempre DNS e Firebase allo stesso hostname salvato sopra.
            </p>
          </section>

          <section className="dashboard-box dashboard-settings-section" style={card}>
            <h2 className="dashboard-settings-section-title" style={{ marginTop: 0 }}>
              4. Firebase Hosting (certificato SSL)
            </h2>
            <p style={{ margin: "0 0 10px", fontSize: 14, lineHeight: 1.65, color: "#475569" }}>
              Nel progetto Firebase che ospita <code>pizzamanager.it</code>, aggiungi il{" "}
              <strong>dominio personalizzato</strong> e completa la verifica. Dopo la propagazione DNS, HTTPS sarà attivo.
            </p>
            <a
              href={PUBLIC_DOMAIN_FIREBASE_DOCS_URL}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "#c0392b", fontWeight: 600, fontSize: 14 }}
            >
              Guida ufficiale Firebase: dominio personalizzato →
            </a>
          </section>

          <section className="dashboard-box dashboard-settings-section" style={card}>
            <h2 className="dashboard-settings-section-title" style={{ marginTop: 0 }}>
              5. Collegare Google Sites o altri siti
            </h2>
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.65, color: "#475569" }}>
              Su Google Sites non si carica la webapp: usa un <strong>link</strong> o un pulsante &quot;Menu / Ordina&quot;
              che punta all&apos;URL pubblico (subdominio <code>pizzamanager.it</code> o il dominio dedicato dopo il punto
              2). Il menu resta servito da PizzaManager.
            </p>
          </section>

          <section className="dashboard-box dashboard-settings-section" style={card}>
            <h2 className="dashboard-settings-section-title" style={{ marginTop: 0 }}>
              Checklist dati locale
            </h2>
            <ul style={{ margin: 0, paddingLeft: 20, fontSize: 14, lineHeight: 1.75, color: "#334155" }}>
              <li>
                <strong>Dati pizzeria</strong>, <strong>layout</strong>, <strong>orari</strong> e menu: li completa
                l&apos;admin del locale da <strong>Admin → Impostazioni</strong> (non da questa console).
              </li>
              <li>
                Verifica che il dominio salvato in sezione 2 coincida con Firebase e DNS prima di segnare <em>Live</em>.
              </li>
            </ul>
          </section>

          <section className="dashboard-box" style={{ ...card, background: "#f8fafc" }}>
            <p style={{ margin: 0, fontSize: 13, color: "#64748b", lineHeight: 1.6 }}>
              Dopo aver applicato la migrazione Supabase <code>20260323120000_tenants_public_domain_and_rpc.sql</code>, la
              vetrina sul dominio cliente risolve automaticamente il tenant tramite <code>public_domain</code>. Variabili
              opzionali: <code>VITE_PUBLIC_DOMAIN_CNAME_TARGET</code>, <code>VITE_PUBLIC_SAAS_BASE_URL</code> (vedi{" "}
              <code>.env.production</code>).
            </p>
          </section>
        </>
      )}
    </div>
  );
}
