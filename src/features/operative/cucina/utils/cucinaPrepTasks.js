/**
 * Attività preparazione cucina: ingredienti con flag prep_cucina sulla ricetta prodotto,
 * stato completamento per riga ordine (indipendente tra ordini e tra righe).
 */

import { orarioToSlotLabel, orarioToMinutes } from "@/features/operative/pizzaiolo/utils/pizzaioloUtils"
import { PLANNING_GRID_SLOT_MINUTES } from "@/features/operative/cassa/utils/planningUtils"

export const CUCINA_SLOT_SENZA_ORARIO = "__senza_orario__"

export function normalizeCucinaPrepStato(raw) {
  const done = raw?.doneByRiga
  if (done && typeof done === "object" && !Array.isArray(done)) {
    const out = {}
    for (const [k, v] of Object.entries(done)) {
      if (Array.isArray(v)) out[String(k)] = [...v].map(String)
    }
    return { doneByRiga: out }
  }
  return { doneByRiga: {} }
}

export function isPrepDone(stato, rigaId, ingId) {
  const s = normalizeCucinaPrepStato(stato)
  const arr = s.doneByRiga[String(rigaId)] || []
  return arr.includes(String(ingId))
}

/** Aggiunge ingrediente alla lista "fatto" per quella riga (persistere su ordine). */
export function markIngredientPrepDone(stato, rigaId, ingredienteId) {
  const s = normalizeCucinaPrepStato(stato)
  const rid = String(rigaId)
  const iid = String(ingredienteId)
  const cur = new Set(s.doneByRiga[rid] || [])
  cur.add(iid)
  return { doneByRiga: { ...s.doneByRiga, [rid]: [...cur] } }
}

export function slotTabLabel(slot) {
  if (slot === CUCINA_SLOT_SENZA_ORARIO) return "Senza orario"
  return slot
}

export function sortedCucinaSlotTabs(tasksBySlot) {
  const keys = Object.keys(tasksBySlot || {})
  const sorted = keys.filter((k) => k !== CUCINA_SLOT_SENZA_ORARIO).sort((a, b) => {
    const [ha, ma] = a.split(":").map(Number)
    const [hb, mb] = b.split(":").map(Number)
    return (ha || 0) * 60 + (ma || 0) - (hb || 0) * 60 - (mb || 0)
  })
  if (keys.includes(CUCINA_SLOT_SENZA_ORARIO)) sorted.push(CUCINA_SLOT_SENZA_ORARIO)
  return sorted
}

/**
 * @param {object[]} orders — ordini IN_PREPARAZIONE (con cucina_prep_stato)
 * @param {object[]} righeList — righe da getRigheByOrdineIds
 * @param {Record<string,string>} productNames
 * @param {Record<string, Array<{ id?: string, nome: string, prepCucina?: boolean }>>} ingredientsByProduct
 */
export function buildCucinaPrepTasks(
  orders,
  righeList,
  productNames,
  ingredientsByProduct,
  slotMinutes = PLANNING_GRID_SLOT_MINUTES,
) {
  const righeByOrd = {}
  for (const r of righeList || []) {
    const oid = r.ordineId ?? r.ordine_id
    if (!oid) continue
    if (!righeByOrd[oid]) righeByOrd[oid] = []
    righeByOrd[oid].push(r)
  }

  const tasksBySlot = {}

  for (const ord of orders || []) {
    const orario = ord.orario_ritiro ?? ord.orarioRitiro
    const slot = orarioToSlotLabel(orario, slotMinutes) || CUCINA_SLOT_SENZA_ORARIO
    if (!tasksBySlot[slot]) tasksBySlot[slot] = []

    const prepStato = ord.cucina_prep_stato ?? ord.cucinaPrepStato
    const stato = normalizeCucinaPrepStato(prepStato)
    const righe = righeByOrd[ord.id] || []

    for (const riga of righe) {
      const rigaId = riga.id
      if (!rigaId) continue
      const pid = riga.prodottoId ?? riga.prodotto_id
      const ingList = ingredientsByProduct[pid] || []
      const prepIngs = ingList.filter((i) => i.prepCucina === true)
      if (!prepIngs.length) continue
      const qty = Math.max(1, Number(riga.quantita) || 1)
      const prodottoNome = productNames[pid] || "Prodotto"
      const formato = riga.formatoNome ?? riga.formato_nome

      for (const ing of prepIngs) {
        const ingId = ing.id
        if (!ingId) continue
        const done = (stato.doneByRiga[String(rigaId)] || []).includes(String(ingId))
        tasksBySlot[slot].push({
          ordineId: ord.id,
          ordineNumero: ord.numero,
          rigaId: String(rigaId),
          ingredienteId: String(ingId),
          ingredienteNome: ing.nome || "—",
          prodottoNome,
          formatoNome: formato,
          qty,
          done,
          nomeCliente: ord.nome_cliente ?? ord.nomeCliente ?? "",
        })
      }
    }
  }

  return tasksBySlot
}

/** Ordini IN_PREPARAZIONE raggruppati per fascia orario (stessa griglia slot della cassa). */
export function groupOrdersBySlot(orders, slotMinutes = PLANNING_GRID_SLOT_MINUTES) {
  const map = {}
  for (const o of orders || []) {
    const slot =
      orarioToSlotLabel(o.orario_ritiro ?? o.orarioRitiro, slotMinutes) || CUCINA_SLOT_SENZA_ORARIO
    if (!map[slot]) map[slot] = []
    map[slot].push(o)
  }
  for (const k of Object.keys(map)) {
    map[k].sort((a, b) => {
      const ma = orarioToMinutes(a.orario_ritiro ?? a.orarioRitiro) ?? 99999
      const mb = orarioToMinutes(b.orario_ritiro ?? b.orarioRitiro) ?? 99999
      if (ma !== mb) return ma - mb
      return (Number(a.numero) || 0) - (Number(b.numero) || 0)
    })
  }
  return map
}

/** Tab orari: unione slot con task prep e slot con ordini in forno. */
export function mergeCucinaSlotKeys(tasksBySlot, ordersBySlot) {
  const keys = new Set([
    ...Object.keys(tasksBySlot || {}),
    ...Object.keys(ordersBySlot || {}),
  ])
  const dummy = Object.fromEntries([...keys].map((k) => [k, []]))
  return sortedCucinaSlotTabs(dummy)
}
