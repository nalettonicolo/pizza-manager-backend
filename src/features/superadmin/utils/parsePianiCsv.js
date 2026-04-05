import {
  defaultInclusioni,
  inclusioniFromIds,
  normalizePlan,
} from "@/features/superadmin/catalog/plansStorage";
import { parseDelimitedTextToKeyedRows } from "@/features/superadmin/utils/parseServiziCsv";

/**
 * Parser CSV piani (stesso formato di export: header id, nome, attivo, validita_mesi, sconto_abb_annuale_percent, …).
 * Accetta anche colonna legacy `validita_giorni`.
 *
 * @param {string} text
 * @param {Array<{ id: string }>} services
 * @returns {object[]} piani normalizzati (senza merge in elenco esistente)
 */
export function parsePianiCsv(text, services) {
  const rows = parseDelimitedTextToKeyedRows(text);
  if (!rows.length) return [];
  const svc = services || [];
  const allowedIds = new Set(svc.map((s) => s.id));

  const out = [];
  for (const r of rows) {
    const id = String(r.id ?? "").trim();
    if (!id) continue;

    const rawIds = String(r.servizi_inclusi_ids ?? r.servizi_inclusi ?? "")
      .split(/[,;|\s]+/)
      .map((x) => x.trim())
      .filter(Boolean);
    const filteredIds = rawIds.filter((x) => allowedIds.has(x));
    const inc = { ...defaultInclusioni(svc), ...inclusioniFromIds(svc, filteredIds) };

    const attivoStr = String(r.attivo ?? "").trim().toLowerCase();
    const attivo = attivoStr !== "no" && attivoStr !== "false" && attivoStr !== "0";

    let validitaMesi;
    if (r.validita_mesi !== undefined && String(r.validita_mesi).trim() !== "") {
      validitaMesi = Math.max(1, Math.floor(Number(String(r.validita_mesi).replace(",", "."))) || 1);
    } else if (r.validita_giorni !== undefined && String(r.validita_giorni).trim() !== "") {
      const g = Number(String(r.validita_giorni).replace(",", "."));
      if (Number.isFinite(g) && g >= 360) validitaMesi = 12;
      else if (Number.isFinite(g) && g >= 25 && g <= 35) validitaMesi = 1;
      else if (Number.isFinite(g) && g > 0) validitaMesi = Math.max(1, Math.round(g / 30));
      else validitaMesi = 1;
    } else {
      validitaMesi = 1;
    }

    let scontoAbbonamentoAnnualePercent = 0;
    if (r.sconto_abb_annuale_percent !== undefined && String(r.sconto_abb_annuale_percent).trim() !== "") {
      const x = Number(String(r.sconto_abb_annuale_percent).replace(",", "."));
      if (Number.isFinite(x)) scontoAbbonamentoAnnualePercent = Math.min(100, Math.max(0, x));
    }

    const raw = {
      id,
      nome: String(r.nome ?? "").trim(),
      descrizione: String(r.descrizione ?? "").trim(),
      attivo,
      validitaMesi,
      scontoAbbonamentoAnnualePercent,
      inclusioni: inc,
    };
    out.push(normalizePlan(raw, svc));
  }
  return out;
}

/**
 * Aggiorna/inserisce piani dal CSV; i piani il cui `id` non compare nel CSV restano in coda invariati.
 * @param {object[]} currentPiani
 * @param {object[]} parsedPiani
 */
export function mergePianiImport(currentPiani, parsedPiani) {
  const parsedIds = new Set((parsedPiani || []).map((p) => p.id));
  const kept = (currentPiani || []).filter((c) => c?.id && !parsedIds.has(c.id));
  return [...(parsedPiani || []), ...kept];
}
