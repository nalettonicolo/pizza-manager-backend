/**
 * Stampa comanda cucina tramite finestra di dialogo del browser (stampa → PDF o stampante termica configurata in OS).
 */

function escapeHtml(s) {
  if (s == null || s === "") return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** @typedef {{ tag: "impasto"|"cottura"|"ingredienti", text: string }} ComandaDettaglioRiga */

/** Righe comanda dal carrello cassa (prima del clear). */
export function cartItemsToComandaRighe(cart) {
  if (!Array.isArray(cart)) return [];
  return cart.map((item) => {
    /** @type {ComandaDettaglioRiga[]} */
    const dettagli = [];
    if (item.impastoNome) dettagli.push({ tag: "impasto", text: `Impasto: ${item.impastoNome}` });
    if (item.cotturaNome) dettagli.push({ tag: "cottura", text: `Cottura: ${item.cotturaNome}` });
    if (item.ingredientiCotturaSummary)
      dettagli.push({ tag: "ingredienti", text: item.ingredientiCotturaSummary });
    const titolo = item.formatoNome ? `${item.nome || "—"} (${item.formatoNome})` : item.nome || "—";
    return { qty: item.qty || 1, titolo, dettagli };
  });
}

/**
 * Righe da ordine già salvato (serve `productNames` da getProdottiByIds).
 * @param {object} detail — getOrderDetail + productNames
 */
export function orderDetailToComandaRighe(detail) {
  const names = detail?.productNames || {};
  return (detail?.righe || []).map((r) => {
    const pid = r.prodottoId ?? r.prodotto_id;
    const nomeBase = names[pid] || "Prodotto";
    const formatoNome = r.formatoNome ?? r.formato_nome;
    const titolo = formatoNome ? `${nomeBase} (${formatoNome})` : nomeBase;
    const ing = r.ingredientiCotturaSummary ?? r.ingredienti_cottura_summary;
    return {
      qty: r.quantita || 1,
      titolo,
      dettagli: ing ? [{ tag: "ingredienti", text: ing }] : [],
    };
  });
}

function stampantiLabel(parametri) {
  const s = parametri?.comanda_stampanti;
  if (Array.isArray(s) && s.length) return s.join(", ");
  if (typeof s === "string" && s.trim()) return s.trim();
  return "";
}

function clampNum(v, fallback, min, max) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function paramFlagTrue(parametri, key, defaultTrue = true) {
  const x = parametri?.[key];
  if (x === false || x === "false") return false;
  if (x === true || x === "true") return true;
  return defaultTrue;
}

/** Normalizza dettagli legacy (stringhe) o strutturati per filtri stampa. */
function normalizeDettaglioEntry(d) {
  if (d && typeof d === "object" && d.text != null) {
    const tag = d.tag === "impasto" || d.tag === "cottura" ? d.tag : "ingredienti";
    return { tag, text: String(d.text) };
  }
  const s = String(d ?? "");
  if (s.startsWith("Impasto:")) return { tag: "impasto", text: s };
  if (s.startsWith("Cottura:")) return { tag: "cottura", text: s };
  return { tag: "ingredienti", text: s };
}

function filterDettagliForPrint(dettagli, parametri) {
  const showImp = paramFlagTrue(parametri, "comanda_mostra_riga_impasto", true);
  const showCot = paramFlagTrue(parametri, "comanda_mostra_riga_cottura", true);
  const showIng = paramFlagTrue(parametri, "comanda_mostra_riga_ingredienti", true);
  const allow = { impasto: showImp, cottura: showCot, ingredienti: showIng };
  return (dettagli || [])
    .map(normalizeDettaglioEntry)
    .filter((e) => e.text.trim() && allow[e.tag])
    .map((e) => e.text);
}

const COMANDA_FONT_STACK = {
  system: 'system-ui, "Segoe UI", Roboto, sans-serif',
  sans: 'Arial, Helvetica, "Helvetica Neue", sans-serif',
  mono: '"Courier New", Courier, "Liberation Mono", monospace',
  serif: 'Georgia, "Times New Roman", Times, serif',
};

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
 * @param {Array<{ qty: number, titolo: string, dettagli?: (string|ComandaDettaglioRiga)[] }>} payload.righe
 * @param {object} [payload.parametri] — comanda_copie, comanda_font_size, comanda_titolo_scale, comanda_qty_scale,
 *   comanda_dettaglio_scale, comanda_line_height, comanda_margin_mm, comanda_width_mm, comanda_font_family,
 *   comanda_mostra_id_ordine, comanda_mostra_pagamento, comanda_mostra_dest_stampanti, comanda_stampanti,
 *   comanda_mostra_locale, comanda_mostra_banner_comanda, comanda_mostra_data_ora_stampa, comanda_mostra_numero_ordine,
 *   comanda_mostra_tipo_servizio, comanda_mostra_cliente, comanda_mostra_orario, comanda_mostra_indirizzo,
 *   comanda_mostra_note_ordine, comanda_mostra_riga_impasto, comanda_mostra_riga_cottura, comanda_mostra_riga_ingredienti
 */
export function printComandaKitchen(payload) {
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
    parametri = {},
  } = payload;

  const fontSize = clampNum(parametri.comanda_font_size, 13, 8, 28);
  const titoloScale = clampNum(parametri.comanda_titolo_scale, 1.12, 0.85, 1.6);
  const qtyScale = clampNum(parametri.comanda_qty_scale, 1, 0.85, 1.5);
  const dettaglioScale = clampNum(parametri.comanda_dettaglio_scale, 0.95, 0.75, 1.15);
  const lineHeight = clampNum(parametri.comanda_line_height, 1.35, 1.05, 1.9);
  const marginMm = clampNum(parametri.comanda_margin_mm, 8, 2, 24);
  const widthMm = clampNum(parametri.comanda_width_mm, 0, 0, 120);
  const fontKey = COMANDA_FONT_STACK[parametri.comanda_font_family] ? parametri.comanda_font_family : "system";
  const fontStack = COMANDA_FONT_STACK[fontKey];
  const copie = Math.max(1, Math.min(5, Number(parametri.comanda_copie) || 1));
  const destStampa = stampantiLabel(parametri);
  const showId = paramFlagTrue(parametri, "comanda_mostra_id_ordine", true);
  const showPagamento = paramFlagTrue(parametri, "comanda_mostra_pagamento", true);
  const showDestStampa = paramFlagTrue(parametri, "comanda_mostra_dest_stampanti", true);
  const showLocale = paramFlagTrue(parametri, "comanda_mostra_locale", true);
  const showBanner = paramFlagTrue(parametri, "comanda_mostra_banner_comanda", true);
  const showWhen = paramFlagTrue(parametri, "comanda_mostra_data_ora_stampa", true);
  const showNumero = paramFlagTrue(parametri, "comanda_mostra_numero_ordine", true);
  const showTipoServizio = paramFlagTrue(parametri, "comanda_mostra_tipo_servizio", true);
  const showCliente = paramFlagTrue(parametri, "comanda_mostra_cliente", true);
  const showOrario = paramFlagTrue(parametri, "comanda_mostra_orario", true);
  const showIndirizzo = paramFlagTrue(parametri, "comanda_mostra_indirizzo", true);
  const showNote = paramFlagTrue(parametri, "comanda_mostra_note_ordine", true);

  const righeHtml = righe
    .map((r) => {
      const lines = filterDettagliForPrint(r.dettagli, parametri);
      const subs = lines.map((d) => `<div class="sub">${escapeHtml(d)}</div>`).join("");
      return `<div class="riga"><span class="qty">${escapeHtml(String(r.qty))}×</span><div class="body"><div class="titolo">${escapeHtml(r.titolo)}</div>${subs}</div></div>`;
    })
    .join("");

  const metaRows = [];
  if (showLocale) metaRows.push(`<div><strong>Locale</strong> ${escapeHtml(tenantNome)}</div>`);
  if (showNumero && numero != null && numero !== "")
    metaRows.push(`<div><strong>Ordine</strong> #${escapeHtml(String(numero))}</div>`);
  if (orderId && showId) metaRows.push(`<div class="muted">ID ${escapeHtml(String(orderId))}</div>`);
  const tipoLabel = (tipoOrdine || "").toLowerCase() === "delivery" ? "Consegna" : "Ritiro in negozio";
  if (showTipoServizio) metaRows.push(`<div><strong>${escapeHtml(tipoLabel)}</strong></div>`);
  if (nomeCliente && showCliente) metaRows.push(`<div>Cliente: ${escapeHtml(nomeCliente)}</div>`);
  if (orarioRitiro && showOrario) metaRows.push(`<div>Orario: ${escapeHtml(orarioRitiro)}</div>`);
  if (indirizzoConsegna && showIndirizzo) metaRows.push(`<div>Indirizzo: ${escapeHtml(indirizzoConsegna)}</div>`);
  if (tipoPagamento && showPagamento) metaRows.push(`<div>Pagamento: ${escapeHtml(tipoPagamento)}</div>`);
  if (note && showNote) metaRows.push(`<div class="note">Note: ${escapeHtml(note)}</div>`);
  if (destStampa && showDestStampa) metaRows.push(`<div class="dest">Dest. stampa: ${escapeHtml(destStampa)}</div>`);

  const header = metaRows.join("");
  const when = createdAt ? new Date(createdAt).toLocaleString("it-IT") : new Date().toLocaleString("it-IT");

  let pages = "";
  for (let c = 0; c < copie; c += 1) {
    pages += `<section class="comanda-page">
      ${showBanner ? `<div class="banner">COMANDA CUCINA</div>` : ""}
      ${showWhen ? `<div class="when">${escapeHtml(when)}</div>` : ""}
      <div class="meta">${header}</div>
      <div class="righe">${righeHtml || "<p>Nessuna riga.</p>"}</div>
      ${copie > 1 ? `<div class="copy">Copia ${c + 1} / ${copie}</div>` : ""}
    </section>`;
  }

  const widthRule =
    widthMm > 0
      ? `max-width: ${widthMm}mm; margin-left: auto; margin-right: auto; box-sizing: border-box;`
      : "";

  const html = `<!DOCTYPE html><html lang="it"><head><meta charset="utf-8"><title>Comanda</title>
  <style>
    @page { margin: ${marginMm}mm; size: auto; }
    body {
      font-family: ${fontStack};
      margin: 0;
      padding: 10px;
      font-size: ${fontSize}px;
      line-height: ${lineHeight};
      color: #111;
      ${widthRule}
    }
    .comanda-page { page-break-after: always; padding-bottom: 12px; }
    .comanda-page:last-of-type { page-break-after: auto; }
    .banner {
      text-align: center;
      font-weight: 800;
      font-size: ${titoloScale}em;
      letter-spacing: 0.06em;
      border-bottom: 2px solid #000;
      padding-bottom: 6px;
      margin-bottom: 8px;
      line-height: 1.2;
    }
    .when { font-size: 0.9em; color: #444; margin-bottom: 10px; }
    .meta { margin-bottom: 12px; }
    .meta div { margin-bottom: 2px; }
    .muted { font-size: 0.85em; color: #666; }
    .note { margin-top: 6px; font-style: italic; }
    .dest { margin-top: 6px; font-size: 0.92em; color: #333; }
    .riga {
      display: flex;
      gap: 10px;
      align-items: flex-start;
      margin-bottom: 10px;
      padding-bottom: 8px;
      border-bottom: 1px dashed #bbb;
    }
    .qty { font-weight: 800; font-size: ${qtyScale}em; min-width: 2em; flex-shrink: 0; line-height: 1.2; }
    .titolo { font-weight: 600; }
    .sub { font-size: ${dettaglioScale}em; color: #333; margin-top: 2px; padding-left: 4px; }
    .copy { margin-top: 16px; text-align: center; font-size: 0.85em; color: #666; }
    @media print { body { padding: 4px; } }
  </style></head><body>${pages}</body></html>`;

  const runPrintInWindow = (win) => {
    if (!win?.document) return false;
    try {
      win.document.open();
      win.document.write(html);
      win.document.close();
      setTimeout(() => {
        try {
          win.focus();
          win.print();
        } catch (e) {
          console.warn("[printComandaKitchen]", e);
        }
      }, 150);
      return true;
    } catch (e) {
      console.error(e);
      return false;
    }
  };

  /* Stampa via iframe: non dipende dai popup del browser (spesso bloccati dopo await / conferma ordine). */
  try {
    const iframe = document.createElement("iframe");
    iframe.setAttribute("title", "Stampa comanda");
    iframe.setAttribute("aria-hidden", "true");
    iframe.style.cssText =
      "position:fixed;width:0;height:0;border:0;left:0;top:0;opacity:0;pointer-events:none;visibility:hidden";
    document.body.appendChild(iframe);
    const iw = iframe.contentWindow;
    if (iw && runPrintInWindow(iw)) {
      setTimeout(() => {
        try {
          iframe.remove();
        } catch (_) {
          /* ignore */
        }
      }, 90_000);
      return true;
    }
    iframe.remove();
  } catch (_) {
    /* fallback sotto */
  }

  const w = window.open("", "_blank", "noopener,noreferrer");
  if (!w) {
    window.alert(
      "Impossibile stampare (popup bloccato e iframe non disponibile). Consenti i popup per questo sito e riprova «Stampa comanda».",
    );
    return false;
  }
  if (!runPrintInWindow(w)) {
    try {
      w.close();
    } catch (_) {
      /* ignore */
    }
    return false;
  }
  return true;
}

/** Costruisce il payload per stampa da dettaglio ordine (con productNames). */
export function comandaPayloadFromOrdineDetail(detail, tenantData) {
  if (!detail) return null;
  const righe = orderDetailToComandaRighe(detail);
  return {
    tenantNome: tenantData?.nome || "Locale",
    orderId: detail.id,
    numero: detail.numero ?? detail.numero_ordine,
    createdAt: detail.createdAt ?? detail.created_at,
    tipoOrdine: detail.tipo_ordine,
    nomeCliente: detail.nome_cliente,
    orarioRitiro: detail.orario_ritiro,
    indirizzoConsegna: detail.indirizzo_consegna,
    note: detail.note,
    tipoPagamento: detail.tipo_pagamento,
    righe,
    parametri: tenantData?.parametri_operativi || {},
  };
}
