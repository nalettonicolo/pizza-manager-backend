import { supabase } from "@/lib/supabaseClient"

/**
 * Gestione tavoli/sale (modulo SQL 49 — tabelle core.sale/core.tavoli/core.ordine_split, RPC
 * public.tavolo_*). Un "conto" è un core.ordini con tipo_ordine='tavolo' e tavolo_id valorizzato;
 * split conto supporta più quote parziali per pagamenti separati allo stesso tavolo.
 */

/**
 * Elenco tavoli del tenant (con sala, stato, e il conto attivo se presente).
 * @param {string} tenantId
 * @returns {Promise<object[]>}
 */
export async function getTavoli(tenantId) {
  if (!tenantId) return []
  const { data, error } = await supabase.rpc("tavoli_lista", { p_tenant_id: tenantId })
  if (error) throw error
  return data || []
}

/**
 * Apre un nuovo conto su un tavolo libero (opzionalmente con righe iniziali).
 * @param {string} tenantId
 * @param {string} tavoloId
 * @param {object} [opts]
 * @param {number} [opts.coperti]
 * @param {Array<{ prodotto_id: string, quantita: number, prezzo: number }>} [opts.items]
 * @param {string} [opts.puntoVenditaId]
 * @param {number} [opts.turnoOperatoriId]
 * @returns {Promise<string>} id del nuovo ordine (conto)
 */
export async function apriContoTavolo(tenantId, tavoloId, opts = {}) {
  if (!tenantId || !tavoloId) throw new Error("tenant o tavolo mancante.")
  const { data, error } = await supabase.rpc("tavolo_apri_conto", {
    p_tenant_id: tenantId,
    p_tavolo_id: tavoloId,
    p_coperti: opts.coperti ?? null,
    p_items: opts.items ?? [],
    p_punto_vendita_id: opts.puntoVenditaId ?? null,
    p_turno_operatori_id: opts.turnoOperatoriId ?? null,
  })
  if (error) throw error
  return data
}

/** Unisce un conto già aperto (di un altro tavolo) a un tavolo libero. */
export async function unisciTavolo(tenantId, tavoloId, ordineId) {
  if (!tenantId || !tavoloId || !ordineId) throw new Error("tenant, tavolo o ordine mancante.")
  const { error } = await supabase.rpc("tavolo_unisci", {
    p_tenant_id: tenantId,
    p_tavolo_id: tavoloId,
    p_ordine_id: ordineId,
  })
  if (error) throw error
}

/** Aggiunge un giro di ordinazione a un conto tavolo già aperto (righe extra, non sostituisce). */
export async function aggiungiGiroTavolo(ordineId, items) {
  if (!ordineId) throw new Error("ordine mancante.")
  const { error } = await supabase.rpc("tavolo_aggiungi_giro", {
    p_ordine_id: ordineId,
    p_items: items || [],
  })
  if (error) throw error
}

/**
 * Sostituisce le quote di split del conto (pagamenti parziali per persona/gruppo).
 * @param {string} ordineId
 * @param {Array<{ etichetta?: string, importo: number }>} split
 */
export async function splitContoTavolo(ordineId, split) {
  if (!ordineId) throw new Error("ordine mancante.")
  const { error } = await supabase.rpc("tavolo_split_conto", {
    p_ordine_id: ordineId,
    p_split: split || [],
  })
  if (error) throw error
}

/** Segna pagata una singola quota di split. */
export async function segnaPagataQuotaTavolo(splitId, metodoPagamento = null) {
  if (!splitId) throw new Error("quota split mancante.")
  const { error } = await supabase.rpc("tavolo_split_segna_pagato", {
    p_split_id: splitId,
    p_metodo_pagamento: metodoPagamento,
  })
  if (error) throw error
}

/** Chiude il conto (ordine → CONSEGNATO) e libera il tavolo (stato → "da_pulire"). */
export async function chiudiContoTavolo(ordineId) {
  if (!ordineId) throw new Error("ordine mancante.")
  const { error } = await supabase.rpc("tavolo_chiudi_conto", { p_ordine_id: ordineId })
  if (error) throw error
}
