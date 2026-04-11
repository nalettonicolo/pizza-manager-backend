import { orarioToSlotLabel, sortedSlotLabels } from "@/features/operative/pizzaiolo/utils/pizzaioloUtils"

function simpleHash(str) {
  let h = 0
  const s = String(str || "")
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) | 0
  return String(h)
}

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
 * Colore "pieno" per chip ingrediente: DB colore se valido, altrimenti da categoria.
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
 * @returns {Record<string, Array<{ pickKey: string, label: string, count: number, categoria?: string, colore?: string }>>}
 */
export function aggregateBanconeIngredientsBySlot(ordini, righePerOrdine, ingredientsByProduct, slotMinutes) {
  /** @type {Record<string, Map<string, { pickKey: string, label: string, count: number, categoria?: string, colore?: string }>>} */
  const bySlot = {}

  for (const ord of ordini || []) {
    const orario = ord.orario_ritiro ?? ord.orarioRitiro
    const slot = orarioToSlotLabel(orario, slotMinutes) ?? "Senza orario"
    if (!bySlot[slot]) bySlot[slot] = new Map()

    const righe = righePerOrdine[ord.id] || []
    for (const r of righe) {
      const pid = r.prodottoId ?? r.prodotto_id
      const q = Number(r.quantita) || 1
      const list = ingredientsByProduct[pid]
      const summary = (r.ingredientiCotturaSummary ?? r.ingredienti_cottura_summary ?? "").trim()

      if (Array.isArray(list) && list.length > 0) {
        for (const ing of list) {
          const id = ing.id
          if (!id) continue
          const pickKey = `ing:${slot}:${id}`
          const prev = bySlot[slot].get(pickKey)
          const label = ing.nome || "—"
          if (prev) prev.count += q
          else
            bySlot[slot].set(pickKey, {
              pickKey,
              label,
              count: q,
              categoria: ing.categoria,
              colore: ing.colore,
            })
        }
      } else if (summary) {
        const rid = r.id ?? r.riga_id ?? `${ord.id}-${pid}-${summary.slice(0, 12)}`
        const pickKey = `sum:${slot}:${ord.id}:${rid}:${simpleHash(summary)}`
        const prev = bySlot[slot].get(pickKey)
        if (prev) prev.count += q
        else
          bySlot[slot].set(pickKey, {
            pickKey,
            label: summary,
            count: q,
            categoria: "altro",
            colore: "",
          })
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
