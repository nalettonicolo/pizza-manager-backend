/**
 * Precarica chunk lazy in un momento di idle (navigazione successiva più rapida).
 * Gli import devono coincidere con le stringhe usate in React.lazy in AppRouter.
 */
export function prefetchWhenIdle(importers, options = {}) {
  if (typeof window === "undefined") return undefined;
  const { timeout = 3200, delayFallbackMs = 500 } = options;

  const run = () => {
    for (const fn of importers) {
      try {
        void fn();
      } catch {
        /* ignore */
      }
    }
  };

  if (typeof requestIdleCallback !== "undefined") {
    const id = requestIdleCallback(run, { timeout });
    return () => cancelIdleCallback(id);
  }
  const t = window.setTimeout(run, delayFallbackMs);
  return () => window.clearTimeout(t);
}
