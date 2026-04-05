import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { SERVIZI_APP } from "@/config/serviziAppRegistro";
import { schedaImplementazioneForServizioId } from "@/config/serviziModuliMap";
import { loadServicesCatalog } from "@/features/superadmin/catalog/servicesStorage";
import { IDS_BASE, IDS_ENTERPRISE, IDS_PRO } from "@/features/superadmin/catalog/defaultCatalog";

/** Allineato a AppRouter: host piattaforma SaaS vs dominio vetrina pizzeria. */
function isSaaSHost() {
  if (typeof window === "undefined") return true;
  const host = window.location.hostname;
  return (
    host === "pizzamanager.it" ||
    host.startsWith("app.") ||
    host === "support.pizzamanager.it" ||
    host.includes("localhost") ||
    host.includes("127.0.0.1")
  );
}

/** Route registrate solo se `!isSaaS` nel router (dominio pizzeria). */
const PATHS_SOLO_DOMINIO_PIZZERIA = new Set(["/ordine", "/ordine-confermato"]);

function collectSchedaPaths(impl) {
  if (!impl?.moduli?.length) return [];
  const seen = new Set();
  const out = [];
  for (const m of impl.moduli) {
    for (const p of m.paths || []) {
      const path = String(p || "").trim();
      if (!path || seen.has(path)) continue;
      seen.add(path);
      out.push(path);
    }
  }
  return out;
}

const btnBack = {
  display: "inline-block",
  padding: "10px 20px",
  background: "#d35400",
  color: "#fff",
  borderRadius: 6,
  textDecoration: "none",
  fontWeight: 600,
  fontSize: 14,
};

function pianiCheIncludono(id) {
  if (IDS_BASE.includes(id)) return "Base, Pro, Enterprise, Full";
  if (IDS_PRO.includes(id)) return "Pro, Enterprise, Full";
  if (IDS_ENTERPRISE.includes(id)) return "Enterprise, Full";
  return "Full (intero catalogo) o Su misura se selezionato manualmente";
}

export default function ServizioSchedaPage() {
  const { servizioId } = useParams();
  const saas = isSaaSHost();
  const schedaRegistro = useMemo(
    () => SERVIZI_APP.find((s) => s.id === servizioId) ?? null,
    [servizioId],
  );
  const catalogRow = useMemo(() => {
    const list = loadServicesCatalog();
    return list.find((s) => s.id === servizioId) ?? null;
  }, [servizioId]);
  const impl = servizioId ? schedaImplementazioneForServizioId(servizioId) : null;
  const tryPaths = useMemo(() => collectSchedaPaths(impl), [impl]);

  if (!servizioId) {
    return (
      <>
        <Link to="/superadmin/servizi" style={btnBack}>
          ← Catalogo servizi
        </Link>
        <h1 className="dashboard-page-title" style={{ marginTop: 20 }}>
          Servizio non trovato
        </h1>
      </>
    );
  }

  if (!schedaRegistro && catalogRow) {
    const avCustom = Number(catalogRow.avanzamentoPercentuale) || 0;
    return (
      <>
        <div style={{ marginBottom: 16 }}>
          <Link to="/superadmin/servizi" style={btnBack}>
            ← Catalogo servizi
          </Link>
        </div>
        <h1 className="dashboard-page-title">{catalogRow.nome}</h1>
        <p style={{ margin: "8px 0 20px", fontSize: 14, color: "#64748b", maxWidth: 820, lineHeight: 1.6 }}>
          <strong>ID</strong> <code style={{ fontSize: 13 }}>{catalogRow.id}</code> — servizio aggiunto al catalogo senza voce in{" "}
          <code>serviziAppRegistro.js</code>. Nessuna mappa automatica route / piani.
        </p>
        <div className="dashboard-box">
          <p style={{ margin: 0, fontSize: 14, color: "#334155" }}>
            Avanzamento salvato: <strong>{avCustom}%</strong>
          </p>
        </div>
      </>
    );
  }

  if (!schedaRegistro) {
    return (
      <>
        <Link to="/superadmin/servizi" style={btnBack}>
          ← Catalogo servizi
        </Link>
        <h1 className="dashboard-page-title" style={{ marginTop: 20 }}>
          Servizio non trovato
        </h1>
        <p style={{ color: "#64748b" }}>L&apos;id <code>{servizioId}</code> non è nel registro né nel catalogo locale.</p>
      </>
    );
  }

  const avanzamento = Number(catalogRow?.avanzamentoPercentuale ?? schedaRegistro.avanzamentoDefaultPercentuale) || 0;

  return (
    <>
      <div style={{ marginBottom: 16 }}>
        <Link to="/superadmin/servizi" style={btnBack}>
          ← Catalogo servizi
        </Link>
        <Link to="/superadmin/sviluppo" style={{ ...btnBack, marginLeft: 12, background: "#5b21b6" }}>
          Roadmap sviluppo
        </Link>
      </div>

      <h1 className="dashboard-page-title">{schedaRegistro.nome}</h1>
      <p style={{ margin: "8px 0 20px", fontSize: 14, color: "#64748b", maxWidth: 820, lineHeight: 1.6 }}>
        <strong>ID</strong> <code style={{ fontSize: 13 }}>{schedaRegistro.id}</code>
        <span style={{ margin: "0 12px", color: "#cbd5e1" }}>|</span>
        <strong>Categoria</strong> {schedaRegistro.categoria}
        <span style={{ margin: "0 12px", color: "#cbd5e1" }}>|</span>
        <strong>Avanzamento</strong> {avanzamento}% (da catalogo locale; default registro:{" "}
        {schedaRegistro.avanzamentoDefaultPercentuale}%)
      </p>

      <div className="dashboard-box" style={{ marginBottom: 20 }}>
        <h2 style={{ marginTop: 0, fontSize: 17 }}>Piani commerciali suggeriti</h2>
        <p style={{ margin: 0, fontSize: 14, color: "#334155", lineHeight: 1.6 }}>{pianiCheIncludono(schedaRegistro.id)}</p>
      </div>

      <div className="dashboard-box" style={{ marginBottom: 20 }}>
        <h2 style={{ marginTop: 0, fontSize: 17 }}>Funzioni (registro)</h2>
        <ul style={{ margin: 0, paddingLeft: 20, fontSize: 14, color: "#334155", lineHeight: 1.65 }}>
          {schedaRegistro.funzioni.map((f, i) => (
            <li key={i}>{f}</li>
          ))}
        </ul>
      </div>

      {tryPaths.length > 0 ? (
        <div className="dashboard-box" style={{ marginBottom: 20, border: "1px solid #86efac", background: "#f0fdf4" }}>
          <h2 style={{ marginTop: 0, fontSize: 17, color: "#14532d" }}>Prova in app</h2>
          <p style={{ margin: "0 0 12px", fontSize: 14, color: "#166534", lineHeight: 1.6 }}>
            Apri le route nel browser (stessa scheda). Per <strong>/admin/*</strong> e <strong>/operative/*</strong> serve login con
            ruolo e tenant adeguati; per <strong>/superadmin/*</strong> serve Super Admin.
          </p>
          <ul style={{ margin: 0, paddingLeft: 20, fontSize: 14, lineHeight: 1.85 }}>
            {tryPaths.map((path) => {
              if (PATHS_SOLO_DOMINIO_PIZZERIA.has(path) && saas) {
                return (
                  <li key={path}>
                    <code style={{ fontSize: 13 }}>{path}</code>
                    <span style={{ color: "#64748b", marginLeft: 8 }}>
                      — non è registrata su questo host (piattaforma SaaS); usa il dominio Firebase della pizzeria.
                    </span>
                  </li>
                );
              }
              return (
                <li key={path}>
                  <Link to={path} style={{ fontWeight: 600 }}>
                    Apri {path}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      <div className="dashboard-box" style={{ marginBottom: 20 }}>
        <h2 style={{ marginTop: 0, fontSize: 17 }}>Implementazione in app</h2>
        {impl?.sintesi ? (
          <p style={{ margin: "0 0 16px", fontSize: 14, color: "#334155", lineHeight: 1.65 }}>{impl.sintesi}</p>
        ) : null}
        {impl?.moduli?.length ? (
          <ul style={{ margin: 0, paddingLeft: 20, fontSize: 14, color: "#334155", lineHeight: 1.7 }}>
            {impl.moduli.map((m, i) => (
              <li key={i}>
                <strong>{m.label}</strong>
                {m.paths?.length ? (
                  <>
                    :{" "}
                    {m.paths.map((p, j) => (
                      <code key={j} style={{ fontSize: 12, marginRight: 6 }}>
                        {p}
                      </code>
                    ))}
                  </>
                ) : null}
                {m.note ? <span style={{ color: "#64748b" }}> — {m.note}</span> : null}
              </li>
            ))}
          </ul>
        ) : (
          <p style={{ margin: 0, fontSize: 14, color: "#64748b" }}>Nessun modulo UI mappato (offerta commerciale o roadmap).</p>
        )}
        {impl?.riferimentiCodice?.length ? (
          <div style={{ marginTop: 16 }}>
            <strong style={{ fontSize: 13 }}>Riferimenti codice / note</strong>
            <ul style={{ margin: "8px 0 0", paddingLeft: 20, fontSize: 13, color: "#475569" }}>
              {impl.riferimentiCodice.map((r, i) => (
                <li key={i}>
                  <code style={{ fontSize: 12 }}>{r}</code>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      <div className="dashboard-box" style={{ marginBottom: 20 }}>
        <h2 style={{ marginTop: 0, fontSize: 17 }}>Gate da piano (opzionale)</h2>
        <p style={{ margin: 0, fontSize: 14, color: "#334155", lineHeight: 1.65 }}>
          Con <code>VITE_ENFORCE_SERVIZI_PLAN=true</code> l&apos;app nasconde le aree non coperte dal bundle effettivo del tenant
          (<code>piano</code> e, se valorizzato, <code>parametri_operativi.servizi_abilitati</code>).{" "}
          <code>VITE_DISABLE_SERVIZI_GATE=true</code> disattiva il gate anche se ENFORCE è attivo. Vedi{" "}
          <code>useTenantServizi</code> e <Link to="/superadmin/piani">Piani</Link>.
        </p>
      </div>

      <p style={{ fontSize: 13, color: "#94a3b8" }}>
        Riferimento registro: <code>{schedaRegistro.codiceRiferimento ?? "—"}</code>
      </p>
    </>
  );
}
