import { useCallback, useEffect, useState } from "react";

/**
 * Rileva se la vetrina è già installata come PWA e gestisce l'installazione, con due percorsi
 * diversi per limite di piattaforma:
 * - Android/Chrome: evento `beforeinstallprompt` reale, prompt nativo programmabile.
 * - iOS/Safari: nessun prompt programmabile esiste (limite Apple, non nostro) — l'utente deve
 *   usare Condividi → Aggiungi a Home a mano; qui rileviamo solo la piattaforma per mostrare le
 *   istruzioni giuste nel banner.
 */
function detectIsInstalled() {
  if (typeof window === "undefined") return false;
  const standaloneMedia =
    typeof window.matchMedia === "function" && window.matchMedia("(display-mode: standalone)").matches;
  const iosStandalone = typeof navigator !== "undefined" && navigator.standalone === true;
  return Boolean(standaloneMedia || iosStandalone);
}

function detectIsIOS() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  const isAppleMobile = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
  // iPadOS 13+ si presenta come Mac ma ha il touch: va trattato come iOS per il banner.
  const isIpadOS13 = ua.includes("Macintosh") && navigator.maxTouchPoints > 1;
  return isAppleMobile || isIpadOS13;
}

export function usePwaInstallPrompt() {
  const [isInstalled, setIsInstalled] = useState(detectIsInstalled);
  const [isIOS] = useState(detectIsIOS);
  const [deferredPrompt, setDeferredPrompt] = useState(null);

  useEffect(() => {
    const onBeforeInstall = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    const onInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!deferredPrompt) return false;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    return outcome === "accepted";
  }, [deferredPrompt]);

  return {
    isInstalled,
    isIOS,
    /** true solo su Android/Chrome quando il browser ha offerto il prompt nativo. */
    canPromptInstall: Boolean(deferredPrompt),
    promptInstall,
  };
}
