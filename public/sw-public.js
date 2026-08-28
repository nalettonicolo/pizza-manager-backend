/**
 * Service worker minimo per la vetrina pubblica. Non fa caching (nessun offline reale per ora,
 * la cassa ha già la sua coda offline separata) — esiste solo perché Chrome/Android richiedono un
 * service worker registrato con un handler "fetch" per considerare il sito installabile e far
 * scattare l'evento beforeinstallprompt (senza SW, il banner "Installa" non compare mai lì, solo
 * su iOS che non ne ha bisogno). Pass-through puro: lascia fare tutto alla rete come al solito.
 *
 * Punto di partenza già pronto per il prossimo passo (notifiche push vere): l'evento "push" va
 * aggiunto qui quando si collega OneSignal/FCM.
 */
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", () => {
  // Nessuna intercettazione: la richiesta prosegue normale in rete.
});
