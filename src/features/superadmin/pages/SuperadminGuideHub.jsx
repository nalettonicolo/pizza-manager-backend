import { Link } from "react-router-dom";

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

export default function SuperadminGuideHub() {
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
      <div className="nav-cards cols-3" style={{ marginBottom: 32 }}>
        {DOCS.map((d) => (
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
