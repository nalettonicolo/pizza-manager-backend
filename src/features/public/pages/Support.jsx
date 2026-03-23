import { useEffect } from "react";
import { Link } from "react-router-dom";
import LegalPageShell from "@/features/public/components/LegalPageShell";

const SUPPORT_EMAIL = "support@pizzamanager.it";
const INFO_EMAIL = "info@pizzamanager.it";

export default function Support() {
  useEffect(() => {
    document.title = "Supporto | PizzaManager";
  }, []);

  return (
    <LegalPageShell title="Centro assistenza" showUpdated={false}>
      <p>
        Qui trovi i canali ufficiali per ricevere aiuto su PizzaManager: accesso all&apos;app, problemi tecnici e
        richieste commerciali. Per le richieste di prova o preventivi usa anche la pagina{" "}
        <Link to="/contatti" style={{ color: "#c0392b", fontWeight: 600 }}>
          Contatti
        </Link>
        .
      </p>

      <div
        style={{
          margin: "20px 0 24px",
          padding: "16px 18px",
          borderRadius: 10,
          border: "1px solid rgba(192, 57, 43, 0.2)",
          background: "linear-gradient(145deg, #fff8f6 0%, #fff 100%)",
        }}
      >
        <p style={{ margin: "0 0 8px", fontWeight: 700, color: "#0f172a", fontSize: "0.9375rem" }}>
          Email assistenza tecnica
        </p>
        <p style={{ margin: 0, fontSize: "0.9375rem" }}>
          <a href={`mailto:${SUPPORT_EMAIL}`} style={{ color: "#c0392b", fontWeight: 600 }}>
            {SUPPORT_EMAIL}
          </a>
        </p>
        <p style={{ margin: "10px 0 0", fontSize: "0.875rem", color: "#64748b" }}>
          Indica nell&apos;oggetto il nome della pizzeria o del tenant e, se utile, uno screenshot o il messaggio di
          errore. Rispondiamo di norma entro 1–2 giorni lavorativi.
        </p>
      </div>

      <h2>Accesso al pannello</h2>
      <p>
        Per entrare nell&apos;area riservata (admin o operativo) usa il link{" "}
        <Link to="/login" style={{ color: "#c0392b", fontWeight: 600 }}>
          Accedi
        </Link>
        . Se hai dimenticato la password, usa la procedura di recupero dalla schermata di login (se attiva sul tuo
        progetto). Per nuove credenziali o abilitazione tenant contatta chi gestisce la piattaforma o scrivi a{" "}
        <a href={`mailto:${INFO_EMAIL}`} style={{ color: "#c0392b" }}>
          {INFO_EMAIL}
        </a>
        .
      </p>

      <h2>Problemi tecnici o errori</h2>
      <ul>
        <li>Verifica la connessione e prova un altro browser o una finestra in incognito.</li>
        <li>Segnala a {SUPPORT_EMAIL} cosa stavi facendo, l&apos;orario approssimativo e il testo dell&apos;errore.</li>
      </ul>

      <h2>Commerciale, fatturazione e contratti</h2>
      <p>
        Per piani, rinnovi o questioni amministrative scrivi a{" "}
        <a href={`mailto:${INFO_EMAIL}`} style={{ color: "#c0392b" }}>
          {INFO_EMAIL}
        </a>{" "}
        oppure usa il modulo in{" "}
        <Link to="/contatti" style={{ color: "#c0392b", fontWeight: 600 }}>
          Contatti
        </Link>
        .
      </p>

      <h2>Documentazione e privacy</h2>
      <p style={{ marginBottom: 8 }}>
        <Link to="/privacy" style={{ color: "#c0392b" }}>
          Privacy policy
        </Link>
        {" · "}
        <Link to="/cookie" style={{ color: "#c0392b" }}>
          Cookie policy
        </Link>
        {" · "}
        <Link to="/termini" style={{ color: "#c0392b" }}>
          Termini e condizioni
        </Link>
      </p>
    </LegalPageShell>
  );
}
