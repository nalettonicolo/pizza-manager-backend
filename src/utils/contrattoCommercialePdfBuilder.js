// Generazione PDF del "Contratto commerciale" (Superadmin → Preventivi e contratti) con
// impaginazione in stile fattura: intestazione a due colonne (Fornitore a sinistra, Cliente a
// destra), tabelle per servizi/attrezzature, box totale evidenziato. Sostituisce la prima
// versione a paragrafi piatti dopo il feedback esplicito dell'utente ("non mi piace, a sx voglio
// i miei dati e a dx quelli del cliente. con un bel layout e impaginazione").
//
// File separato da contrattoPdfBuilder.js (generaPdfBlob): quello resta invariato, usato dai
// documenti ToS/Privacy/Contratto abbonamento/DPA in area Admin tenant, che sono testo piatto
// senza dati economici da tabellare — nessun bisogno di questa impaginazione più complessa lì.
import { PDFDocument, StandardFonts, rgb } from "pdf-lib"

const PAGE_W = 595.28
const PAGE_H = 841.89
const MARGIN = 50
const CONTENT_W = PAGE_W - MARGIN * 2

const RED = rgb(0.753, 0.224, 0.169) // #c0392b, brand PizzaManager
const DARK = rgb(0.06, 0.09, 0.16)
const MUTED = rgb(0.42, 0.45, 0.52)
const LIGHT_BG = rgb(0.965, 0.965, 0.973)
const WHITE = rgb(1, 1, 1)
const BORDER = rgb(0.88, 0.89, 0.92)

function wrapLines(text, font, size, maxWidth) {
  const words = String(text ?? "").split(/\s+/).filter(Boolean)
  if (!words.length) return [""]
  const lines = []
  let line = ""
  for (const word of words) {
    const test = line ? `${line} ${word}` : word
    if (font.widthOfTextAtSize(test, size) > maxWidth && line) {
      lines.push(line)
      line = word
    } else {
      line = test
    }
  }
  if (line) lines.push(line)
  return lines
}

/**
 * Piccolo "writer" con avanzamento di pagina automatico: incapsula pdfDoc/page/y così le
 * funzioni di disegno sotto non devono passarsi a vicenda lo stato di paginazione.
 */
function createWriter(pdfDoc) {
  const w = {
    page: pdfDoc.addPage([PAGE_W, PAGE_H]),
    y: PAGE_H - MARGIN,
  }
  w.ensureSpace = (needed) => {
    if (w.y - needed < MARGIN) {
      w.page = pdfDoc.addPage([PAGE_W, PAGE_H])
      w.y = PAGE_H - MARGIN
    }
  }
  return w
}

function drawParagraph(w, text, { font, size, color, maxWidth = CONTENT_W, x = MARGIN, lineHeight }) {
  const lh = lineHeight || size * 1.4
  const lines = wrapLines(text, font, size, maxWidth)
  for (const line of lines) {
    w.ensureSpace(lh)
    w.page.drawText(line, { x, y: w.y, size, font, color })
    w.y -= lh
  }
}

/** Disegna un blocco "etichetta + righe" in una colonna di larghezza fissa, ritorna l'altezza usata. */
function drawInfoColumn(w, { x, width, label, fontBold, fontRegular, lines }) {
  const startY = w.y
  w.page.drawText(label, { x, y: startY, size: 9.5, font: fontBold, color: RED })
  let y = startY - 14
  for (const line of lines) {
    if (!line.text) continue
    const lh = (line.size || 10) * 1.3
    const wrapped = wrapLines(line.text, line.bold ? fontBold : fontRegular, line.size || 10, width)
    for (const wl of wrapped) {
      w.page.drawText(wl, {
        x,
        y,
        size: line.size || 10,
        font: line.bold ? fontBold : fontRegular,
        color: line.color || DARK,
      })
      y -= lh
    }
  }
  return startY - y
}

/** Tabella semplice: header rosso, righe alternate, ultima colonna allineata a destra. */
function drawTable(w, { fontBold, fontRegular, columns, rows, totalLabel, totalValue }) {
  const rowH = 18
  // Header
  w.ensureSpace(rowH)
  w.page.drawRectangle({ x: MARGIN, y: w.y - rowH, width: CONTENT_W, height: rowH, color: RED })
  let colX = MARGIN
  columns.forEach((col) => {
    const textX = col.align === "right" ? colX + col.width - fontBold.widthOfTextAtSize(col.label, 9.5) - 10 : colX + 10
    w.page.drawText(col.label, { x: textX, y: w.y - rowH + 5.5, size: 9.5, font: fontBold, color: WHITE })
    colX += col.width
  })
  w.y -= rowH

  rows.forEach((row, i) => {
    w.ensureSpace(rowH)
    if (i % 2 === 1) {
      w.page.drawRectangle({ x: MARGIN, y: w.y - rowH, width: CONTENT_W, height: rowH, color: LIGHT_BG })
    }
    colX = MARGIN
    columns.forEach((col) => {
      const raw = String(row[col.key] ?? "")
      const size = 10
      const textW = fontRegular.widthOfTextAtSize(raw, size)
      const textX = col.align === "right" ? colX + col.width - textW - 10 : colX + 10
      w.page.drawText(raw, { x: textX, y: w.y - rowH + 5.5, size, font: fontRegular, color: DARK })
      colX += col.width
    })
    w.y -= rowH
  })

  // Riga di bordo sotto la tabella
  w.page.drawLine({ start: { x: MARGIN, y: w.y }, end: { x: MARGIN + CONTENT_W, y: w.y }, thickness: 0.75, color: BORDER })
  w.y -= 5

  if (totalLabel) {
    w.ensureSpace(18)
    const label = `${totalLabel}: ${totalValue}`
    const size = 10.5
    const textW = fontBold.widthOfTextAtSize(label, size)
    w.page.drawText(label, { x: MARGIN + CONTENT_W - textW, y: w.y - 12, size, font: fontBold, color: DARK })
    w.y -= 20
  }
}

function formatEuro(n) {
  return new Intl.NumberFormat("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(n) || 0)
}

/**
 * @param {object} args
 * @param {ReturnType<typeof import('@/features/superadmin/utils/buildContrattoCommercialeDati').buildContrattoCommercialeDati>} args.dati
 * @param {string} [args.titolo] - "CONTRATTO COMMERCIALE" (default) o "PREVENTIVO" — un preventivo non è mai firmato.
 * @param {string} [args.firmaDataUrl] - PNG data URL dal canvas di firma
 * @param {string} [args.firmatoDa]
 * @returns {Promise<Blob>}
 */
export async function generaContrattoCommercialePdfBlob({ dati, titolo = "CONTRATTO COMMERCIALE", firmaDataUrl, firmatoDa }) {
  const pdfDoc = await PDFDocument.create()
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const fontItalic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique)
  const w = createWriter(pdfDoc)

  // ---- Titolo ----
  w.page.drawText(titolo, { x: MARGIN, y: w.y, size: 18, font: fontBold, color: DARK })
  w.y -= 20
  w.page.drawText(`PizzaManager — ${dati.cliente.nome}`, { x: MARGIN, y: w.y, size: 10.5, font, color: MUTED })
  w.y -= 12
  w.page.drawRectangle({ x: MARGIN, y: w.y, width: CONTENT_W, height: 2.5, color: RED })
  w.y -= 20

  // ---- Intestazione a due colonne: Fornitore (sx) / Cliente (dx) ----
  const gap = 24
  const colWidth = (CONTENT_W - gap) / 2
  const leftX = MARGIN
  const rightX = MARGIN + colWidth + gap
  const topY = w.y

  const hLeft = drawInfoColumn(w, {
    x: leftX,
    width: colWidth,
    label: "FORNITORE",
    fontBold,
    fontRegular: font,
    lines: [
      { text: dati.fornitore.ragioneSociale, bold: true, size: 11.5 },
      { text: dati.fornitore.indirizzo, size: 10 },
      { text: `P.IVA ${dati.fornitore.piva}`, size: 10 },
      { text: `Legale rappresentante: ${dati.fornitore.legaleRappresentante}`, size: 10 },
    ],
  })
  w.y = topY
  const clienteLines = [{ text: dati.cliente.nome, bold: true, size: 11.5 }]
  if (dati.cliente.piva) clienteLines.push({ text: `P.IVA ${dati.cliente.piva}`, size: 10 })
  if (dati.cliente.contatto) clienteLines.push({ text: dati.cliente.contatto, size: 10 })
  const hRight = drawInfoColumn(w, {
    x: rightX,
    width: colWidth,
    label: "CLIENTE",
    fontBold,
    fontRegular: font,
    lines: clienteLines,
  })

  w.y = topY - Math.max(hLeft, hRight) - 12
  w.page.drawLine({ start: { x: MARGIN, y: w.y }, end: { x: MARGIN + CONTENT_W, y: w.y }, thickness: 1, color: RED })
  w.y -= 16

  // ---- Tabella servizi ----
  w.ensureSpace(28)
  const titoloServizi = dati.nomePiano
    ? `Servizi PizzaManager sottoscritti — piano "${dati.nomePiano}"`
    : "Servizi PizzaManager sottoscritti"
  w.page.drawText(titoloServizi, { x: MARGIN, y: w.y, size: 12, font: fontBold, color: DARK })
  w.y -= 15

  if (dati.servizi.length === 0) {
    drawParagraph(w, "Nessun servizio a canone aggiuntivo oltre al piano base.", { font, size: 10, color: MUTED })
    w.y -= 6
  } else {
    drawTable(w, {
      fontBold,
      fontRegular: font,
      columns: [
        { key: "nome", label: "Servizio", width: CONTENT_W - 150 },
        { key: "prezzo", label: "Canone mensile", width: 150, align: "right" },
      ],
      rows: dati.servizi.map((s) => ({ nome: s.nome, prezzo: `€ ${formatEuro(s.prezzoMensile)}` })),
      totalLabel: "Totale servizi",
      totalValue: `€ ${formatEuro(dati.totaleServizi)}/mese`,
    })
  }

  // ---- Tabella attrezzature (Hardware): noleggio mensile e vendita una tantum nella stessa
  // tabella, distinte dalla colonna "Modalità" — richiesta esplicita dell'utente di poter
  // scegliere per ogni prodotto se noleggiarlo o venderlo, a prezzo standard di catalogo.
  if (dati.attrezzature.length > 0) {
    w.ensureSpace(28)
    w.page.drawText("Hardware", { x: MARGIN, y: w.y, size: 12, font: fontBold, color: DARK })
    w.y -= 15
    const importi = dati.attrezzature.map((a) =>
      a.tipo === "vendita" ? `€ ${formatEuro(a.prezzoVenditaTotale)} (una tantum)` : `€ ${formatEuro(a.canoneMensile)}/mese`,
    )
    drawTable(w, {
      fontBold,
      fontRegular: font,
      columns: [
        { key: "nome", label: "Prodotto", width: CONTENT_W - 350 },
        { key: "modalita", label: "Modalità", width: 90 },
        { key: "qty", label: "Qtà", width: 40, align: "right" },
        { key: "importo", label: "Importo", width: 130, align: "right" },
        { key: "cauzione", label: "Cauzione", width: 90, align: "right" },
      ],
      rows: dati.attrezzature.map((a, i) => ({
        nome: a.nome,
        modalita: a.tipo === "vendita" ? "Vendita" : "Noleggio",
        qty: String(a.quantita),
        importo: importi[i],
        cauzione: a.tipo === "noleggio" && a.cauzione > 0 ? `€ ${formatEuro(a.cauzione)}` : "—",
      })),
    })
    const righeTotali = []
    if (dati.totaleNoleggio > 0) righeTotali.push(`Noleggio: € ${formatEuro(dati.totaleNoleggio)}/mese`)
    if (dati.totaleCauzioni > 0) righeTotali.push(`cauzioni € ${formatEuro(dati.totaleCauzioni)} (una tantum)`)
    if (dati.totaleVenditaUnaTantum > 0) righeTotali.push(`Vendita: € ${formatEuro(dati.totaleVenditaUnaTantum)} (una tantum)`)
    if (righeTotali.length) {
      w.ensureSpace(16)
      const label = `Totale hardware — ${righeTotali.join(" · ")}`
      const size = 10
      const textW = fontBold.widthOfTextAtSize(label, size)
      w.page.drawText(label, { x: MARGIN + CONTENT_W - textW, y: w.y - 12, size, font: fontBold, color: DARK })
      w.y -= 20
    }
  }

  // ---- Box totale/i evidenziato/i ----
  // Un secondo box (contorno, non pieno) per la vendita una tantum, se presente: distinto dal
  // canone mensile ricorrente per non farli sembrare sommabili nello stesso importo periodico.
  const hasVendita = dati.totaleVenditaUnaTantum > 0
  w.ensureSpace(hasVendita ? 48 : 48)
  const boxH = 38
  const boxW = hasVendita ? 224 : 240
  const gapBox = 10
  const boxXTotale = MARGIN + CONTENT_W - boxW
  if (hasVendita) {
    const boxXVendita = boxXTotale - gapBox - boxW
    w.page.drawRectangle({
      x: boxXVendita,
      y: w.y - boxH,
      width: boxW,
      height: boxH,
      borderColor: RED,
      borderWidth: 1.5,
      color: WHITE,
    })
    w.page.drawText("HARDWARE (UNA TANTUM)", { x: boxXVendita + 14, y: w.y - 15, size: 8, font: fontBold, color: RED })
    w.page.drawText(`€ ${formatEuro(dati.totaleVenditaUnaTantum)}`, {
      x: boxXVendita + 14,
      y: w.y - 30,
      size: 14,
      font: fontBold,
      color: DARK,
    })
  }
  w.page.drawRectangle({ x: boxXTotale, y: w.y - boxH, width: boxW, height: boxH, color: RED })
  w.page.drawText("TOTALE CANONE MENSILE", { x: boxXTotale + 14, y: w.y - 15, size: 8.5, font: fontBold, color: WHITE })
  w.page.drawText(`€ ${formatEuro(dati.totaleMensile)}`, { x: boxXTotale + 14, y: w.y - 30, size: 15, font: fontBold, color: WHITE })
  w.y -= boxH + 8
  drawParagraph(w, "IVA esclusa salvo diversa indicazione in fattura — fatturazione mensile posticipata salvo diverso accordo scritto tra le parti.", {
    font: fontItalic,
    size: 8.5,
    color: MUTED,
    lineHeight: 11,
  })
  w.y -= 12

  // ---- Clausole generali ----
  w.ensureSpace(18)
  w.page.drawText("Clausole generali", { x: MARGIN, y: w.y, size: 11.5, font: fontBold, color: DARK })
  w.y -= 13
  for (const clausola of dati.clausole) {
    drawParagraph(w, clausola, { font: fontItalic, size: 9, color: MUTED, lineHeight: 11.5 })
    w.y -= 4
  }

  // ---- Firma ----
  if (firmaDataUrl) {
    w.ensureSpace(108)
    w.y -= 8
    w.page.drawLine({ start: { x: MARGIN, y: w.y }, end: { x: MARGIN + CONTENT_W, y: w.y }, thickness: 0.75, color: BORDER })
    w.y -= 16
    w.page.drawText("Firma per accettazione:", { x: MARGIN, y: w.y, size: 10, font: fontBold, color: DARK })
    w.y -= 10
    const pngBytes = await fetch(firmaDataUrl).then((r) => r.arrayBuffer())
    const png = await pdfDoc.embedPng(pngBytes)
    const scaled = png.scaleToFit(170, 55)
    w.page.drawImage(png, { x: MARGIN, y: w.y - scaled.height, width: scaled.width, height: scaled.height })
    w.y -= scaled.height + 10
    w.page.drawText(`Firmato da: ${firmatoDa || "-"} — ${new Date().toLocaleString("it-IT")}`, {
      x: MARGIN,
      y: w.y,
      size: 8.5,
      font,
      color: MUTED,
    })
  }

  const bytes = await pdfDoc.save()
  return new Blob([bytes], { type: "application/pdf" })
}
