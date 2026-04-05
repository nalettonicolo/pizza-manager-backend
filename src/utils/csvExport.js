/**
 * Esportazione CSV (RFC 4180: virgolette se necessario, separator ; per Excel IT).
 */

function escapeCell(value) {
  const s = value == null ? "" : String(value);
  if (/[;\r\n"]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/**
 * @param {string} filename es. catalogo-servizi.csv
 * @param {string[]} headers
 * @param {string[][]} rows
 */
export function downloadCsv(filename, headers, rows) {
  const lines = [headers.map(escapeCell).join(";"), ...rows.map((r) => r.map(escapeCell).join(";"))];
  const bom = "\uFEFF";
  const blob = new Blob([bom + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
