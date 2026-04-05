/**
 * Dopo un nuovo deploy, il browser può ancora usare un index.html che referenzia
 * chunk JS con hash vecchi → "Failed to fetch dynamically imported module".
 * Un reload una tantum recupera il nuovo index e i path corretti.
 */
const RELOAD_KEY = "pm_chunk_reload_attempted"

function isChunkLoadError(err) {
  const msg = String(err?.message ?? err ?? "")
  return (
    msg.includes("Failed to fetch dynamically imported module") ||
    msg.includes("error loading dynamically imported module") ||
    msg.includes("Importing a module script failed") ||
    err?.name === "ChunkLoadError"
  )
}

/**
 * @param {typeof import('react').lazy} reactLazy - React.lazy
 * @returns {typeof import('react').lazy}
 */
export function createLazyWithChunkReload(reactLazy) {
  return function lazy(importFn) {
    return reactLazy(() =>
      importFn()
        .then((m) => {
          try {
            sessionStorage.removeItem(RELOAD_KEY)
          } catch (_) {
            /* ignore */
          }
          return m
        })
        .catch((err) => {
          if (!isChunkLoadError(err)) throw err
          try {
            if (sessionStorage.getItem(RELOAD_KEY)) throw err
            sessionStorage.setItem(RELOAD_KEY, "1")
          } catch (_) {
            throw err
          }
          window.location.reload()
          return new Promise(() => {})
        }),
    )
  }
}
