import { Link } from "react-router-dom";
import LegalPageShell from "@/features/public/components/LegalPageShell";

export default function PrivacyPolicy() {
  return (
    <LegalPageShell title="Informativa sulla privacy">
      <p>
        La presente informativa descrive come vengono trattati i dati personali degli utenti che visitano il sito
        pizzamanager.it e utilizzano il servizio software PizzaManager (di seguito, il Servizio), nel rispetto
        del Regolamento (UE) 2016/679 (GDPR) e della normativa italiana applicabile in materia di protezione dei dati
        personali.
      </p>

      <h2>Titolare del trattamento</h2>
      <p>
        Il titolare del trattamento dei dati è il soggetto che gestisce la piattaforma PizzaManager e il sito
        istituzionale. Per richieste relative alla privacy è possibile utilizzare i recapiti indicati nella pagina{" "}
        <Link to="/contatti" style={{ color: "#c0392b" }}>
          Contatti
        </Link>{" "}
        o l&apos;indirizzo email dedicato alle comunicazioni con gli utenti (es. info@pizzamanager.it), salvo diverso
        indicazione aggiornata sul sito.
      </p>

      <h2>Dati trattati</h2>
      <p>Possono essere trattati, a seconda delle funzioni utilizzate:</p>
      <ul>
        <li>dati identificativi e di contatto (nome, ragione sociale, email, telefono) forniti tramite moduli o email;</li>
        <li>dati di autenticazione e account relativi all&apos;accesso al pannello di gestione (credenziali, ruolo, tenant);</li>
        <li>dati tecnici di navigazione e di log (indirizzo IP, tipo di browser, orari di accesso, in forma aggregata o per sicurezza);</li>
        <li>dati operativi inseriti nel Servizio dall&apos;esercente (ordini, menu, configurazioni) nella veste di trattamento per conto del titolare del locale, ove applicabile.</li>
      </ul>

      <h2>Finalità e base giuridica</h2>
      <ul>
        <li>
          Erogazione del Servizio e gestione contrattuale (art. 6, comma 1, lett. b GDPR): account,
          fatturazione, supporto, sicurezza della piattaforma.
        </li>
        <li>
          Obblighi di legge (art. 6, comma 1, lett. c GDPR): adempimenti contabili e fiscali ove previsti.
        </li>
        <li>
          Legittimo interesse (art. 6, comma 1, lett. f GDPR): prevenzione frodi, analisi statistiche
          aggregate, miglioramento del servizio, misure di sicurezza informatica.
        </li>
        <li>
          Consenso (art. 6, comma 1, lett. a GDPR): ove richiesto per specifiche attività (es. comunicazioni
          commerciali non strettamente necessarie): il consenso può essere revocato in qualsiasi momento.
        </li>
      </ul>

      <h2>Modalità del trattamento e conservazione</h2>
      <p>
        I dati sono trattati con strumenti elettronici e, in caso di necessità di supporto cartaceo, con strumenti
        manuali. Il periodo di conservazione dipende dalla finalità: per la durata del rapporto contrattuale e, dopo la
        cessazione, per i tempi previsti da legge o per la tutela di diritti in sede giudiziaria. I log tecnici possono
        essere conservati per periodi limitati per sicurezza e diagnostica.
      </p>

      <h2>Destinatari e trasferimenti</h2>
      <p>
        I dati possono essere comunicati a fornitori che agiscono come responsabili del trattamento (es. hosting,
        infrastruttura cloud, posta elettronica) selezionati per adeguate garanzie contrattuali e di sicurezza. Se i dati
        fossero trasferiti verso paesi extra-UE, saranno adottate le clausole contrattuali standard o altre misure
        previste dal GDPR.
      </p>

      <h2>Diritti dell&apos;interessato</h2>
      <p>
        In qualità di interessato, hai diritto di chiedere accesso ai dati, rettifica, cancellazione, limitazione del
        trattamento, opposizione, portabilità dei dati (ove applicabile) e di proporre reclamo al Garante per la
        protezione dei dati personali (
        <a href="https://www.garanteprivacy.it" target="_blank" rel="noopener noreferrer" style={{ color: "#c0392b" }}>
          www.garanteprivacy.it
        </a>
        ). Le richieste possono essere inviate ai contatti del titolare indicati sopra.
      </p>

      <h2>Modifiche</h2>
      <p>
        Il titolare può aggiornare questa informativa: la data di ultimo aggiornamento è indicata in cima al documento.
        Si consiglia di consultarla periodicamente.
      </p>
    </LegalPageShell>
  );
}
