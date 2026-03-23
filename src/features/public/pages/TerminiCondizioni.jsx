import { Link } from "react-router-dom";
import LegalPageShell from "@/features/public/components/LegalPageShell";
import { useLegalEntity } from "@/hooks/useLegalEntity";
import { PLATFORM_PRODUCT_NAME } from "@/config/legalEntity";

export default function TerminiCondizioni() {
  const { loading, isSaaS, config: c } = useLegalEntity();

  if (loading) {
    return (
      <LegalPageShell title="Termini e condizioni di utilizzo" updatedAt="22 marzo 2026">
        <p>Caricamento…</p>
      </LegalPageShell>
    );
  }

  if (isSaaS) {
    return (
      <LegalPageShell title="Termini e condizioni di utilizzo" updatedAt="22 marzo 2026">
        <p>
          I presenti Termini e Condizioni (&quot;Termini&quot;) regolano l&apos;accesso e l&apos;utilizzo del servizio
          software <strong>{PLATFORM_PRODUCT_NAME}</strong> messo a disposizione tramite il sito{" "}
          <strong>{c.siteLabel}</strong> e le applicazioni web associate (il &quot;Servizio&quot;). Il titolare del
          Servizio è <strong>{c.titolareEsteso}</strong>. L&apos;utilizzo del Servizio implica l&apos;accettazione di
          questi Termini.
        </p>

        <h2>Descrizione del Servizio</h2>
        <p>
          {PLATFORM_PRODUCT_NAME} è una piattaforma SaaS per la gestione operativa di pizzerie e attività affini
          (ordini, cucina, cassa, consegne, menu, ecc.). Le funzionalità effettive dipendono dal piano e dalla
          configurazione concordata.
        </p>

        <h2>Registrazione e account</h2>
        <p>
          L&apos;accesso al pannello avviene tramite credenziali fornite o gestite secondo le procedure definite
          dall&apos;amministratore. L&apos;utente è responsabile della riservatezza delle credenziali e di ogni
          attività svolta tramite il proprio account. Segnalare tempestivamente accessi non autorizzati.
        </p>

        <h2>Uso consentito</h2>
        <p>
          Il Servizio deve essere utilizzato in conformità alla legge e alle presenti clausole. È vietato utilizzarlo per
          scopi illeciti, per compromettere la sicurezza della piattaforma o per scraping non autorizzato.
        </p>

        <h2>Dati e contenuti</h2>
        <p>
          I dati inseriti dai clienti della piattaforma (es. menu, ordini, anagrafiche) restano di competenza
          dell&apos;esercente, che ne è responsabile verso i propri clienti finali. Il trattamento da parte di{" "}
          <strong>{c.titolareEsteso}</strong> è descritto nell&apos;{" "}
          <Link to="/privacy" style={{ color: "#c0392b" }}>
            Informativa sulla privacy
          </Link>
          .
        </p>

        <h2>Proprietà intellettuale</h2>
        <p>
          Software, marchi, interfaccia e documentazione relativi a {PLATFORM_PRODUCT_NAME} sono tutelati dalla
          normativa sul diritto d&apos;autore e dalla proprietà industriale. Non è consentita copia o distribuzione non
          autorizzata.
        </p>

        <h2>Disponibilità e modifiche</h2>
        <p>
          Il Servizio è fornito secondo le modalità tecniche in atto. Possono essere effettuati aggiornamenti e
          manutenzioni. I Termini possono essere aggiornati: la data in cima al documento è l&apos;ultimo aggiornamento.
        </p>

        <h2>Limitazione di responsabilità</h2>
        <p>
          Il Servizio è fornito secondo lo stato dell&apos;arte. La responsabilità è limitata nei limiti consentiti dalla
          legge applicabile.
        </p>

        <h2>Sospensione e cessazione</h2>
        <p>
          L&apos;accesso può essere sospeso o chiuso in caso di violazione dei Termini, di impagamento o secondo il
          contratto commerciale.
        </p>

        <h2>Legge applicabile e foro</h2>
        <p>
          Per i consumatori si applicano le norme inderogabili. Per le altre controversie, salvo diverso accordo
          scritto, si applica la legge italiana e il foro competente secondo la normativa vigente.
        </p>

        <h2>Contatti</h2>
        <p>
          Per domande sui presenti Termini: pagina{" "}
          <Link to="/contatti" style={{ color: "#c0392b" }}>
            Contatti
          </Link>{" "}
          o email a <strong>{c.emailInfo}</strong>.
        </p>
      </LegalPageShell>
    );
  }

  return (
    <LegalPageShell title="Termini e condizioni di utilizzo" updatedAt="22 marzo 2026">
      <p>
        I presenti Termini regolano l&apos;utilizzo del sito <strong>{c.siteLabel}</strong> e del servizio di ordinazione
        online gestito da <strong>{c.titolareEsteso}</strong> tramite il software <strong>{PLATFORM_PRODUCT_NAME}</strong>
        . Effettuando un ordine o utilizzando il sito, l&apos;utente accetta questi Termini.
      </p>

      <h2>Servizio</h2>
      <p>
        Il sito consente di consultare il menu e inviare richieste d&apos;ordine secondo le modalità indicate
        dall&apos;esercente (orari, zone di consegna, pagamenti).
      </p>

      <h2>Ordini e prezzi</h2>
      <p>
        I prezzi e la disponibilità dei prodotti sono quelli indicati sul sito salvo errore manifesto. L&apos;esercente
        potrà confermare o rifiutare l&apos;ordine in base alla disponibilità effettiva.
      </p>

      <h2>Dati personali</h2>
      <p>
        Il trattamento dei dati è descritto nell&apos;{" "}
        <Link to="/privacy" style={{ color: "#c0392b" }}>
          Informativa sulla privacy
        </Link>
        .
      </p>

      <h2>Limitazione di responsabilità</h2>
      <p>
        Il Servizio è fornito nel rispetto della buona tecnica. La responsabilità dell&apos;esercente è limitata nei
        limiti di legge per disservizi non imputabili a dolo o colpa grave.
      </p>

      <h2>Legge applicabile</h2>
      <p>Si applica la legge italiana. Per i consumatori valgono le norme inderogabili di tutela.</p>

      <h2>Contatti</h2>
      <p>
        Per informazioni:{" "}
        {c.emailPrivacy?.trim() ? (
          <a href={`mailto:${c.emailPrivacy.trim()}`} style={{ color: "#c0392b", fontWeight: 600 }}>
            {c.emailPrivacy.trim()}
          </a>
        ) : (
          <span>recapiti indicati sul sito o in fase d&apos;ordine.</span>
        )}
      </p>
    </LegalPageShell>
  );
}
