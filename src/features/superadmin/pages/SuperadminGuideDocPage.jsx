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
  "punto-situazione-webapp": () => import("@docs/PUNTO_SITUAZIONE_WEBAPP_COMPLETA.md?raw"),
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
  "punto-situazione-webapp": "Punto della situazione — webapp completa",
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
