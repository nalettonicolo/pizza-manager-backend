/**
 * Flush coda offline verso Supabase RPC (retry con backoff leggero).
 */

import { supabase } from "@/lib/supabaseClient"
import {
  enqueuePendingAction,
  listPendingActions,
  removePendingAction,
  updatePendingAction,
} from "./offlineDb"

const MAX_ATTEMPTS = 5
const BASE_DELAY_MS = 2000

/** @param {object} params checkout payload (tenant_id, totale, items, …) */
export async function queueOfflineCheckout(params) {
  const idempotencyKey =
    params.idempotency_key ||
    params.idempotencyKey ||
    `offline:${params.tenant_id}:${Date.now()}:${Math.random().toString(36).slice(2, 9)}`
  return enqueuePendingAction({
    tenant_id: params.tenant_id,
    type: "create_order_with_items",
    idempotency_key: idempotencyKey,
    payload: { ...params, idempotency_key: idempotencyKey },
  })
}

async function flushOne(action) {
  if (action.type !== "create_order_with_items") {
    await removePendingAction(action.id)
    return { ok: true, skipped: true }
  }
  const p = action.payload || {}
  const { data, error } = await supabase.rpc("create_order_with_items", {
    p_tenant_id: p.tenant_id,
    p_totale: Number(p.totale),
    p_stato: p.stato ?? "IN_PREPARAZIONE",
    p_items: (p.items || []).map((it) => ({
      prodotto_id: it.prodotto_id ?? it.id,
      quantita: it.quantita ?? it.qty ?? 1,
      prezzo: Number(it.prezzo ?? 0),
      formato_nome: it.formatoNome ?? it.formato_nome ?? null,
      ingredienti_cottura_summary: it.ingredientiCotturaSummary ?? null,
    })),
    p_note: p.note ?? "",
    p_tipo_pagamento: p.tipo_pagamento ?? p.tipoPagamento ?? "",
    p_tipo_ordine: p.tipo_ordine ?? p.tipoOrdine ?? "",
    p_nome_cliente: p.nome_cliente ?? p.nomeCliente ?? "",
    p_orario_ritiro: p.orario_ritiro ?? p.orarioRitiro ?? "",
    p_indirizzo_consegna: p.indirizzo_consegna ?? p.indirizzoConsegna ?? "",
    p_consegna_lng: p.consegna_lng ?? p.consegnaLng ?? null,
    p_consegna_lat: p.consegna_lat ?? p.consegnaLat ?? null,
    p_pagamento_dettaglio: p.pagamento_dettaglio ?? p.pagamentoDettaglio ?? null,
    p_punto_vendita_id: p.punto_vendita_id ?? p.puntoVenditaId ?? null,
    p_turno_operatori_id: p.turno_operatori_id ?? p.turnoOperatoriId ?? null,
    p_telefono_ritiro: p.telefono_ritiro ?? p.telefonoRitiro ?? null,
    p_idempotency_key: p.idempotency_key ?? p.idempotencyKey ?? action.idempotency_key ?? null,
  })
  if (error) throw error
  await removePendingAction(action.id)
  return { ok: true, ordineId: data }
}

/**
 * @param {string} tenantId
 * @returns {Promise<{ flushed: number, errors: string[] }>}
 */
export async function flushOfflineQueue(tenantId) {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return { flushed: 0, errors: ["offline"] }
  }
  const pending = await listPendingActions(tenantId)
  let flushed = 0
  const errors = []
  for (const action of pending.sort((a, b) => a.created_at.localeCompare(b.created_at))) {
    try {
      await flushOne(action)
      flushed += 1
    } catch (e) {
      const attempts = (action.attempts || 0) + 1
      const msg = e?.message || String(e)
      await updatePendingAction(action.id, { attempts, last_error: msg })
      errors.push(msg)
      if (attempts >= MAX_ATTEMPTS) {
        /* lascia in coda per review manuale */
      }
    }
  }
  return { flushed, errors }
}

export function scheduleOfflineFlush(tenantId, onResult) {
  if (!tenantId) return () => {}
  const run = () => {
    void flushOfflineQueue(tenantId).then(onResult).catch(() => {})
  }
  run()
  window.addEventListener("online", run)
  return () => window.removeEventListener("online", run)
}

export function offlineRetryDelayMs(attempts) {
  return Math.min(BASE_DELAY_MS * 2 ** (attempts || 0), 60000)
}
