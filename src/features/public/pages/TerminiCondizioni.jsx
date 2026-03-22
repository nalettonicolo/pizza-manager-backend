import { Link } from "react-router-dom";
import LegalPageShell from "@/features/public/components/LegalPageShell";

export default function TerminiCondizioni() {
  return (
    <LegalPageShell title="Termini e condizioni di utilizzo">
      <p>
        I presenti Termini e Condizioni (&quot;Termini&quot;) regolano l&apos;accesso e l&apos;utilizzo del servizio
        software PizzaManager messo a disposizione tramite il sito pizzamanager.it e le applicazioni web associate
        (di seguito, il &quot;Servizio&quot;). L&apos;utilizzo del Servizio implica l&apos;accettazione di questi
        Termini.
      </p>

      <h2>Descrizione del Servizio</h2>
      <p>
        PizzaManager è una piattaforma SaaS (software as a service) per la gestione operativa di pizzerie e attività
        affini (ordini, cucina, cassa, consegne, configurazione menu, ecc.). Le funzionalità effettive dipendono dal
        piano abbonamento e dalla configurazione concordata con l&apos;amministratore della piattaforma.
      </p>

      <h2>Registrazione e account</h2>
      <p>
        L&apos;accesso al pannello di gestione avviene tramite credenziali fornite o gestite secondo le procedure
        definite dall&apos;amministratore. L&apos;utente è responsabile della riservatezza delle proprie credenziali e
        di ogni attività svolta tramite il proprio account. È obbligo segnalare immediatamente accessi non autorizzati.
      </p>

      <h2>Uso consentito</h2>
      <p>
        Il Servizio deve essere utilizzato in conformità alla legge, alla buona fede e alle presenti clausole. È
        vietato utilizzare il Servizio per scopi illeciti, per compromettere la sicurezza o la disponibilità della
        piattaforma, o per estrarre dati in modo sistematico senza autorizzazione (scraping non consentito).
      </p>

      <h2>Dati e contenuti</h2>
      <p>
        I dati inseriti dai clienti (es. menu, ordini, anagrafiche) restano di competenza dell&apos;esercente, che ne è
        responsabile sotto il profilo legale e della correttezza rispetto ai propri clienti finali. Il fornitore della
        piattaforma tratta i dati secondo le modalità descritte nell&apos;{" "}
        <Link to="/privacy" style={{ color: "#c0392b" }}>
          Informativa sulla privacy
        </Link>
        .
      </p>

      <h2>Proprietà intellettuale</h2>
      <p>
        Software, marchi, logo, interfaccia e documentazione relativi a PizzaManager sono tutelati dalla normativa sul
        diritto d&apos;autore e dalla proprietà industriale. Non è consentita copia, modifica o distribuzione non
        autorizzata.
      </p>

      <h2>Disponibilità e modifiche</h2>
      <p>
        Il Servizio è fornito secondo le modalità tecniche e organizzative in atto. Possono essere effettuati
        aggiornamenti, manutenzioni programmate o interventi urgenti che comportano temporanee indisponibilità.
        I Termini possono essere aggiornati: la data di ultimo aggiornamento è indicata in cima al documento.
      </p>

      <h2>Limitazione di responsabilità</h2>
      <p>
        Il Servizio è fornito secondo lo stato dell&apos;arte e le funzionalità descritte al momento dell&apos;uso. Il
        fornitore non risponde per danni indiretti, perdita di profitto o interruzioni non imputabili a dolo o colpa
        grave, nei limiti consentiti dalla legge applicabile.
      </p>

      <h2>Sospensione e cessazione</h2>
      <p>
        L&apos;accesso al Servizio può essere sospeso o chiuso in caso di violazione dei Termini, di impagamento o
        secondo quanto previsto dal contratto commerciale. Alla cessazione l&apos;utente dovrà cessare l&apos;uso del
        Servizio; le modalità di export o conservazione dati, se previste, sono definite in sede contrattuale.
      </p>

      <h2>Legge applicabile e foro</h2>
      <p>
        Per i consumatori si applicano le norme inderogabili. Per le restanti controversie, salvo diverso accordo
        scritto, si applica la legge italiana e sarà competente il foro indicato dalla normativa vigente.
      </p>

      <h2>Contatti</h2>
      <p>
        Per domande sui presenti Termini utilizzare i recapiti nella pagina{" "}
        <Link to="/contatti" style={{ color: "#c0392b" }}>
          Contatti
        </Link>
        .
      </p>
    </LegalPageShell>
  );
}
