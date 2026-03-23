import { Link } from "react-router-dom";

export default function DeployClientiPage() {
  return (
    <div className="dashboard-settings-page">
      <h1 className="dashboard-page-title">Deploy siti clienti</h1>

      <p style={{ maxWidth: 860, fontSize: 15, lineHeight: 1.6, color: "#334155", marginBottom: 24 }}>
        Da questa area gestisci la pubblicazione del sistema/menu sul dominio del cliente. La pipeline completamente
        automatica tenant-by-tenant e in evoluzione; oggi la procedura operativa resta guidata (checklist + deploy
        piattaforma).
      </p>

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
      </section>

      <section className="dashboard-box dashboard-settings-section" style={{ marginBottom: 20 }}>
        <h2 className="dashboard-settings-section-title">Vai ai tenant</h2>
        <p style={{ margin: "0 0 12px", fontSize: 14, color: "#475569" }}>
          Per operare su un cliente specifico, apri prima l&apos;anagrafica del tenant.
        </p>
        <Link to="/superadmin/tenants" className="btn-primary-dashboard" style={{ textDecoration: "none" }}>
          Apri clienti →
        </Link>
      </section>
    </div>
  );
}
