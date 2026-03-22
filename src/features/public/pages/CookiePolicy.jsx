import { Link } from "react-router-dom";
import LegalPageShell from "@/features/public/components/LegalPageShell";

export default function CookiePolicy() {
  return (
    <LegalPageShell title="Informativa sui cookie">
      <p>
        Questa pagina descrive come il sito pizzamanager.it e le applicazioni web collegate utilizzano cookie e
        tecnologie simili, in conformità al Provvedimento del Garante privacy dell&apos;8 maggio 2014 e al GDPR.
      </p>

      <h2>Cosa sono i cookie</h2>
      <p>
        I cookie sono piccoli file di testo che i siti visitati inviano al terminale dell&apos;utente (computer,
        tablet, smartphone), dove vengono memorizzati per essere poi ritrasmessi agli stessi siti alla visita successiva.
      </p>

      <h2>Tipologie di cookie utilizzati</h2>
      <p>
        Cookie tecnici (necessari): consentono la navigazione e l&apos;utilizzo delle funzioni essenziali,
        inclusa la gestione della sessione di accesso all&apos;area riservata e preferenze di sicurezza. Senza questi
        cookie alcune parti del Servizio potrebbero non funzionare correttamente.
      </p>
      <p>
        Cookie di preferenza: possono essere usati per memorizzare scelte dell&apos;utente (es. lingua
        o accettazione di informativa breve), quando implementate dal sito.
      </p>
      <p>
        Cookie di analisi e di profilazione: al momento la pubblicazione di default del sito non
        descrive l&apos;uso di cookie di profilazione o di analisi di terze parti. Qualora si introducessero strumenti
        analitici o marketing, questa informativa sarà aggiornata e, ove necessario, sarà richiesto il consenso prima
        dell&apos;installazione.
      </p>

      <h2>Durata</h2>
      <p>
        I cookie di sessione sono cancellati alla chiusura del browser. I cookie persistenti, se presenti, hanno
        durata indicata nelle impostazioni del browser o nella tabella specifica eventualmente pubblicata in questo
        documento.
      </p>

      <h2>Come gestire o disabilitare i cookie</h2>
      <p>
        Puoi configurare il browser per rifiutare tutti i cookie o solo alcuni. La disabilitazione dei cookie tecnici
        potrebbe impedire l&apos;accesso al pannello di gestione o il corretto funzionamento di alcune funzioni. Per
        istruzioni dettagliate consulta la guida del tuo browser (Chrome, Firefox, Safari, Edge, ecc.).
      </p>

      <h2>Riferimenti</h2>
      <p>
        Per ulteriori informazioni sul trattamento dei dati personali, consulta l&apos;{" "}
        <Link to="/privacy" style={{ color: "#c0392b" }}>
          Informativa sulla privacy
        </Link>
        .
      </p>
    </LegalPageShell>
  );
}
