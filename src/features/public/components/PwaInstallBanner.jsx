import { useEffect, useState } from "react";
import { usePwaInstallPrompt } from "@/hooks/usePwaInstallPrompt";

const STORAGE_KEY = "pm_pwa_install_dismiss_v1";
const DISMISS_DAYS = 14;

function isDismissedRecently() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const ts = Number(raw);
    if (!Number.isFinite(ts)) return false;
    return Date.now() - ts < DISMISS_DAYS * 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

/**
 * Banner "Aggiungi a schermata Home" sulla vetrina pubblica: canale primario per le notifiche
 * (push funziona solo da PWA installata, specialmente su iOS 16.4+ — non funziona mai dal solo
 * browser). Testo diverso per piattaforma: Android ha un vero prompt di installazione, iOS no
 * (limite Apple) e va guidato a mano via Condividi → Aggiungi a Home.
 */
export default function PwaInstallBanner() {
  const { isInstalled, isIOS, canPromptInstall, promptInstall } = usePwaInstallPrompt();
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    setDismissed(isDismissedRecently());
  }, []);

  if (isInstalled || dismissed) return null;
  if (!isIOS && !canPromptInstall) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(STORAGE_KEY, String(Date.now()));
    } catch {
      /* ignore */
    }
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
        <p className="pwa-install-banner-text">
          {isIOS ? (
            <>
              <strong>Aggiungi PizzaManager alla schermata Home</strong> per ricevere subito gli
              aggiornamenti sui tuoi ordini: tocca <strong>Condividi</strong>{" "}
              <span aria-hidden="true">⬆️</span> e poi <strong>Aggiungi a Home</strong>.
            </>
          ) : (
            <>
              <strong>Installa PizzaManager</strong> per ricevere subito gli aggiornamenti sui tuoi
              ordini, come un&apos;app vera.
            </>
          )}
        </p>
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
