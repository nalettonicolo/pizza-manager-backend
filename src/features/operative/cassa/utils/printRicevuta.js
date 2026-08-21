/**
 * Ricevuta cliente (stampa browser / PDF) — indipendente dalla comanda cucina.
 */

import { printHtmlDocument } from "@/utils/printHtmlDocument"
import { formatIndirizzoDisplayItaliano } from "@/utils/formatIndirizzoItaliano"
import { extractModificheFromIngredientiSummary } from "@/features/operative/cassa/utils/comandaIngredientiSummary"

function escapeHtml(s) {
  if (s == null || s === "") return ""
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function clampNum(v, fallback, min, max) {
  const n = Number(v)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, n))
}

const RICEVUTA_FONT_STACK = {
  system: 'system-ui, "Segoe UI", Roboto, sans-serif',
  sans: 'Arial, Helvetica, "Helvetica Neue", sans-serif',
  mono: '"Courier New", Courier, "Liberation Mono", monospace',
  serif: 'Georgia, "Times New Roman", Times, serif',
}

/** Righe con importi da carrello (post-conferma, snapshot). */
export function ricevutaRigheFromCartSnapshot(snapshotCart) {
  if (!Array.isArray(snapshotCart)) return []
  return snapshotCart.map((item) => {
    const qty = item.qty || 1
    const prezzo = Number(item.prezzo || 0)
    const titolo = item.formatoNome ? `${item.nome || "—"} (${item.formatoNome})` : item.nome || "—"
    const full = String(item.ingredientiCotturaSummary || item.ingredienti_cottura_summary || "").trim()
    const dettaglio =
      String(item.ingredientiModificheClienteSummary || "").trim() ||
      extractModificheFromIngredientiSummary(full)
    return { qty, titolo, prezzoUnit: prezzo, importo: prezzo * qty, dettaglio }
  })
}

/** Righe con importi da dettaglio ordine salvato. */
export function ricevutaRigheFromOrdineDetail(detail) {
  const names = detail?.productNames || {}
  return (detail?.righe || []).map((r) => {
    const pid = r.prodottoId ?? r.prodotto_id
    const nomeBase = names[pid] || "Prodotto"
    const formatoNome = r.formatoNome ?? r.formato_nome
    const titolo = formatoNome ? `${nomeBase} (${formatoNome})` : nomeBase
    const qty = r.quantita || 1
    const prezzo = Number(r.prezzo || 0)
    const full = String(r.ingredientiCotturaSummary ?? r.ingredienti_cottura_summary ?? "").trim()
    const dettaglio = extractModificheFromIngredientiSummary(full)
    return { qty, titolo, prezzoUnit: prezzo, importo: prezzo * qty, dettaglio }
  })
}

/**
 * @param {object} detail — getOrderDetail + productNames
 * @param {object} tenantData
 */
export function ricevutaPayloadFromOrdineDetail(detail, tenantData) {
  if (!detail) return null
  const righe = ricevutaRigheFromOrdineDetail(detail)
  const sommaRighe = righe.reduce((s, x) => s + x.importo, 0)
  const totale = Number(detail.totale ?? sommaRighe)
  return {
    tenantNome: tenantData?.nome || "Locale",
    orderId: detail.id,
    numero: detail.numero ?? detail.numero_ordine ?? detail.numeroOrdine,
    createdAt: detail.createdAt ?? detail.created_at,
    tipoOrdine: detail.tipo_ordine ?? detail.tipoOrdine,
    nomeCliente: detail.nome_cliente ?? detail.nomeCliente ?? detail.nome,
    orarioRitiro: detail.orario_ritiro ?? detail.orarioRitiro,
    indirizzoConsegna: detail.indirizzo_consegna ?? detail.indirizzoConsegna ?? detail.indirizzo,
    note: detail.note,
    tipoPagamento: detail.tipo_pagamento ?? detail.tipoPagamento,
    righe,
    totale,
    parametri: tenantData?.parametri_operativi || {},
    annullato: String(detail.stato ?? "").trim().toUpperCase() === "ANNULLATO",
  }
}

/**
 * @param {object} payload
 * @param {string} payload.tenantNome
 * @param {string} [payload.orderId]
 * @param {string|number} [payload.numero]
 * @param {string} [payload.createdAt]
 * @param {string} [payload.tipoOrdine]
 * @param {string} [payload.nomeCliente]
 * @param {string} [payload.orarioRitiro]
 * @param {string} [payload.indirizzoConsegna]
 * @param {string} [payload.note]
 * @param {string} [payload.tipoPagamento]
 * @param {Array<{ qty: number, titolo: string, prezzoUnit: number, importo: number }>} payload.righe
 * @param {number} payload.totale
 * @param {object} [payload.parametri] — riusa comanda_font_size, comanda_line_height, comanda_margin_mm, comanda_width_mm, comanda_rotolo_mm, comanda_font_family
 * @param {boolean} [payload.annullato]
 */
export function buildRicevutaHtmlDocument(payload) {
  const {
    tenantNome = "Locale",
    orderId,
    numero,
    createdAt,
    tipoOrdine,
    nomeCliente,
    orarioRitiro,
    indirizzoConsegna,
    note,
    tipoPagamento,
    righe = [],
    totale = 0,
    parametri = {},
    annullato = false,
  } = payload

  const fontSize = clampNum(parametri.comanda_font_size, 13, 8, 28)
  const lineHeight = clampNum(parametri.comanda_line_height, 1.35, 1.05, 1.9)
  const marginMm = clampNum(parametri.comanda_margin_mm, 8, 2, 24)
  const rotoloRaw = Number(parametri.comanda_rotolo_mm)
  const rotoliValidi = new Set([58, 76, 80])
  const rotoloMm = rotoliValidi.has(rotoloRaw) ? rotoloRaw : 0
  const larghezzaUtilePreset = rotoloMm === 58 ? 52 : rotoloMm === 76 ? 68 : rotoloMm === 80 ? 72 : 0
  let widthMm = clampNum(parametri.comanda_width_mm, 0, 0, 120)
  if (widthMm <= 0 && larghezzaUtilePreset > 0) widthMm = larghezzaUtilePreset
  const pageSizeRule = rotoloMm > 0 ? `size: ${rotoloMm}mm auto;` : "size: auto;"
  const fontKey = RICEVUTA_FONT_STACK[parametri.comanda_font_family] ? parametri.comanda_font_family : "mono"
  const fontStack = RICEVUTA_FONT_STACK[fontKey]

  const when = createdAt ? new Date(createdAt).toLocaleString("it-IT") : new Date().toLocaleString("it-IT")
  const isDel = String(tipoOrdine || "").toLowerCase() === "delivery"
  const tipoLabel = isDel ? "Consegna" : "Ritiro in negozio"
  const showId = parametri?.comanda_mostra_id_ordine === true || parametri?.comanda_mostra_id_ordine === "true"

  const righeHtml = righe
    .map((r) => {
      const det = String(r.dettaglio || "").trim()
      const detHtml = det
        ? `<div class="dettaglio">${escapeHtml(det)}</div>`
        : ""
      return `<div class="riga">
      <div class="riga-main"><span class="qty">${escapeHtml(String(r.qty))}×</span> <span class="titolo">${escapeHtml(r.titolo)}</span>${detHtml}</div>
      <div class="importo">€ ${Number(r.importo).toFixed(2)}</div>
    </div>`
    })
    .join("")

  const widthRule =
    widthMm > 0
      ? `max-width: ${widthMm}mm; margin-left: auto; margin-right: auto; box-sizing: border-box;`
      : ""

  const annullatoBlock = annullato
    ? `<div class="annullato">ORDINE ANNULLATO — documento non fiscale</div>`
    : ""

  const headerParts = [
    `<div class="banner">RICEVUTA</div>`,
    annullatoBlock,
    `<div class="when">${escapeHtml(when)}</div>`,
    `<div><strong>Locale</strong> ${escapeHtml(tenantNome)}</div>`,
  ]
  if (numero != null && numero !== "") {
    headerParts.push(`<div><strong>Ordine</strong> #${escapeHtml(String(numero))}</div>`)
  }
  if (orderId && showId) {
    const shortId = String(orderId).length > 12 ? `${String(orderId).slice(0, 8)}…` : String(orderId)
    headerParts.push(`<div class="meta-id"><strong>ID</strong> ${escapeHtml(shortId)}</div>`)
  }
  headerParts.push(`<div class="meta-tipo"><strong>${escapeHtml(tipoLabel)}</strong></div>`)
  if (nomeCliente) headerParts.push(`<div><strong>Cliente</strong> ${escapeHtml(String(nomeCliente))}</div>`)
  if (orarioRitiro) headerParts.push(`<div><strong>Orario</strong> ${escapeHtml(String(orarioRitiro))}</div>`)
  if (indirizzoConsegna) {
    const raw = String(indirizzoConsegna)
    const indFmt = formatIndirizzoDisplayItaliano(raw) || raw
    headerParts.push(`<div><strong>Indirizzo</strong> ${escapeHtml(indFmt)}</div>`)
  }
  if (tipoPagamento) headerParts.push(`<div><strong>Pagamento</strong> ${escapeHtml(String(tipoPagamento))}</div>`)

  // Sconto cassa: riga dedicata (non solo nelle note)
  const noteStr = note != null ? String(note) : ""
  const scontoMatch = noteStr.match(/\[Sconto cassa €\s*([0-9]+(?:[.,][0-9]{1,2})?)\s*\]/i)
  let noteClean = noteStr
  let scontoEuro = null
  if (scontoMatch) {
    scontoEuro = Number(String(scontoMatch[1]).replace(",", "."))
    noteClean = noteStr.replace(scontoMatch[0], "").replace(/\s{2,}/g, " ").trim()
  }
  if (Number.isFinite(Number(payload.scontoCassaEuro)) && Number(payload.scontoCassaEuro) > 0) {
    scontoEuro = Number(payload.scontoCassaEuro)
  }
  if (noteClean) headerParts.push(`<div class="note"><strong>Note</strong> ${escapeHtml(noteClean)}</div>`)

  const headerHtml = headerParts.join("")

  return `<!DOCTYPE html><html lang="it"><head><meta charset="utf-8"><title>Ricevuta</title>
  <style>
    @page { margin: ${Math.min(marginMm, 4)}mm; ${pageSizeRule} }
    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    body {
      font-family: ${fontStack};
      margin: 0;
      padding: 2px;
      font-size: ${fontSize}px;
      line-height: ${lineHeight};
      color: #000;
      background: #fff;
      ${widthRule}
    }
    .banner {
      text-align: center;
      font-weight: 900;
      font-size: 1.15em;
      letter-spacing: 0.04em;
      border-bottom: 3px solid #000;
      padding-bottom: 4px;
      margin-bottom: 6px;
      color: #000;
    }
    .annullato {
      text-align: center;
      font-weight: 900;
      color: #000;
      border: 2px solid #000;
      padding: 6px;
      margin-bottom: 6px;
      font-size: 0.95em;
    }
    .when { font-size: 0.95em; font-weight: 700; color: #000; margin-bottom: 6px; }
    .testata { color: #000; }
    .testata > div { margin-bottom: 1px; color: #000; }
    .testata strong { font-weight: 900; }
    .meta-id { font-size: 0.85em; font-weight: 600; color: #000; }
    .meta-tipo { font-weight: 900; margin: 2px 0; }
    .note { margin-top: 4px; font-weight: 700; color: #000; }
    .sconto {
      margin-top: 8px;
      padding-top: 6px;
      border-top: 1px dashed #000;
      font-weight: 900;
      text-align: right;
      color: #000;
    }
    .righe { margin-top: 8px; border-top: 2px solid #000; padding-top: 6px; }
    .riga {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 8px;
      margin-bottom: 5px;
      padding-bottom: 4px;
      border-bottom: 1px solid #000;
      color: #000;
    }
    .riga-main { flex: 1; min-width: 0; }
    .qty { font-weight: 900; color: #000; }
    .titolo { font-weight: 900; color: #000; }
    .dettaglio {
      margin-top: 2px;
      font-size: 0.92em;
      font-weight: 700;
      color: #000;
      line-height: 1.3;
      white-space: pre-wrap;
    }
    .importo { font-weight: 900; flex-shrink: 0; color: #000; }
    .totale {
      margin-top: 10px;
      padding-top: 8px;
      border-top: 3px solid #000;
      font-size: 1.15em;
      font-weight: 900;
      text-align: right;
      color: #000;
    }
    .footer {
      margin-top: 10px;
      font-size: 0.85em;
      font-weight: 700;
      color: #000;
      text-align: center;
    }
    @media print {
      body { padding: 0; color: #000 !important; }
      .banner, .when, .qty, .titolo, .dettaglio, .importo, .totale, .footer, .testata, .testata * {
        color: #000 !important;
      }
    }
  </style></head><body>
    <div class="testata">${headerHtml}</div>
    <div class="righe">${righeHtml || "<p>Nessuna riga.</p>"}</div>
    ${
      scontoEuro != null && Number.isFinite(scontoEuro) && scontoEuro > 0
        ? `<div class="sconto"><strong>Sconto cassa</strong> − € ${scontoEuro.toFixed(2)}</div>`
        : ""
    }
    <div class="totale">Totale € ${Number(totale).toFixed(2)}</div>
    <div class="footer">Documento di cortesia — non fiscale</div>
  </body></html>`
}

export function printRicevuta(payload) {
  const html = buildRicevutaHtmlDocument(payload)
  return printHtmlDocument(html, {
    title: "Stampa ricevuta",
    alertPopupBlocked:
      "Impossibile stampare la ricevuta (popup bloccato). Consenti i popup per questo sito e riprova.",
  })
}
