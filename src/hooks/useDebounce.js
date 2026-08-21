import { useEffect, useState } from "react"

/**
 * Ritorna `value` con un ritardo `delay` (ms): si aggiorna solo quando `value` smette di
 * cambiare per almeno `delay` ms. Utile per ricerche live senza sparare una richiesta per ogni
 * carattere digitato.
 */
export function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebouncedValue(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debouncedValue
}
