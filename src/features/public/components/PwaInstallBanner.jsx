import { useState } from "react";
import PropTypes from "prop-types";
import { usePwaInstallPrompt } from "@/hooks/usePwaInstallPrompt";

/**
 * Banner "Aggiungi a schermata Home": canale primario per le notifiche push (funziona solo da PWA
 * installata, specialmente su iOS 16.4+ — non funziona mai dal solo browser). Testo diverso per
 * piattaforma: Android ha un vero prompt di installazione, iOS no (limite Apple) e va guidato a
 * mano via Condividi → Aggiungi a Home. Due varianti (vedi PublicLayout/publicPwaManifest.js):
 * - "vetrina" (default): storefront del tenant, rivolta al cliente finale che riordina.
 * - "app": landing SaaS/login/pagine pubbliche generiche, rivolta allo staff (admin/cassa/
 *   superadmin) — installa un ingresso rapido al gestionale (start_url /login), valido per
 *   qualsiasi tenant dato che tutti passano dallo stesso pizzamanager.it.
 *
 * Richiesta esplicita: il banner deve ripresentarsi ad ogni ricarica della pagina, anche se
 * l'utente lo ha chiuso prima — finché non installa l'app non riceve le notifiche in tempo reale,
 * quindi "chiudi" nasconde il banner solo per la sessione di navigazione corrente (stato React in
 * memoria, nessuna persistenza in storage): un vero reload lo rimostra.
 */
const COPY = {
  vetrina: {
    ios: (
      <>
        <strong>Aggiungi PizzaManager alla schermata Home</strong> per ricevere le notifiche in
        tempo reale sui tuoi ordini (senza l&apos;app non arrivano): tocca <strong>Condividi</strong>{" "}
        <span aria-hidden="true">⬆️</span> e poi <strong>Aggiungi a Home</strong>.
      </>
    ),
    other: (
      <>
        <strong>Installa PizzaManager</strong> per ricevere le notifiche in tempo reale sui tuoi
        ordini (senza l&apos;app non arrivano) — come un&apos;app vera, in un tocco.
      </>
    ),
  },
  app: {
    ios: (
      <>
        <strong>Aggiungi PizzaManager alla schermata Home</strong> per accedere più in fretta al
        gestionale e ricevere le notifiche in tempo reale: tocca <strong>Condividi</strong>{" "}
        <span aria-hidden="true">⬆️</span> e poi <strong>Aggiungi a Home</strong>.
      </>
    ),
    other: (
      <>
        <strong>Installa PizzaManager</strong> per accedere più in fretta al gestionale (cassa,
        amministrazione) e ricevere le notifiche in tempo reale — come un&apos;app vera, in un
        tocco.
      </>
    ),
  },
};

export default function PwaInstallBanner({ variant = "vetrina" }) {
  const { isInstalled, isIOS, canPromptInstall, promptInstall } = usePwaInstallPrompt();
  const [dismissed, setDismissed] = useState(false);

  if (isInstalled || dismissed) return null;
  if (!isIOS && !canPromptInstall) return null;

  const copy = COPY[variant] || COPY.vetrina;

  const dismiss = () => {
    setDismissed(true);
  };

  const install = async () => {
    const accepted = await promptInstall();
    if (accepted) setDismissed(true);
  };

  return (
    <div className="pwa-install-banner" role="dialog" aria-label="Installa PizzaManager" aria-live="polite">
      <div className="pwa-install-banner-inner">
        <span className="pwa-install-banner-icon" aria-hidden="true">
          📲
        </span>
        <p className="pwa-install-banner-text">{isIOS ? copy.ios : copy.other}</p>
        <div className="pwa-install-banner-actions">
          {!isIOS ? (
            <button type="button" className="pwa-install-banner-btn" onClick={() => void install()}>
              Installa
            </button>
          ) : null}
          <button
            type="button"
            className="pwa-install-banner-close"
            onClick={dismiss}
            aria-label="Chiudi"
            title="Chiudi"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}

PwaInstallBanner.propTypes = {
  variant: PropTypes.oneOf(["vetrina", "app"]),
};
