// Generazione PDF condivisa per i documenti contrattuali (ToS/Privacy/Contratto/DPA lato
// Admin tenant, contratto commerciale dinamico lato Superadmin) — estratta da
// TenantDocumentiPage.jsx perché ora usata da due pagine diverse, per non duplicare la stessa
// logica pdf-lib in due punti che potrebbero divergere.
import { PDFDocument, StandardFonts, rgb } from "pdf-lib"

/**
 * @param {object} args
 * @param {string} args.titolo
 * @param {string[]} args.paragrafi
 * @param {string} [args.firmaDataUrl] - PNG data URL dal canvas di firma
 * @param {string} [args.firmatoDa]
 * @returns {Promise<Blob>} PDF (application/pdf)
 */
export async function generaPdfBlob({ titolo, paragrafi, firmaDataUrl, firmatoDa }) {
  const pdfDoc = await PDFDocument.create()
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  let page = pdfDoc.addPage([595.28, 841.89]) // A4
  const margin = 50
  let y = page.getHeight() - margin

  page.drawText(titolo, { x: margin, y, size: 16, font: fontBold, color: rgb(0.06, 0.09, 0.16) })
  y -= 28

  const maxWidth = page.getWidth() - margin * 2
  const fontSize = 10.5
  const lineHeight = 15

  for (const paragrafo of paragrafi) {
    const words = String(paragrafo || "").split(/\s+/)
    let line = ""
    for (const word of words) {
      const test = line ? `${line} ${word}` : word
      if (font.widthOfTextAtSize(test, fontSize) > maxWidth) {
        if (y < margin + 120) {
          page = pdfDoc.addPage([595.28, 841.89])
          y = page.getHeight() - margin
        }
        page.drawText(line, { x: margin, y, size: fontSize, font, color: rgb(0.1, 0.1, 0.12) })
        y -= lineHeight
        line = word
      } else {
        line = test
      }
    }
    if (line) {
      if (y < margin + 120) {
        page = pdfDoc.addPage([595.28, 841.89])
        y = page.getHeight() - margin
      }
      page.drawText(line, { x: margin, y, size: fontSize, font, color: rgb(0.1, 0.1, 0.12) })
      y -= lineHeight
    }
    y -= 8
  }

  if (firmaDataUrl) {
    if (y < margin + 140) {
      page = pdfDoc.addPage([595.28, 841.89])
      y = page.getHeight() - margin
    }
    const pngBytes = await fetch(firmaDataUrl).then((r) => r.arrayBuffer())
    const png = await pdfDoc.embedPng(pngBytes)
    const scaled = png.scaleToFit(200, 80)
    page.drawText("Firma:", { x: margin, y, size: fontSize, font: fontBold })
    y -= 12
    page.drawImage(png, { x: margin, y: y - scaled.height, width: scaled.width, height: scaled.height })
    y -= scaled.height + 14
    page.drawText(`Firmato da: ${firmatoDa || "-"} — ${new Date().toLocaleString("it-IT")}`, {
      x: margin,
      y,
      size: 9,
      font,
      color: rgb(0.35, 0.38, 0.45),
    })
  }

  const bytes = await pdfDoc.save()
  return new Blob([bytes], { type: "application/pdf" })
}
