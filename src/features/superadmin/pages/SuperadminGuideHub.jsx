import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import SaListSearchField from "@/features/superadmin/components/SaListSearchField";
import { normalizeListSearchQuery, rowMatchesListSearch } from "@/utils/listSearchFilter";

const DOCS = [
  {
    slug: "superadmin",
    title: "Guida Super Admin",
    description: "Console piattaforma: clienti, piani/listino, servizi, deploy, abbonamenti, landing/contatti.",
  },
  {
    slug: "admin",
    title: "Guida Admin (tenant)",
    description: "Pizzeria: menu, impostazioni, ruoli, report; pubblicazione dominio solo in Super Admin.",
  },
  {
    slug: "utente",
    title: "Manuale utente (tenant)",
    description: "Manuale titolare/staff (stesso testo di Admin → Manuale).",
  },
  {
    slug: "architettura",
    title: "Architettura e stato",
    description: "Route, roadmap vs codice, sito pubblico, enforcement servizi.",
  },
  {
    slug: "architettura-api-ruoli",
    title: "Architettura API e ruoli",
    description: "Supabase vs backend Nest (VITE_API_URL), flussi dati, env, compliance.",
  },
  {
    slug: "csv-ingredienti",
    title: "Guida CSV ingredienti",
    description: "Import ingredienti: Formato A e B, allergeni, UTF-8.",
  },
  {
    slug: "deploy",
    title: "Comandi deploy",
    description: "Build, Firebase Hosting, note backend e Supabase.",
  },
];

/** Documenti product/engineering (stessa cartella `docs/`, link dalla pagina Roadmap). */
const DOCS_SVILUPPO = [
  {
    slug: "roadmap-cassa-enterprise",
    title: "Roadmap enterprise cassa",
    description: "Blocchi cassa, offline, fiscale IT; allineamento DB e perimetro normativo.",
  },
  {
    slug: "backlog-stato-sviluppo",
    title: "Backlog e stato sviluppo",
    description: "Cosa è realistico in codice, dipendenze esterne, ordine di lavoro.",
  },
  {
    slug: "analisi-fiscale-questionario",
    title: "Questionario perimetro fiscale (IT)",
    description: "Stakeholder, RT/corrispettivi, integrazioni — non sostituisce il commercialista.",
  },
  {
    slug: "analisi-gestionale-questionario",
    title: "Questionario gestionale completo",
    description: "Scope moduli, priorità, migrazione localStorage → Supabase.",
  },
  {
    slug: "qa-smoke-checklist",
    title: "QA — smoke test",
    description: "Checklist manuale pre/post deploy e Supabase Auth.",
  },
  {
    slug: "punto-situazione-indice",
    title: "Punto situazione — indice (per settore)",
    description: "Indice dei documenti prodotti dagli agenti (architettura → supervisore).",
  },
  {
    slug: "punto-situazione-architettura",
    title: "Punto situazione — Architettura",
    description: "Stack, confini SPA/Supabase/Edge/Nest, multi-tenant, decisioni 33–39.",
  },
  {
    slug: "punto-situazione-prodotto",
    title: "Punto situazione — Prodotto",
    description: "Flussi cassa/web/delivery, gap e priorità Fase 6.",
  },
  {
    slug: "punto-situazione-database",
    title: "Punto situazione — Database",
    description: "Moduli SQL, RLS, DEFINER, grant, DoD SQL.",
  },
  {
    slug: "punto-situazione-code",
    title: "Punto situazione — Code",
    description: "Features React, adminService, Demo live, debito tecnico.",
  },
  {
    slug: "punto-situazione-ui",
    title: "Punto situazione — UI / UX",
    description: "Layout public/admin/operativo/SA, Demo live, cucina slim.",
  },
  {
    slug: "punto-situazione-dataflows",
    title: "Punto situazione — Dataflows",
    description: "Flussi app ↔ Supabase (login, cassa, vetrina, realtime, proof).",
  },
  {
    slug: "punto-situazione-security",
    title: "Punto situazione — Security",
    description: "Threat model, hardening 34–39, Stripe, advisor, checklist.",
  },
  {
    slug: "punto-situazione-test",
    title: "Punto situazione — Test / QA",
    description: "Unit ~49, smoke, Demo live, gap copertura.",
  },
  {
    slug: "punto-situazione-copywriter",
    title: "Punto situazione — Copywriter",
    description: "Tono vetrina/admin/SA, debito copy, principi.",
  },
  {
    slug: "punto-situazione-supervisor",
    title: "Punto situazione — Supervisore",
    description: "Verdetto APPROVATO / BLOCCATO sullo stato complessivo.",
  },
  {
    slug: "punto-situazione-priorita",
    title: "Punto situazione — Priorità operative",
    description: "Ordine P0–P4, stati, comandi verifica post-ciclo.",
  },
  {
    slug: "go-live-francy-runbook",
    title: "Go-live (Stripe / dominio / P3)",
    description: "Runbook P2/P3: chiavi live, DNS, HIBP, SMTP/RT-SDI.",
  },
];

function docMatches(qNorm, d) {
  return rowMatchesListSearch(qNorm, [d.title, d.description, d.slug]);
}

export default function SuperadminGuideHub() {
  const [listQuery, setListQuery] = useState("");
  const qNorm = normalizeListSearchQuery(listQuery);
  const devDocsFiltered = useMemo(
    () => (qNorm ? DOCS_SVILUPPO.filter((d) => docMatches(qNorm, d)) : DOCS_SVILUPPO),
    [qNorm],
  );
  const docsFiltered = useMemo(() => (qNorm ? DOCS.filter((d) => docMatches(qNorm, d)) : DOCS), [qNorm]);
  const totalDocs = DOCS_SVILUPPO.length + DOCS.length;
  const shownDocs = devDocsFiltered.length + docsFiltered.length;

  return (
    <>
      <header className="sa-page-header">
        <p className="sa-page-kicker">Super Admin · Documentazione</p>
        <h1 className="dashboard-page-title sa-page-title">Guide e documentazione</h1>
        <p className="sa-page-lede">
          Documentazione interna versionata con il frontend. Apri un documento per leggerlo in-app (markdown); per
          modificarlo aggiorna i file in <code>docs/</code>, <code>src/content/</code> o <code>DEPLOY_COMANDI.md</code>{" "}
          e ridistribuisci il build.
        </p>
      </header>

      <div className="sa-page-toolbar" style={{ marginBottom: 20 }}>
        <SaListSearchField
          id="sa-guide-search"
          value={listQuery}
          onChange={setListQuery}
          placeholder="Cerca per titolo, descrizione o slug…"
          resultsCount={shownDocs}
          totalCount={totalDocs}
        />
      </div>

      {qNorm && shownDocs === 0 ? (
        <p style={{ margin: "0 0 24px", fontSize: 14, color: "#64748b" }}>Nessuna guida corrisponde alla ricerca.</p>
      ) : null}

      <h2 className="sa-section-title" style={{ marginBottom: 16, fontSize: 18, color: "#0f172a" }}>
        Documenti di sviluppo e roadmap product
      </h2>
      <p style={{ margin: "0 0 20px", fontSize: 14, color: "#64748b", maxWidth: 720, lineHeight: 1.55 }}>
        Stessi file in <code>docs/</code>; accessibili anche da <Link to="/superadmin/sviluppo">Super Admin → Roadmap</Link>.
      </p>
      <div className="nav-cards cols-3" style={{ marginBottom: 36 }}>
        {devDocsFiltered.map((d) => (
          <Link key={d.slug} to={`/superadmin/guide/${d.slug}`} className="nav-card">
            <h3>{d.title}</h3>
            <p>{d.description}</p>
            <span className="nav-card-link">Apri →</span>
          </Link>
        ))}
      </div>
      <h2 className="sa-section-title" style={{ marginBottom: 16, fontSize: 18, color: "#0f172a" }}>
        Guide operative e tecniche
      </h2>
      <div className="nav-cards cols-3" style={{ marginBottom: 32 }}>
        {docsFiltered.map((d) => (
          <Link key={d.slug} to={`/superadmin/guide/${d.slug}`} className="nav-card">
            <h3>{d.title}</h3>
            <p>{d.description}</p>
            <span className="nav-card-link">Apri →</span>
          </Link>
        ))}
      </div>
      <div className="dashboard-box" style={{ maxWidth: 720 }}>
        <h2 style={{ marginTop: 0, fontSize: 16 }}>File sorgente</h2>
        <p style={{ margin: 0, fontSize: 14, color: "#475569", lineHeight: 1.55 }}>
          I testi sono importati da <code>docs/</code> e <code>src/content/</code> in fase di build. Per aggiornarli modifica i file nel
          repository e ridistribuisci il frontend.
        </p>
      </div>
    </>
  );
}
