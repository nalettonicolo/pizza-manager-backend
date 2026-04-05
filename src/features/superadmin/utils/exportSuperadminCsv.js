import { downloadCsv } from "@/utils/csvExport";

const SERVIZI_HEADERS = [
  "id",
  "nome",
  "categoria",
  "attivo",
  "prezzo_mensile_euro",
  "funzioni",
  "avanzamento_percentuale",
];

/**
 * @param {Array<{ id: string, nome: string, categoria?: string, attivo?: boolean, prezzoMensile?: number, funzioni?: string[], avanzamentoPercentuale?: number }>} services
 */
export function exportServiziCatalogCsv(services) {
  const rows = (services || []).map((s) => [
    s.id,
    s.nome,
    s.categoria || "",
    s.attivo === false ? "no" : "sì",
    String(s.prezzoMensile ?? ""),
    Array.isArray(s.funzioni) ? s.funzioni.join(" | ") : "",
    String(s.avanzamentoPercentuale ?? 0),
  ]);
  const stamp = new Date().toISOString().slice(0, 10);
  downloadCsv(`pizzamanager-catalogo-servizi-${stamp}.csv`, SERVIZI_HEADERS, rows);
}

const PIANI_HEADERS = [
  "id",
  "nome",
  "attivo",
  "validita_mesi",
  "sconto_abb_annuale_percent",
  "descrizione",
  "servizi_inclusi_ids",
  "canone_mensile_calcolato_euro",
];

/**
 * @param {Array<object>} piani
 * @param {Array<{ id: string, nome: string, prezzoMensile?: number }>} services
 */
export function exportPianiCsv(piani, services) {
  const priceById = Object.fromEntries((services || []).map((s) => [s.id, Number(s.prezzoMensile) || 0]));
  const rows = (piani || []).map((p) => {
    const inc = p.inclusioni || {};
    const ids = (services || []).filter((s) => inc[s.id] === true).map((s) => s.id);
    let sum = 0;
    for (const id of ids) sum += priceById[id] || 0;
    return [
      p.id,
      p.nome ?? "",
      p.attivo === false ? "no" : "sì",
      p.validitaMesi != null ? String(p.validitaMesi) : "",
      p.scontoAbbonamentoAnnualePercent != null && Number(p.scontoAbbonamentoAnnualePercent) > 0
        ? String(p.scontoAbbonamentoAnnualePercent)
        : "",
      (p.descrizione ?? "").replace(/\r?\n/g, " "),
      ids.join(","),
      String(Math.round(sum * 100) / 100),
    ];
  });
  const stamp = new Date().toISOString().slice(0, 10);
  downloadCsv(`pizzamanager-piani-${stamp}.csv`, PIANI_HEADERS, rows);
}
