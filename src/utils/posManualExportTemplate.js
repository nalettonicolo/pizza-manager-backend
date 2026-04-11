/**
 * Percorso A: modello CSV per riconciliazione incassi POS esterni (nessun dato sensibile).
 */
const HEADERS = [
  "data_operazione",
  "numero_ordine_gestionale",
  "importo_ordine_eur",
  "tipo_pagamento_registrato_cassa",
  "riferimento_estratto_conto_pos",
  "note",
]

export function posManualReconciliationTemplateCsv() {
  const esc = (c) => `"${String(c).replace(/"/g, '""')}"`
  const line = HEADERS.map(esc).join(";")
  const example = [
    "2026-04-10",
    "42",
    "18.50",
    "Carta POS esterno",
    "SUMUP-XXXX",
    "Es. allineamento chiusura",
  ]
    .map(esc)
    .join(";")
  return `${line}\n${example}\n`
}

export function downloadPosManualReconciliationTemplate() {
  const blob = new Blob([posManualReconciliationTemplateCsv()], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = "pizzamanager_riconciliazione_pos_manuale.csv"
  a.click()
  URL.revokeObjectURL(url)
}
