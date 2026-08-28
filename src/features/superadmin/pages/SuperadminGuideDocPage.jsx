import { useEffect, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";

const LOADERS = {
  superadmin: () => import("@docs/GUIDA_SUPERADMIN.md?raw"),
  admin: () => import("@docs/GUIDA_ADMIN.md?raw"),
  utente: () => import("@/content/manualeUtente.md?raw"),
  architettura: () => import("@docs/ARCHITETTURA_E_STATO.md?raw"),
  "architettura-api-ruoli": () => import("@docs/ARCHITETTURA_API_E_RUOLI.md?raw"),
  "csv-ingredienti": () => import("@docs/GUIDA_CSV_INGREDIENTI.md?raw"),
  deploy: () => import("@root/DEPLOY_COMANDI.md?raw"),
  "roadmap-cassa-enterprise": () => import("@docs/ROADMAP_CASSA_ENTERPRISE.md?raw"),
  "backlog-stato-sviluppo": () => import("@docs/BACKLOG_E_STATO_SVILUPPO.md?raw"),
  "analisi-fiscale-questionario": () => import("@docs/ANALISI_PERIMETRO_FISCALE_E_QUESTIONARIO_SVILUPPO.md?raw"),
  "analisi-gestionale-questionario": () => import("@docs/ANALISI_GESTIONALE_COMPLETO_E_QUESTIONARIO_SVILUPPO.md?raw"),
  "qa-smoke-checklist": () => import("@docs/QA_CHECKLIST_SMOKE.md?raw"),
  "punto-situazione-indice": () => import("@docs/punto-situazione/README.md?raw"),
  "punto-situazione-architettura": () => import("@docs/punto-situazione/01_architettura.md?raw"),
  "punto-situazione-prodotto": () => import("@docs/punto-situazione/02_prodotto.md?raw"),
  "punto-situazione-database": () => import("@docs/punto-situazione/03_database.md?raw"),
  "punto-situazione-code": () => import("@docs/punto-situazione/04_code.md?raw"),
  "punto-situazione-ui": () => import("@docs/punto-situazione/05_ui.md?raw"),
  "punto-situazione-dataflows": () => import("@docs/punto-situazione/06_dataflows.md?raw"),
  "punto-situazione-security": () => import("@docs/punto-situazione/07_security.md?raw"),
  "punto-situazione-test": () => import("@docs/punto-situazione/08_test.md?raw"),
  "punto-situazione-copywriter": () => import("@docs/punto-situazione/09_copywriter.md?raw"),
  "punto-situazione-supervisor": () => import("@docs/punto-situazione/10_supervisor.md?raw"),
  "punto-situazione-priorita": () => import("@docs/punto-situazione/11_priorita_operative.md?raw"),
  "go-live-francy-runbook": () => import("@docs/GO_LIVE_FRANCY_RUNBOOK.md?raw"),
  // Alias legacy (documento monolite rimosso)
  "punto-situazione-webapp": () => import("@docs/punto-situazione/README.md?raw"),
};

const TITLES = {
  superadmin: "Guida Super Admin",
  admin: "Guida Admin (tenant)",
  utente: "Manuale utente (tenant)",
  architettura: "Architettura e stato",
  "architettura-api-ruoli": "Architettura API e ruoli",
  "csv-ingredienti": "Guida CSV ingredienti",
  deploy: "Comandi deploy",
  "roadmap-cassa-enterprise": "Roadmap enterprise (cassa → offline → fiscale IT)",
  "backlog-stato-sviluppo": "Backlog e stato sviluppo",
  "analisi-fiscale-questionario": "Analisi perimetro fiscale (questionario)",
  "analisi-gestionale-questionario": "Analisi gestionale completo (questionario)",
  "qa-smoke-checklist": "QA — checklist smoke test",
  "punto-situazione-indice": "Punto situazione — indice per settore",
  "punto-situazione-architettura": "Punto situazione — Architettura",
  "punto-situazione-prodotto": "Punto situazione — Prodotto",
  "punto-situazione-database": "Punto situazione — Database",
  "punto-situazione-code": "Punto situazione — Code",
  "punto-situazione-ui": "Punto situazione — UI / UX",
  "punto-situazione-dataflows": "Punto situazione — Dataflows",
  "punto-situazione-security": "Punto situazione — Security",
  "punto-situazione-test": "Punto situazione — Test / QA",
  "punto-situazione-copywriter": "Punto situazione — Copywriter",
  "punto-situazione-supervisor": "Punto situazione — Supervisore",
  "punto-situazione-priorita": "Punto situazione — Priorità operative",
  "go-live-francy-runbook": "Go-live (Stripe / dominio / P3)",
  "punto-situazione-webapp": "Punto situazione — indice per settore",
};

export default function SuperadminGuideDocPage() {
  const { docSlug } = useParams();
  const [text, setText] = useState("");
  const [err, setErr] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const loader = LOADERS[docSlug];
    if (!loader) return;
    setErr(null);
    setText("");
    loader()
      .then((mod) => {
        if (!cancelled) setText(typeof mod.default === "string" ? mod.default : "");
      })
      .catch((e) => {
        if (!cancelled) setErr(e?.message ?? "Impossibile caricare il documento");
      });
    return () => {
      cancelled = true;
    };
  }, [docSlug]);

  if (!LOADERS[docSlug]) {
    return <Navigate to="/superadmin/guide" replace />;
  }

  return (
    <div className="guida-utente">
      <div style={{ marginBottom: 16 }}>
        <Link to="/superadmin/guide" className="sa-back-link">
          ← Tutte le guide
        </Link>
      </div>
      <h1 className="dashboard-page-title sa-page-title">{TITLES[docSlug] ?? docSlug}</h1>
      {err && <div className="dashboard-error">{err}</div>}
      {!err && !text && <div className="dashboard-loading">Caricamento…</div>}
      {text ? (
        <div className="guida-utente-body">
          <ReactMarkdown
            components={{
              a: ({ href, children, ...props }) => {
                const ext =
                  href &&
                  (href.startsWith("http://") || href.startsWith("https://") || href.startsWith("//"));
                return (
                  <a href={href} {...(ext ? { target: "_blank", rel: "noopener noreferrer" } : {})} {...props}>
                    {children}
                  </a>
                );
              },
              table: ({ children }) => (
                <div className="guida-utente-table-wrap">
                  <table>{children}</table>
                </div>
              ),
            }}
          >
            {text.replace(/<!--[\s\S]*?-->/g, "").trim()}
          </ReactMarkdown>
        </div>
      ) : null}
    </div>
  );
}
