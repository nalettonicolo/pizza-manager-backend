import { Link } from "react-router-dom";
import LegalPageShell from "@/features/public/components/LegalPageShell";
import { useLegalEntity } from "@/hooks/useLegalEntity";
import { PLATFORM_PRODUCT_NAME } from "@/config/legalEntity";
import { applyLegalPlaceholders } from "@/utils/legalPlaceholders";
import { sanitizeLegalHtml } from "@/utils/sanitizeLegalHtml";

const GIORNI_CONSERVAZIONE_LOG = "90";

function MailPrivacy({ email }) {
  if (!email?.trim()) return null;
  return (
    <a href={`mailto:${email.trim()}`} style={{ color: "#c0392b", fontWeight: 600 }}>
      {email.trim()}
    </a>
  );
}

function PrivacySaaS({ c }) {
  const t = c.titolareEsteso;
  const privacyMail = <MailPrivacy email={c.emailPrivacy} />;

  return (
    <>
      <p>
        La presente informativa descrive come vengono trattati i dati personali degli utenti che visitano il sito{" "}
        <strong>{c.siteLabel}</strong> e utilizzano il servizio software <strong>{PLATFORM_PRODUCT_NAME}</strong> (di
        seguito, il Servizio), nel rispetto del Regolamento (UE) 2016/679 (GDPR) e della normativa italiana applicabile
        in materia di protezione dei dati personali.
      </p>

      <h2>Titolare del trattamento</h2>
      <p>
        Il titolare del trattamento dei dati personali relativi alla piattaforma, al sito istituzionale e
        all&apos;erogazione del Servizio è <strong>{t}</strong>, con sede in <strong>{c.titolareIndirizzo}</strong>.
      </p>
      <p>
        Per l&apos;esercizio dei diritti di cui all&apos;art. 15 e seguenti GDPR e per le richieste in materia di
        privacy: {privacyMail ? <> contattare {privacyMail}</> : <> utilizzare i recapiti nella pagina Contatti</>}.
        Comunicazioni generali: anche{" "}
        <a href={`mailto:${c.emailInfo}`} style={{ color: "#c0392b" }}>
          {c.emailInfo}
        </a>
        , ove indicato. L&apos;eventuale PEC, se istituita, sarà indicata nella pagina Contatti.
      </p>

      <h2>Ruoli nel trattamento (SaaS multi-tenant)</h2>
      <p>
        <strong>{PLATFORM_PRODUCT_NAME}</strong> è un servizio software multi-tenant: ogni esercente utilizza un
        ambiente dedicato per ordini, menu, clienti e dati operativi.
      </p>
      <p>
        <strong>Dati della piattaforma e del rapporto contrattuale.</strong> Per account amministratore, abbonamento,
        fatturazione, tenant, supporto e sicurezza della piattaforma, il titolare del trattamento è{" "}
        <strong>{t}</strong>.
      </p>
      <p>
        <strong>Dati inseriti dall&apos;esercente.</strong> Per i dati gestiti dall&apos;esercente (clienti finali,
        ordini, menu, personale), l&apos;<strong>esercente</strong> è <strong>titolare del trattamento</strong>.{" "}
        <strong>{t}</strong>, in qualità di fornitore del software, agisce come{" "}
        <strong>responsabile del trattamento</strong> ai sensi dell&apos;art. 28 GDPR, secondo istruzioni e accordo sul
        trattamento dei dati (DPA) o clausole equivalenti.
      </p>
      <p>
        Chi accede come dipendente o collaboratore dell&apos;esercente si rivolge al proprio referente per i dati
        lavorativi; per account tecnici e fatturazione SaaS ai contatti del titolare sopra.
      </p>

      <h2>Dati trattati</h2>
      <p>Possono essere trattati, a seconda delle funzioni utilizzate:</p>
      <ul>
        <li>dati identificativi e di contatto forniti tramite moduli, contratti o comunicazioni;</li>
        <li>dati di autenticazione e account (ruolo, tenant, log di accesso ove registrati);</li>
        <li>dati tecnici e di log (IP, sessione, browser, orari) per sicurezza e funzionamento;</li>
        <li>
          dati operativi inseriti dall&apos;esercente, trattati da <strong>{t}</strong> quale responsabile per conto
          dell&apos;esercente-titolare.
        </li>
      </ul>

      <h2>Finalità e base giuridica</h2>
      <ul>
        <li>
          Erogazione del Servizio (art. 6, comma 1, lett. b GDPR): account, abbonamento, fatturazione, supporto,
          multi-tenant.
        </li>
        <li>Obblighi di legge (art. 6, comma 1, lett. c GDPR): adempimenti contabili e fiscali.</li>
        <li>
          Legittimo interesse (art. 6, comma 1, lett. f GDPR): sicurezza, prevenzione frodi, statistiche aggregate,
          miglioramento del servizio.
        </li>
        <li>
          Consenso (art. 6, comma 1, lett. a GDPR): ove necessario per attività non strettamente necessarie (es. cookie non
          tecnici).
        </li>
      </ul>

      <h2>Conservazione dei dati</h2>
      <p>
        Dati di account e contratto: per la durata del rapporto e, dopo la cessazione, per tempi necessari a obblighi
        legali, richieste degli interessati e difesa in giudizio. Documenti con obblighi contabili/fiscali fino a{" "}
        <strong>10 anni</strong> o quanto previsto dalla legge.
      </p>
      <p>
        Log tecnici e accessi: massimo <strong>{GIORNI_CONSERVAZIONE_LOG} giorni</strong>, salvo esigenze di sicurezza o
        legge.
      </p>

      <h2>Misure di sicurezza</h2>
      <p>
        Misure tecniche e organizzative appropriate: connessioni cifrate ove applicabile, accessi per ruoli, segregazione
        tra tenant, aggiornamenti software, gestione incidenti. Fornitori selezionati con garanzie contrattuali GDPR.
      </p>

      <h2>Log, accessi e sicurezza del sistema</h2>
      <p>
        Dati di accesso (autenticazione, orari, IP o sessione) per sicurezza, prevenzione abusi e frodi, nel rispetto
        della minimizzazione.
      </p>

      <h2>Destinatari, hosting e trasferimenti</h2>
      <p>
        Trattamento su infrastruttura cloud con data center nell&apos;<strong>Area economica europea (SEE)</strong> o,
        in caso di trasferimenti extra-UE, clausole contrattuali standard. Il fornitore di database/hosting (es.
        Supabase o equivalente) opera come responsabile o sub-responsabile contrattuale.
      </p>
      <p>
        Altri fornitori (posta, assistenza, monitoraggio) solo se necessari e vincolati a riservatezza e accordi sul
        trattamento.
      </p>

      <h2>Responsabile della protezione dei dati (DPO)</h2>
      <p>
        Qualora sia nominato un DPO, l&apos;indirizzo sarà indicato in questa sezione. In assenza di nomina, le richieste
        possono essere inviate a {privacyMail ?? <span style={{ fontWeight: 600 }}>{c.emailPrivacy}</span>}.
      </p>

      <h2>Cookie e tecnologie simili</h2>
      <p>
        Si rimanda alla{" "}
        <Link to="/cookie" style={{ color: "#c0392b", fontWeight: 600 }}>
          Cookie policy
        </Link>{" "}
        e al banner ove presente.
      </p>

      <h2>Diritti dell&apos;interessato</h2>
      <p>
        Diritti di accesso, rettifica, cancellazione, limitazione, opposizione, portabilità (ove applicabile) e reclamo
        al Garante (
        <a href="https://www.garanteprivacy.it" target="_blank" rel="noopener noreferrer" style={{ color: "#c0392b" }}>
          www.garanteprivacy.it
        </a>
        ). Per trattamenti di cui è titolare <strong>{t}</strong>: contattare {privacyMail ?? c.emailPrivacy}. Per dati
        di cui è titolare l&apos;esercente: rivolgersi all&apos;esercente.
      </p>

      <h2>Modifiche</h2>
      <p>
        Il titolare può aggiornare questa informativa. La data in cima al documento è l&apos;ultimo aggiornamento.
      </p>
    </>
  );
}

function PrivacyStorefront({ c }) {
  const privacyMail = <MailPrivacy email={c.emailPrivacy} />;
  const custom = typeof c.privacy_policy_html === "string" && c.privacy_policy_html.trim();
  if (custom) {
    const html = applyLegalPlaceholders(c.privacy_policy_html, c.legalTenantSnapshot || {}, c.siteLabel);
    // Sanifica prima di iniettare: neutralizza <script>, handler inline e URL javascript: (stored XSS).
    const safeHtml = sanitizeLegalHtml(html);
    return (
      <div
        className="legal-custom-html"
        dangerouslySetInnerHTML={{ __html: safeHtml }}
      />
    );
  }
  return (
    <>
      <p>
        La presente informativa descrive il trattamento dei dati personali relativi al sito{" "}
        <strong>{c.siteLabel}</strong> e all&apos;utilizzo del menu online e degli ordini gestiti tramite il software{" "}
        <strong>{PLATFORM_PRODUCT_NAME}</strong>, nel rispetto del GDPR e della normativa italiana.
      </p>

      <h2>Titolare del trattamento</h2>
      <p>
        Il titolare del trattamento è <strong>{c.titolareEsteso}</strong>, con sede in{" "}
        <strong>{c.titolareIndirizzo}</strong>.
        {c.emailPrivacy?.trim() ? (
          <>
            {" "}
            Email di contatto: {privacyMail}.
          </>
        ) : (
          <> Aggiorna email e indirizzo in Amministrazione → Impostazioni → Dati pizzeria.</>
        )}
      </p>

      <h2>Dati trattati e finalità</h2>
      <p>
        Possono essere trattati dati forniti in fase di ordine o richiesta (nome, telefono, indirizzo di consegna,
        note), dati tecnici di navigazione e cookie secondo la cookie policy, e dati necessari all&apos;evasione
        dell&apos;ordine. Base giuridica: esecuzione del servizio richiesto (art. 6, comma 1, lett. b GDPR), obblighi di
        legge ove applicabili, legittimo interesse per sicurezza e prevenzione frodi.
      </p>

      <h2>Fornitore tecnico del software</h2>
      <p>
        Il software <strong>{PLATFORM_PRODUCT_NAME}</strong> è messo a disposizione dell&apos;esercente; i dati sono
        ospitati su infrastruttura cloud (es. data center in SEE). Il fornitore del software interviene come
        responsabile del trattamento per conto del titolare, nei limiti contrattuali.
      </p>

      <h2>Conservazione</h2>
      <p>
        I dati sono conservati per il tempo necessario a evadere ordini, adempiere obblighi di legge (anche contabili) e,
        in linea generale, fino a <strong>10 anni</strong> ove previsto per documenti fiscali. Log tecnici per periodi
        limitati (es. fino a {GIORNI_CONSERVAZIONE_LOG} giorni salvo esigenze di sicurezza).
      </p>

      <h2>Diritti</h2>
      <p>
        Puoi esercitare i diritti di cui agli artt. 15–22 GDPR contattando il titolare ai recapiti sopra. Reclamo al
        Garante:{" "}
        <a href="https://www.garanteprivacy.it" target="_blank" rel="noopener noreferrer" style={{ color: "#c0392b" }}>
          www.garanteprivacy.it
        </a>
        .
      </p>

      <h2>Cookie</h2>
      <p>
        Dettagli nella{" "}
        <Link to="/cookie" style={{ color: "#c0392b", fontWeight: 600 }}>
          Cookie policy
        </Link>
        .
      </p>

      <h2>Modifiche</h2>
      <p>Il titolare può aggiornare questa informativa; la data in cima indica l&apos;ultima revisione.</p>
    </>
  );
}

export default function PrivacyPolicy() {
  const { loading, isSaaS, config: c } = useLegalEntity();

  if (loading) {
    return (
      <LegalPageShell title="Informativa sulla privacy" updatedAt="22 marzo 2026">
        <p>Caricamento informativa…</p>
      </LegalPageShell>
    );
  }

  return (
    <LegalPageShell title="Informativa sulla privacy" updatedAt="22 marzo 2026">
      {isSaaS ? <PrivacySaaS c={c} /> : <PrivacyStorefront c={c} />}
    </LegalPageShell>
  );
}
