import { apiClient, getNestJwt } from "@/app/api/client.js"
import { isNestAuthEnabled } from "@/lib/nestAuthMode.js"

/** Letture catalogo/ordini via Nest (JWT) quando attivo VITE_USE_NEST_AUTH. */
export function nestOperativeReadsEnabled() {
  return isNestAuthEnabled() && Boolean(getNestJwt())
}

/** Mutazioni cassa / ordini via Nest quando JWT Nest presente. */
export function nestOperativeWritesEnabled() {
  return nestOperativeReadsEnabled()
}

function decodeJwtPayload(token) {
  try {
    const part = token.split(".")[1]
    if (!part) return null
    const base64 = part.replace(/-/g, "+").replace(/_/g, "/")
    const padLen = (4 - (base64.length % 4)) % 4
    const padded = padLen ? base64 + "=".repeat(padLen) : base64
    const json = atob(padded)
    return JSON.parse(json)
  } catch {
    return null
  }
}

/** `tenantId` dal JWT Nest (solo per costruire query; autorità rimane sul backend). */
export function nestJwtTenantId() {
  const t = getNestJwt()
  if (!t) return null
  const p = decodeJwtPayload(t)
  return p?.tenantId ?? p?.tenant_id ?? null
}

function browserTodayIsoRange() {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const end = new Date(start)
  end.setDate(end.getDate() + 1)
  return { start: start.toISOString(), end: end.toISOString() }
}

/**
 * @param {string} tenantId
 * @param {{ stato?: string, limit?: number, fromDate?: string, toDate?: string, todayOnly?: boolean }} opts
 */
export async function nestOperativeOrdini(tenantId, opts = {}) {
  const params = new URLSearchParams()
  params.set("tenantId", tenantId)
  if (opts.todayOnly) {
    const { start, end } = browserTodayIsoRange()
    params.set("from", start)
    params.set("to", end)
  } else {
    if (opts.fromDate) params.set("from", opts.fromDate)
    if (opts.toDate) params.set("to", opts.toDate)
  }
  if (opts.limit != null) params.set("limit", String(opts.limit))
  if (opts.stato) params.set("stato", opts.stato)
  const { data } = await apiClient.get(`/api/operative/ordini?${params.toString()}`)
  return Array.isArray(data) ? data : []
}

export async function nestOperativeCategorie(tenantId) {
  const { data } = await apiClient.get(
    `/api/operative/categorie?tenantId=${encodeURIComponent(tenantId)}`
  )
  return Array.isArray(data) ? data : []
}

export async function nestOperativeIngredienti(tenantId) {
  const { data } = await apiClient.get(
    `/api/operative/ingredienti?tenantId=${encodeURIComponent(tenantId)}`
  )
  return Array.isArray(data) ? data : []
}

export async function nestOperativeProdotti(tenantId, categoryId) {
  const params = new URLSearchParams({ tenantId })
  if (categoryId) params.set("categoryId", categoryId)
  const { data } = await apiClient.get(`/api/operative/prodotti?${params.toString()}`)
  return Array.isArray(data) ? data : []
}

export async function nestOperativeConfigurazioneCosti(tenantId) {
  const { data } = await apiClient.get(
    `/api/operative/configurazione-costi?tenantId=${encodeURIComponent(tenantId)}`
  )
  return data ?? null
}

export async function nestOperativeProdottoIngBatch(tenantId, productIds) {
  const ids = [...new Set((productIds || []).filter(Boolean))]
  const { data } = await apiClient.post(
    `/api/operative/prodotto-ingredienti-batch?tenantId=${encodeURIComponent(tenantId)}`,
    { productIds: ids }
  )
  return data && typeof data === "object" ? data : {}
}

// --- Mutazioni (turni / ordini) Nest ---

function resolveTenantQuery(tenantId) {
  const tid = tenantId ?? nestJwtTenantId()
  if (!tid) throw new Error("Nest operativo: tenantId mancante (JWT)")
  return `tenantId=${encodeURIComponent(tid)}`
}

export async function nestOperativeTurniAperto(tenantId) {
  const q = resolveTenantQuery(tenantId)
  const { data } = await apiClient.get(`/api/operative/turni/aperto?${q}`)
  return data ?? null
}

export async function nestOperativeTurniApri(tenantId, puntoVenditaId) {
  const q = resolveTenantQuery(tenantId)
  const { data } = await apiClient.post(`/api/operative/turni/apri?${q}`, {
    puntoVenditaId,
  })
  return data
}

export async function nestOperativeTurniChiudi(tenantId, params) {
  const q = resolveTenantQuery(tenantId)
  const { data } = await apiClient.post(`/api/operative/turni/chiudi?${q}`, {
    fondoContatoEuro: Number(params?.fondoContatoEuro),
    incassoAttesoEuro:
      params?.incassoAttesoEuro != null && params.incassoAttesoEuro !== ""
        ? Number(params.incassoAttesoEuro)
        : null,
    note: params?.note != null ? String(params.note) : null,
  })
  return data
}

/**
 * @param {string} tenantId
 * @param {Record<string, unknown>} payload Come `adminService.createOrder` (camelCase)
 * @returns {Promise<string>}
 */
export async function nestOperativeCreateOrder(tenantId, payload) {
  const q = resolveTenantQuery(tenantId)
  const {
    totale,
    stato,
    items = [],
    note,
    tipoPagamento,
    tipoOrdine,
    nomeCliente,
    orarioRitiro,
    indirizzoConsegna,
    consegnaLng,
    consegnaLat,
    pagamentoDettaglio,
    puntoVenditaId,
    turnoOperatoriId,
    telefonoRitiro,
  } = payload
  const body = {
    totale: Number(totale),
    stato: stato && String(stato).trim() ? String(stato).trim() : undefined,
    items: (items || []).map((it) => {
      const fm = it.formatoNome ?? it.formato_nome
      const fmtStr = typeof fm === "string" && fm.trim() ? fm.trim() : null
      return {
        prodotto_id: it.prodotto_id ?? it.id,
        quantita: Math.max(1, Number(it.quantita ?? it.qty ?? 1) || 1),
        prezzo: Number(it.prezzo ?? 0),
        formato_nome: fmtStr,
        ingredienti_cottura_summary:
          String(it.ingredientiCotturaSummary ?? it.ingredienti_cottura_summary ?? "").trim() ||
          null,
      }
    }),
    note: note !== undefined ? String(note ?? "") || null : null,
    tipo_pagamento:
      typeof tipoPagamento === "string" && tipoPagamento.trim() ? tipoPagamento.trim() : null,
    tipo_ordine: typeof tipoOrdine === "string" && tipoOrdine.trim() ? tipoOrdine.trim() : null,
    nome_cliente:
      typeof nomeCliente === "string" && nomeCliente.trim() ? nomeCliente.trim() : null,
    orario_ritiro:
      typeof orarioRitiro === "string" && orarioRitiro.trim() ? orarioRitiro.trim() : null,
    indirizzo_consegna:
      typeof indirizzoConsegna === "string" && indirizzoConsegna.trim()
        ? indirizzoConsegna.trim()
        : null,
    consegna_lng:
      consegnaLng != null && Number.isFinite(Number(consegnaLng)) ? Number(consegnaLng) : null,
    consegna_lat:
      consegnaLat != null && Number.isFinite(Number(consegnaLat)) ? Number(consegnaLat) : null,
    pagamento_dettaglio:
      pagamentoDettaglio != null && typeof pagamentoDettaglio === "object" ? pagamentoDettaglio : null,
    punto_vendita_id:
      puntoVenditaId != null && String(puntoVenditaId).trim() ? String(puntoVenditaId).trim() : null,
    turno_operatori_id:
      turnoOperatoriId != null &&
      turnoOperatoriId !== "" &&
      Number.isFinite(Number(turnoOperatoriId))
        ? Number(turnoOperatoriId)
        : null,
    telefono_ritiro:
      typeof telefonoRitiro === "string" && telefonoRitiro.trim() ? telefonoRitiro.trim() : null,
  }

  const { data } = await apiClient.post(`/api/operative/ordini?${q}`, body)
  const id = data && typeof data === "object" ? data.id : data
  if (!id) throw new Error("Nest createOrder: risposta senza id")
  return String(id)
}

/** @param {string} tenantIdResolved opzionale (JWT fallback) */
export async function nestOperativeGetOrderDetail(ordineId, tenantIdResolved) {
  const q = resolveTenantQuery(tenantIdResolved)
  const { data } = await apiClient.get(
    `/api/operative/ordini/${encodeURIComponent(ordineId)}/dettaglio?${q}`
  )
  return data
}

export async function nestOperativeUpdateOrderStato(ordineId, stato, tenantIdResolved) {
  const q = resolveTenantQuery(tenantIdResolved)
  await apiClient.patch(`/api/operative/ordini/${encodeURIComponent(ordineId)}/stato?${q}`, {
    stato,
  })
}

export async function nestOperativeUpdateOrderTipoPagamento(ordineId, tipoPagamento, tenantIdResolved) {
  const q = resolveTenantQuery(tenantIdResolved)
  await apiClient.patch(
    `/api/operative/ordini/${encodeURIComponent(ordineId)}/tipo-pagamento?${q}`,
    { tipoPagamento }
  )
}

export async function nestOperativeUpdateOrder(ordineId, updates, tenantIdResolved) {
  const q = resolveTenantQuery(tenantIdResolved)
  await apiClient.patch(`/api/operative/ordini/${encodeURIComponent(ordineId)}?${q}`, updates)
}

export async function nestOperativeReplaceOrderItems(ordineId, totale, items, tenantIdResolved) {
  const q = resolveTenantQuery(tenantIdResolved)
  const payload = {
    totale: Number(totale),
    items: (items || []).map((it) => ({
      prodotto_id: it.prodotto_id ?? it.prodottoId ?? it.id,
      quantita: Math.max(1, Number(it.quantita ?? it.qty ?? 1) || 1),
      prezzo: Number(it.prezzo ?? 0),
      formato_nome: String(it.formato_nome ?? it.formatoNome ?? "").trim() || null,
      ingredienti_cottura_summary:
        String(it.ingredienti_cottura_summary ?? it.ingredientiCotturaSummary ?? "").trim() ||
        null,
    })),
  }
  await apiClient.put(
    `/api/operative/ordini/${encodeURIComponent(ordineId)}/righe?${q}`,
    payload
  )
}

export async function nestOperativeRuoliPizzeria(tenantId) {
  const q = resolveTenantQuery(tenantId)
  const { data } = await apiClient.get(`/api/operative/ruoli-pizzeria?${q}`)
  return Array.isArray(data) ? data : []
}

export async function nestOperativeRigheAggregateByOrdineIds(ordineIds, tenantIdResolved) {
  const q = resolveTenantQuery(tenantIdResolved)
  const ids = [...new Set((ordineIds || []).filter(Boolean).map(String))]
  if (!ids.length) return {}
  const { data } = await apiClient.post(`/api/operative/righe/aggregate?${q}`, {
    ordineIds: ids,
  })
  return data && typeof data === "object" ? data : {}
}
