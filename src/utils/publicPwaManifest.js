/**
 * Manifest PWA delle pagine pubbliche (mai su admin/superadmin/operative, che restano dentro
 * l'app già autenticata — loro caso d'uso è l'app desktop/PWA installata, non questo banner).
 * Due varianti, scelte dal chiamante (PublicLayout) in base alla pagina:
 * - "vetrina": storefront del singolo tenant (/negozio, /preview) — installata dal cliente finale
 *   per riordinare e ricevere le notifiche in tempo reale sui propri ordini (start_url /negozio).
 * - "app" (default): landing SaaS, /login e pagine pubbliche generiche su pizzamanager.it —
 *   installata dallo staff (admin/cassa/superadmin di un qualsiasi tenant) per accedere più in
 *   fretta al gestionale; start_url /login, che se la sessione è già valida reindirizza da solo
 *   alla home corretta per ruolo (vedi Login.jsx) — un solo ingresso valido per tutti i tenant,
 *   dato che login/admin/cassa/superadmin vivono tutti sullo stesso dominio pizzamanager.it.
 * Stesso pattern di tenantFavicon.js: un solo <link> nel <head>, creato se manca e aggiornato/
 * rimosso quando non serve più.
 */
let linkEl = null;

const MANIFEST_HREF_BY_VARIANT = {
  vetrina: "/manifest-public.webmanifest",
  app: "/manifest-app.webmanifest",
};

export function applyPublicPwaManifest(variant = "app") {
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
  linkEl.setAttribute("href", MANIFEST_HREF_BY_VARIANT[variant] || MANIFEST_HREF_BY_VARIANT.app);
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
