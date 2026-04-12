/**
 * Ricevuta cliente (stampa browser / PDF) — indipendente dalla comanda cucina.
 */

import { printHtmlDocument } from "@/utils/printHtmlDocument"
import { formatIndirizzoDisplayItaliano } from "@/utils/formatIndirizzoItaliano"

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
    return { qty, titolo, prezzoUnit: prezzo, importo: prezzo * qty }
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
    return { qty, titolo, prezzoUnit: prezzo, importo: prezzo * qty }
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
  const fontKey = RICEVUTA_FONT_STACK[parametri.comanda_font_family] ? parametri.comanda_font_family : "system"
  const fontStack = RICEVUTA_FONT_STACK[fontKey]

  const when = createdAt ? new Date(createdAt).toLocaleString("it-IT") : new Date().toLocaleString("it-IT")
  const isDel = String(tipoOrdine || "").toLowerCase() === "delivery"
  const tipoLabel = isDel ? "Consegna" : "Ritiro in negozio"

  const righeHtml = righe
    .map(
      (r) => `<div class="riga">
      <div class="riga-main"><span class="qty">${escapeHtml(String(r.qty))}×</span> <span class="titolo">${escapeHtml(r.titolo)}</span></div>
      <div class="importo">€ ${Number(r.importo).toFixed(2)}</div>
    </div>`,
    )
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
  if (orderId) {
    headerParts.push(`<div class="muted">ID ${escapeHtml(String(orderId))}</div>`)
  }
  headerParts.push(`<div><strong>${escapeHtml(tipoLabel)}</strong></div>`)
  if (nomeCliente) headerParts.push(`<div>Cliente: ${escapeHtml(String(nomeCliente))}</div>`)
  if (orarioRitiro) headerParts.push(`<div>Orario: ${escapeHtml(String(orarioRitiro))}</div>`)
  if (indirizzoConsegna) {
    const raw = String(indirizzoConsegna)
    const indFmt = formatIndirizzoDisplayItaliano(raw) || raw
    headerParts.push(`<div>Indirizzo: ${escapeHtml(indFmt)}</div>`)
  }
  if (tipoPagamento) headerParts.push(`<div>Pagamento: ${escapeHtml(String(tipoPagamento))}</div>`)
  if (note) headerParts.push(`<div class="note">Note: ${escapeHtml(String(note))}</div>`)

  const headerHtml = headerParts.join("")

  return `<!DOCTYPE html><html lang="it"><head><meta charset="utf-8"><title>Ricevuta</title>
  <style>
    @page { margin: ${marginMm}mm; ${pageSizeRule} }
    body {
      font-family: ${fontStack};
      margin: 0;
      padding: 10px;
      font-size: ${fontSize}px;
      line-height: ${lineHeight};
      color: #111;
      ${widthRule}
    }
    .banner {
      text-align: center;
      font-weight: 800;
      font-size: 1.15em;
      letter-spacing: 0.08em;
      border-bottom: 2px solid #000;
      padding-bottom: 6px;
      margin-bottom: 8px;
    }
    .annullato {
      text-align: center;
      font-weight: 700;
      color: #b71c1c;
      border: 1px solid #b71c1c;
      padding: 6px;
      margin-bottom: 8px;
      font-size: 0.95em;
    }
    .when { font-size: 0.9em; color: #444; margin-bottom: 10px; }
    .muted { font-size: 0.85em; color: #666; }
    .note { margin-top: 6px; font-style: italic; }
    .righe { margin-top: 12px; border-top: 1px solid #ccc; padding-top: 8px; }
    .riga {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 8px;
      margin-bottom: 8px;
      padding-bottom: 6px;
      border-bottom: 1px dashed #bbb;
    }
    .riga-main { flex: 1; min-width: 0; }
    .qty { font-weight: 700; }
    .titolo { font-weight: 500; }
    .importo { font-weight: 600; flex-shrink: 0; }
    .totale {
      margin-top: 14px;
      padding-top: 10px;
      border-top: 2px solid #000;
      font-size: 1.1em;
      font-weight: 800;
      text-align: right;
    }
    .footer {
      margin-top: 16px;
      font-size: 0.82em;
      color: #555;
      text-align: center;
    }
    @media print { body { padding: 4px; } }
  </style></head><body>
    <div class="testata">${headerHtml}</div>
    <div class="righe">${righeHtml || "<p>Nessuna riga.</p>"}</div>
    <div class="totale">Totale € ${Number(totale).toFixed(2)}</div>
    <div class="footer">Documento di cortesia — non valido ai fini fiscali</div>
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
