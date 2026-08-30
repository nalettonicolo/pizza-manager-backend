import { isTipoPagamentoPagaOnline } from "@/features/operative/cassa/utils/cassaPagamentiOptions"

export function classifyConsegnaPagamento(tipoPagamento) {
  const t = String(tipoPagamento || "").toLowerCase()
  if (
    isTipoPagamentoPagaOnline(t) ||
    t.includes("stripe") ||
    t.includes("sumup") ||
    t.includes("satispay") ||
    (t.includes("online") && !t.includes("da pagare"))
  ) {
    return "gia_pagato"
  }
  if (t.includes("contanti") || t.includes("cash")) return "contanti"
  if (t.includes("carta") || t.includes("pos") || t.includes("bancomat")) return "bancomat"
  if (t.includes("misto")) return "altro"
  return "altro"
}

export function euro(n) {
  const v = Number(n)
  const safe = Number.isFinite(v) ? v : 0
  return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(safe)
}

function emptyTotals() {
  return { contanti: 0, bancomat: 0, gia_pagato: 0, altro: 0, count: 0 }
}

function addTotale(bucket, ordine) {
  const key = classifyConsegnaPagamento(ordine.tipo_pagamento ?? ordine.tipoPagamento)
  const amount = Number(ordine.totale) || 0
  bucket[key] += amount
  bucket.count += 1
}

/**
 * Raggruppa le consegne odierne per il nome di sessione del pony (non per l'account).
 * @param {object[]} rows
 */
export function groupConsegneByPony(rows) {
  const map = new Map()
  for (const row of rows || []) {
    const id = row.rider_id ?? row.riderId ?? null
    const hasSessioneField = Object.prototype.hasOwnProperty.call(row, "nome_pony")
      || Object.prototype.hasOwnProperty.call(row, "nomePony")
    const sessione = String(row.nome_pony ?? row.nomePony ?? "").trim()
    const display = String(row.rider_nome ?? row.riderNome ?? "").trim()
    const nome = sessione || display
    const keyNome = hasSessioneField ? sessione : display
    const key = keyNome ? `n:${keyNome.toLowerCase()}` : id ? `id:${id}` : "__none__"
    if (!map.has(key)) {
      map.set(key, {
        riderId: id,
        nome,
        ordini: [],
        totals: emptyTotals(),
      })
    }
    const g = map.get(key)
    g.ordini.push(row)
    addTotale(g.totals, row)
  }

  const list = [...map.values()].sort((a, b) => {
    const aAssigned = Boolean(a.riderId || a.nome)
    const bAssigned = Boolean(b.riderId || b.nome)
    if (!aAssigned && bAssigned) return 1
    if (aAssigned && !bAssigned) return -1
    return String(a.nome || "").localeCompare(String(b.nome || ""), "it")
  })

  let ponyIndex = 0
  return list.map((g) => {
    const assigned = Boolean(g.riderId || g.nome)
    if (assigned) ponyIndex += 1
    const label = assigned ? g.nome || `Pony ${ponyIndex}` : "Non assegnato"
    return { ...g, label, ponyIndex: assigned ? ponyIndex : null }
  })
}
