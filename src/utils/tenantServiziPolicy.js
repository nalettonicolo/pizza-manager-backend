import { IDS_BASE, IDS_ENTERPRISE, IDS_PRO } from "@/config/serviziAppRegistro";

/**
 * Stima il valore enum `piano` (FREE / PRO / ENTERPRISE) utile a fatturazione e subscription,
 * in base all’insieme di id servizio abilitati (catalogo commerciale).
 */
export function inferPianoSaasFromServiziIds(ids) {
  const s = ids instanceof Set ? ids : new Set(Array.isArray(ids) ? ids : []);
  if (s.size === 0) return "FREE";
  for (const id of s) {
    if (!IDS_ENTERPRISE.includes(id)) return "ENTERPRISE";
  }
  for (const id of s) {
    if (!IDS_PRO.includes(id)) return "ENTERPRISE";
  }
  for (const id of s) {
    if (!IDS_BASE.includes(id)) return "PRO";
  }
  return "FREE";
}
