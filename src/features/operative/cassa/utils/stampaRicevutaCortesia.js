/**
 * Stampa ricevuta di cortesia (non fiscale) da dettaglio ordine o da id.
 */

import { getOrderDetail, getProdottiByIds } from "@/features/admin/services/adminService"
import { printRicevuta, ricevutaPayloadFromOrdineDetail } from "@/features/operative/cassa/utils/printRicevuta"

/**
 * Arricchisce il dettaglio con productNames se mancano.
 * @param {string} tenantId
 * @param {object} detail
 */
export async function ensureOrdineDetailProductNames(tenantId, detail) {
  if (!detail) return detail
  if (detail.productNames && typeof detail.productNames === "object") return detail
  if (!tenantId) return detail
  const prodIds = [...new Set((detail.righe || []).map((r) => r.prodottoId ?? r.prodotto_id).filter(Boolean))]
  if (!prodIds.length) return { ...detail, productNames: {} }
  const prodotti = await getProdottiByIds(tenantId, prodIds)
  const pn = (prodotti || []).reduce((acc, p) => ({ ...acc, [p.id]: p.nome || "—" }), {})
  return { ...detail, productNames: pn }
}

/**
 * @param {object} detail — getOrderDetail (+ productNames se possibile)
 * @param {object} tenantData
 * @returns {boolean}
 */
export function printRicevutaCortesiaFromDetail(detail, tenantData) {
  const payload = ricevutaPayloadFromOrdineDetail(detail, tenantData)
  if (!payload) return false
  printRicevuta(payload)
  return true
}

/**
 * Carica ordine e stampa ricevuta di cortesia.
 * @param {string} tenantId
 * @param {string} ordineId
 * @param {object} tenantData
 */
export async function printRicevutaCortesiaByOrdineId(tenantId, ordineId, tenantData) {
  if (!ordineId) return false
  const raw = await getOrderDetail(ordineId)
  const detail = await ensureOrdineDetailProductNames(tenantId, raw)
  return printRicevutaCortesiaFromDetail(detail, tenantData)
}
