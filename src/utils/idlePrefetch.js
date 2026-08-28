/**
 * Precarica chunk lazy in un momento di idle (navigazione successiva più rapida).
 * Gli import devono coincidere con le stringhe usate in React.lazy in AppRouter.
 * Piccolo scarto tra una richiesta e l’altra per evitare picchi di rete paralleli.
 */
export function prefetchWhenIdle(importers, options = {}) {
  if (typeof window === "undefined") return undefined;
  const { timeout = 3200, delayFallbackMs = 500, staggerMs = 50 } = options;

  const staggerIds = new Set();

  const run = () => {
    importers.forEach((fn, i) => {
      const tid = window.setTimeout(() => {
        staggerIds.delete(tid);
        try {
          // fn() ritorna una Promise: un try/catch sincrono non intercetta un suo reject
          // (es. chunk JS con hash ormai vecchio dopo un deploy) — senza .catch() qui, il
          // reject sfugge come unhandledrejection globale e finisce loggato come errore vero
          // in log_errori_operativi, pur essendo solo un prefetch in background non bloccante.
          void fn()?.catch(() => {
            /* prefetch best-effort: un fallimento (es. chunk stale post-deploy) si
               autorisolve alla prossima navigazione reale via lazyWithReload */
          });
        } catch {
          /* ignore */
        }
      }, i * staggerMs);
      staggerIds.add(tid);
    });
  };

  const clearStagger = () => {
    for (const tid of staggerIds) window.clearTimeout(tid);
    staggerIds.clear();
  };

  if (typeof requestIdleCallback !== "undefined") {
    const id = requestIdleCallback(run, { timeout });
    return () => {
      cancelIdleCallback(id);
      clearStagger();
    };
  }
  const t = window.setTimeout(run, delayFallbackMs);
  return () => {
    window.clearTimeout(t);
    clearStagger();
  };
}
