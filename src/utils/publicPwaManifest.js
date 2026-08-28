/**
 * Manifest PWA della vetrina cliente — iniettato solo sulle pagine pubbliche (vetrina, checkout,
 * area cliente), mai su admin/superadmin/operative. Stesso pattern di tenantFavicon.js: un solo
 * <link> nel <head>, creato se manca e rimosso quando non serve più.
 */
let linkEl = null;

export function applyPublicPwaManifest() {
  if (typeof document === "undefined") return;
  if (!linkEl) {
    linkEl = document.querySelector("link[rel='manifest'][data-pm-public]");
  }
  if (!linkEl) {
    linkEl = document.createElement("link");
    linkEl.setAttribute("rel", "manifest");
    linkEl.setAttribute("data-pm-public", "1");
    document.head.appendChild(linkEl);
  }
  linkEl.setAttribute("href", "/manifest-public.webmanifest");
}

export function removePublicPwaManifest() {
  if (typeof document === "undefined") return;
  const el = linkEl || document.querySelector("link[rel='manifest'][data-pm-public]");
  if (el?.parentNode) el.parentNode.removeChild(el);
  linkEl = null;
}

/**
 * Registra il service worker minimo della vetrina pubblica: senza un SW registrato, Chrome/
 * Android non considerano il sito installabile e l'evento beforeinstallprompt non scatta mai —
 * il banner "Installa" resterebbe muto lì (funzionava solo su iOS, che non ne ha bisogno).
 * Idempotente: chiamarla più volte non registra copie multiple.
 */
export function registerPublicServiceWorker() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  navigator.serviceWorker.register("/sw-public.js").catch(() => {
    // Ambiente senza HTTPS/localhost valido o SW non supportato: il banner iOS resta comunque
    // utile, quello Android/Chrome semplicemente non offrirà il prompt nativo.
  });
}
