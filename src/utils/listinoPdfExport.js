/**
 * Apre una finestra di stampa con il listino (categorie + prodotti + prezzi) per salvare in PDF dal browser.
 * @param {{ localeNome?: string, righe: Array<{ categoria: string, nome: string, prezzo: string }> }} opts
 */
export function openListinoPdfPrint(opts) {
  const localeNome = (opts?.localeNome || "Listino").trim()
  const righe = Array.isArray(opts?.righe) ? opts.righe : []
  const rowsHtml = righe
    .map(
      (r) =>
        `<tr><td>${escapeHtml(r.categoria || "")}</td><td>${escapeHtml(r.nome || "")}</td><td style="text-align:right">${escapeHtml(r.prezzo || "")}</td></tr>`,
    )
    .join("")

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${escapeHtml(localeNome)}</title>
<style>
  body { font-family: system-ui, Segoe UI, sans-serif; padding: 16px; color: #111; }
  h1 { font-size: 18px; margin: 0 0 12px; }
  .meta { font-size: 12px; color: #555; margin-bottom: 16px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th, td { border-bottom: 1px solid #ddd; padding: 8px 6px; text-align: left; }
  th { background: #f5f5f5; font-weight: 600; }
  @media print { body { padding: 8px; } }
</style></head><body>
  <h1>${escapeHtml(localeNome)}</h1>
  <div class="meta">Esportazione listino · ${escapeHtml(new Date().toLocaleString("it-IT"))}</div>
  <table>
    <thead><tr><th>Categoria</th><th>Prodotto</th><th>Prezzo</th></tr></thead>
    <tbody>${rowsHtml}</tbody>
  </table>
  <script>window.onload=function(){window.print();}</script>
</body></html>`

  const w = window.open("", "_blank", "noopener,noreferrer")
  if (!w) {
    window.alert("Abilita i popup per stampare il PDF del listino.")
    return
  }
  w.document.open()
  w.document.write(html)
  w.document.close()
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}
