/**
 * Normalizza hostname per salvataggio (senza schema, senza path, lowercase).
 * @param {string} raw
 * @returns {string|null}
 */
export function normalizePublicDomainHostname(raw) {
  if (raw == null || typeof raw !== "string") return null;
  let s = raw.trim().toLowerCase();
  if (!s) return null;
  try {
    if (s.includes("://")) {
      const u = new URL(s);
      s = u.hostname || "";
    }
  } catch {
    // continua con stringa grezza
  }
  s = s.split("/")[0].split(":")[0].trim();
  if (!s) return null;
  return s;
}

/**
 * Normalizza URL sito esterno (es. Google Sites). Ritorna null se vuoto o non valido.
 * @param {string} raw
 * @returns {string|null}
 */
export function normalizeClienteSitoWebUrl(raw) {
  if (raw == null || typeof raw !== "string") return null;
  let s = raw.trim();
  if (!s) return null;
  if (!/^https?:\/\//i.test(s)) s = `https://${s}`;
  try {
    const u = new URL(s);
    if (!u.hostname || u.hostname.length < 3) return null;
    return u.href;
  } catch {
    return null;
  }
}

/** Hostname RFC-like (semplice) */
export function isPlausibleHostname(hostname) {
  if (!hostname || typeof hostname !== "string") return false;
  const h = hostname.trim().toLowerCase();
  if (h.length < 4 || h.length > 253) return false;
  return /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/.test(h);
}
