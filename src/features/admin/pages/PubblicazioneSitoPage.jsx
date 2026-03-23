import { Link } from "react-router-dom";
import { useTenant } from "@/app/contexts/TenantContext";

/**
 * Centro unico (in evoluzione) per collegare il sito pubblico del cliente a PizzaManager
 * e per le procedure di pubblicazione / aggiornamento.
 */
export default function PubblicazioneSitoPage() {
  const { tenantData } = useTenant();
  const nome = tenantData?.nome || "—";

  return (
    <div className="dashboard-settings-page">
      <h1 className="dashboard-page-title">Pubblicazione sito</h1>

      <p style={{ maxWidth: 720, fontSize: 15, lineHeight: 1.6, color: "#334155", marginBottom: 24 }}>
        Obiettivo: un&apos;unica piattaforma di sviluppo e aggiornamento — stesso codice PizzaManager per la
        piattaforma e per il menu online del locale, con flussi di deploy e dominio gestiti da qui (in
        completamento).
      </p>

      <section className="dashboard-box dashboard-settings-section" style={{ marginBottom: 20 }}>
        <h2 className="dashboard-settings-section-title">Stato attuale</h2>
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.65, color: "#475569" }}>
          <strong>Locale collegato:</strong> {nome}
        </p>
        <p style={{ margin: "12px 0 0", fontSize: 14, lineHeight: 1.65, color: "#475569" }}>
          La pubblicazione <strong>automatizzata</strong> (dominio dedicato, build dedicata, pulsante Pubblica)
          è in <strong>implementazione</strong>. Oggi il menu pubblico è servito dalla stessa app quando il
          dominio del cliente punta al frontend; gli aggiornamenti seguono il deploy della piattaforma descritto
          in <code style={{ fontSize: 13 }}>DEPLOY_COMANDI.md</code> nel repository.
        </p>
      </section>

      <section className="dashboard-box dashboard-settings-section" style={{ marginBottom: 20 }}>
        <h2 className="dashboard-settings-section-title">Checklist prima del go-live (manuale)</h2>
        <ul style={{ margin: 0, paddingLeft: 20, fontSize: 14, lineHeight: 1.75, color: "#334155" }}>
          <li>
            <Link to="/admin/settings/dati-pizzeria" style={{ color: "#c0392b", fontWeight: 600 }}>
              Dati pizzeria
            </Link>
            : nome, titolare/referente, indirizzo, email (per privacy e contatti sul sito pubblico).
          </li>
          <li>
            <Link to="/admin/settings/layout" style={{ color: "#c0392b", fontWeight: 600 }}>
              Layout
            </Link>{" "}
            e{" "}
            <Link to="/admin/settings/orari" style={{ color: "#c0392b", fontWeight: 600 }}>
              Orari
            </Link>{" "}
            allineati al locale.
          </li>
          <li>
            DNS del dominio cliente puntati al hosting del frontend (es. Firebase Hosting) secondo la procedura
            piattaforma.
          </li>
          <li>
            Supabase: tenant e viste public.tenants allineate alle migrazioni (vedi supabase/migrations/ nel repo).
          </li>
        </ul>
      </section>

      <section className="dashboard-box dashboard-settings-section" style={{ marginBottom: 20 }}>
        <h2 className="dashboard-settings-section-title">Prossimi passi (roadmap)</h2>
        <ul style={{ margin: 0, paddingLeft: 20, fontSize: 14, lineHeight: 1.75, color: "#334155" }}>
          <li>Wizard dominio + verifica DNS dall&apos;admin.</li>
          <li>Integrazione deploy (API o pipeline) con notifica esito.</li>
          <li>Log versione pubblicata e cronologia aggiornamenti per tenant.</li>
        </ul>
      </section>

      <section className="dashboard-box" style={{ background: "#f8fafc", borderColor: "#e2e8f0" }}>
        <h2 className="dashboard-settings-section-title" style={{ marginTop: 0 }}>
          Documentazione
        </h2>
        <p style={{ margin: 0, fontSize: 14, color: "#475569" }}>
          Linee guida per chi sviluppa: docs/GUIDA_ADMIN.md e docs/GUIDA_SUPERADMIN.md nel repository — aggiornarle a
          ogni funzionalità rilevante.
        </p>
      </section>
    </div>
  );
}
