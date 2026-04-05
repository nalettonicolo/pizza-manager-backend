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
          void fn();
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
