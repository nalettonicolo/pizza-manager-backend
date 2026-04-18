import { orarioToSlotLabel, sortedSlotLabels } from "@/features/operative/pizzaiolo/utils/pizzaioloUtils"

/** Slot presenti negli ordini visibili, ordinati cronologicamente (include "Senza orario"). */
export function banconeSlotsFromOrders(ordini, slotMinutes) {
  const map = {}
  for (const o of ordini || []) {
    const orario = o.orario_ritiro ?? o.orarioRitiro
    const label = orarioToSlotLabel(orario, slotMinutes) ?? "Senza orario"
    map[label] = (map[label] || 0) + 1
  }
  return sortedSlotLabels(map)
}

/**
 * Colore "pieno" per chip ingrediente Bancone (dopo il tap): prima campo `colore` su DB (#rgb / rgb()),
 * altrimenti mappa `byCat` sotto (parole chiave nella «categoria» ingrediente da Admin → Ingredienti).
 * Per i task colorati in Cucina vedi `Cucina.jsx` → PREP_CATEGORIA_COLORI_DEFAULT / resolvePrepTaskColor.
 */
export function banconeIngredientPickedColor(ing) {
  const raw = (ing.colore || ing.colore_hex || "").trim()
  if (raw && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(raw)) return raw
  if (raw && /^rgb/i.test(raw)) return raw
  const cat = String(ing.categoria || "")
    .trim()
    .toLowerCase()
  const byCat = {
    formaggio: "#fff59d",
    mozzarella: "#fff59d",
    latticini: "#fff59d",
    carne: "#ffcdd2",
    salumi: "#ffab91",
    verdura: "#c8e6c9",
    verdure: "#c8e6c9",
    funghi: "#d7ccc8",
    pesce: "#90caf9",
    sugo: "#ffccbc",
    sughi: "#ffccbc",
    spezie: "#e1bee7",
    altro: "#e0e0e0",
  }
  for (const [k, v] of Object.entries(byCat)) {
    if (cat.includes(k)) return v
  }
  return "#e3f2fd"
}

/**
 * Ingredienti aggregati per fascia (conteggio righe × quantità).
 * Mostra solo ingredienti con flag prep_cucina, coerenti con la vista Cucina.
 * @returns {Record<string, Array<{ pickKey: string, label: string, count: number, categoria?: string, colore?: string }>>}
 */
export function aggregateBanconeIngredientsBySlot(ordini, righePerOrdine, ingredientsByProduct, slotMinutes) {
  /** @type {Record<string, Map<string, { pickKey: string, label: string, count: number, categoria?: string, colore?: string }>>} */
  const bySlot = {}

  for (const ord of ordini || []) {
    const orario = ord.orario_ritiro ?? ord.orarioRitiro
    const slot = orarioToSlotLabel(orario, slotMinutes) ?? "Senza orario"
    if (!bySlot[slot]) bySlot[slot] = new Map()

    const doneByRigaRaw =
      ord?.cucina_prep_stato && typeof ord.cucina_prep_stato === "object"
        ? ord.cucina_prep_stato.doneByRiga
        : ord?.cucinaPrepStato && typeof ord.cucinaPrepStato === "object"
          ? ord.cucinaPrepStato.doneByRiga
          : null
    const doneByRiga = doneByRigaRaw && typeof doneByRigaRaw === "object" ? doneByRigaRaw : {}

    const righe = righePerOrdine[ord.id] || []
    for (const r of righe) {
      const pid = r.prodottoId ?? r.prodotto_id
      const rigaId = r.id ?? r.riga_id
      const q = Number(r.quantita) || 1
      const list = ingredientsByProduct[pid]
      if (Array.isArray(list) && list.length > 0) {
        for (const ing of list) {
          if (ing.prepCucina !== true) continue
          const id = ing.id
          if (!id) continue
          const pickKey = `ing:${slot}:${id}`
          const prev = bySlot[slot].get(pickKey)
          const label = ing.nome || "—"
          const isFuoriCottura = ing.vaInCottura === false
          const doneForThisRiga = rigaId
            ? Array.isArray(doneByRiga[String(rigaId)]) &&
              doneByRiga[String(rigaId)].map(String).includes(String(id))
            : false
          if (prev) prev.count += q
          else
            bySlot[slot].set(pickKey, {
              pickKey,
              label,
              count: q,
              doneCount: 0,
              categoria: ing.categoria,
              colore: ing.colore,
              vaInCottura: ing.vaInCottura === true,
              nonCottura: isFuoriCottura,
            })
          if (doneForThisRiga) {
            const curr = bySlot[slot].get(pickKey)
            curr.doneCount = (curr?.doneCount || 0) + q
          }
        }
      }
    }
  }

  const out = {}
  for (const slot of Object.keys(bySlot)) {
    out[slot] = [...bySlot[slot].values()].sort((a, b) => a.label.localeCompare(b.label, "it"))
  }
  return out
}

/**
 * Bibite (per categoria slug bibite) aggregate per fascia.
 */
export function aggregateBanconeBibiteBySlot(ordini, righePerOrdine, productNames, bibiteProductIds, slotMinutes) {
  const set = bibiteProductIds instanceof Set ? bibiteProductIds : new Set(bibiteProductIds || [])
  /** @type {Record<string, Map<string, { pickKey: string, label: string, count: number }>>} */
  const bySlot = {}

  for (const ord of ordini || []) {
    const orario = ord.orario_ritiro ?? ord.orarioRitiro
    const slot = orarioToSlotLabel(orario, slotMinutes) ?? "Senza orario"
    if (!bySlot[slot]) bySlot[slot] = new Map()

    const righe = righePerOrdine[ord.id] || []
    for (const r of righe) {
      const pid = r.prodottoId ?? r.prodotto_id
      if (!pid || !set.has(pid)) continue
      const q = Number(r.quantita) || 1
      const pickKey = `bib:${slot}:${pid}`
      const nome = productNames[pid] || "—"
      const prev = bySlot[slot].get(pickKey)
      if (prev) prev.count += q
      else bySlot[slot].set(pickKey, { pickKey, label: nome, count: q })
    }
  }

  const out = {}
  for (const slot of Object.keys(bySlot)) {
    out[slot] = [...bySlot[slot].values()].sort((a, b) => a.label.localeCompare(b.label, "it"))
  }
  return out
}

/** Colore chip bibita (sempre uguale quando "preso"). */
export const BANCONE_BIBITE_PICKED_BG = "#b3e5fc"
