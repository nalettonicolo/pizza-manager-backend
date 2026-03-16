/**
 * Formatta un prezzo/costo sempre con 2 decimali.
 * @param {number|string|null|undefined} value - Valore da formattare
 * @param {string} fallback - Testo se value è vuoto/null/undefined (default "—")
 * @returns {string}
 */
export function formatPrice(value, fallback = "—") {
  if (value === null || value === undefined || value === "") return fallback;
  const n = Number(value);
  if (Number.isNaN(n)) return fallback;
  return n.toFixed(2);
}

/**
 * Converte un valore in numero, accettando virgola come decimale (es. "0,40").
 * @param {number|string|null|undefined} value
 * @returns {number}
 */
export function parsePrice(value) {
  if (value === null || value === undefined || value === "") return 0;
  if (typeof value === "number" && !Number.isNaN(value)) return value;
  const s = String(value).trim().replace(",", ".");
  const n = Number(s);
  return Number.isNaN(n) ? 0 : n;
}
