/**
 * Rileva se il sito sta girando dentro l'app desktop Windows (Electron), che espone
 * `window.pizzaManagerDesktop.isDesktopApp` via preload.cjs — mai true in un browser normale o
 * nella PWA installata su smartphone/tablet. Serve ad adattare la UI dove "torna al sito" o
 * "installa l'app" non hanno senso: si è già dentro l'app nativa.
 */
export function isDesktopApp() {
  if (typeof window === "undefined") return false;
  return Boolean(window.pizzaManagerDesktop?.isDesktopApp);
}

/**
 * Dati del tenant "riconosciuto" via Partita IVA in fase di installazione (vedi
 * electron/build/installer.nsh + electron/main.cjs), se presenti: { nome, indirizzo, logo_url,
 * sede_legale? }. Solo nome/indirizzo/logo, mai credenziali. `null` se non installato dall'exe, o
 * se l'installazione non ha collegato nessuna pizzeria (campo facoltativo/non trovato).
 */
export function getDesktopTenantHint() {
  if (typeof window === "undefined") return null;
  const hint = window.pizzaManagerDesktop?.tenantHint;
  return hint && typeof hint === "object" && hint.nome ? hint : null;
}
