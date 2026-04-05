/**
 * Parser CSV catalogo servizi (separatore ; o ,). Header attesi (case-insensitive):
 * id, nome, categoria, attivo, prezzo_mensile_euro, funzioni, avanzamento_percentuale
 */

function detectDelimiter(headerLine) {
  const semi = (headerLine.match(/;/g) || []).length;
  const comma = (headerLine.match(/,/g) || []).length;
  return semi >= comma ? ";" : ",";
}

function splitLine(line, delim) {
  const out = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if ((delim === ";" && c === ";") || (delim === "," && c === ",")) {
      if (!inQuotes) {
        out.push(cur);
        cur = "";
      } else {
        cur += c;
      }
    } else {
      cur += c;
    }
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

function normHeader(h) {
  return String(h || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
}

/**
 * CSV generico (separatore ; o ,) → righe come oggetti con chiavi dagli header normalizzati.
 * @param {string} text
 * @returns {Record<string, string>[]}
 */
export function parseDelimitedTextToKeyedRows(text) {
  const lines = String(text || "")
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length);
  if (!lines.length) return [];
  const delim = detectDelimiter(lines[0]);
  const headers = splitLine(lines[0], delim).map(normHeader);
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = splitLine(lines[i], delim);
    const row = {};
    headers.forEach((h, j) => {
      row[h] = cells[j] ?? "";
    });
    rows.push(row);
  }
  return rows;
}

/**
 * @param {string} text
 * @returns {Record<string, string>[]}
 */
export function parseServiziCsv(text) {
  return parseDelimitedTextToKeyedRows(text);
}

/**
 * Applica righe CSV al catalogo: aggiorna per `id` (nome/categoria/prezzo/funzioni/avanzamento se presenti).
 * @param {Array<object>} services
 * @param {Record<string, string>[]} csvRows
 */
export function applyServiziCsvToCatalog(services, csvRows) {
  const byId = new Map((services || []).map((s) => [s.id, { ...s }]));
  for (const r of csvRows || []) {
    const id = (r.id || "").trim();
    if (!id || !byId.has(id)) continue;
    const cur = byId.get(id);
    if (r.nome) cur.nome = String(r.nome).trim();
    if (r.categoria) cur.categoria = String(r.categoria).trim();
    if (r.attivo !== undefined && r.attivo !== "") {
      const a = String(r.attivo).toLowerCase();
      cur.attivo = a === "sì" || a === "si" || a === "true" || a === "1" || a === "yes";
    }
    if (r.prezzo_mensile_euro !== undefined && r.prezzo_mensile_euro !== "") {
      cur.prezzoMensile = Math.max(0, Number(String(r.prezzo_mensile_euro).replace(",", ".")) || 0);
    }
    if (r.funzioni !== undefined && r.funzioni !== "") {
      cur.funzioni = String(r.funzioni)
        .split(/\s*\|\s*|\n/)
        .map((x) => x.trim())
        .filter(Boolean);
    }
    if (r.avanzamento_percentuale !== undefined && r.avanzamento_percentuale !== "") {
      const n = Number(String(r.avanzamento_percentuale).replace(",", "."));
      if (Number.isFinite(n)) {
        cur.avanzamentoPercentuale = Math.round(Math.min(100, Math.max(0, n)));
      }
    }
    byId.set(id, cur);
  }
  return (services || []).map((s) => byId.get(s.id) || s);
}
