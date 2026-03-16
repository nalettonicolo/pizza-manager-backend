/**
 * Log di debug solo in sviluppo (npm run dev).
 * In build di produzione non stampa nulla.
 */
const isDev = import.meta.env.DEV

export function devLog(tag, ...args) {
  if (isDev) {
    console.log(`[${tag}]`, ...args)
  }
}

export function devWarn(tag, ...args) {
  if (isDev) {
    console.warn(`[${tag}]`, ...args)
  }
}

export function devError(tag, ...args) {
  if (isDev) {
    console.error(`[${tag}]`, ...args)
  }
}
