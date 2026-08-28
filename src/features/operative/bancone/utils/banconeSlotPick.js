import { orarioToSlotLabel, sortedSlotLabels } from "@/features/operative/pizzaiolo/utils/pizzaioloUtils"
import { extractPrepSignalNamesFromSummary } from "@/features/operative/cucina/utils/cucinaPrepTasks"
import { normalizeIngredienteCategoria } from "@/constants/ingredienteCategoria"

/** Locale: evita dipendenze circolari / binding HMR indefiniti su import named. */
function ingredientNeedsPrepMonitor(ing) {
  if (!ing) return false
  if (ing.prepCucina === true || ing.prep_cucina === true) return true
  const cat = normalizeIngredienteCategoria(ing.categoria)
  if (cat) return true
  if (ing.vaInCottura === false || ing.va_in_cottura === false) return true
  return false
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
 * Ingredienti aggregati per fascia (conteggio righe × quantità).
 * Mostra prep_cucina / categoria / fine cottura + aggiunte dal riepilogo riga (come Cucina).
 * @param {object[]} [opts.productPrepCucinaById] — Prodotto.prep_cucina
 * @param {Record<string, { categoria?: string, colore?: string }>} [opts.productPrepMetaById] — Prodotto.prep_categoria/prep_colore
 * @param {Record<string,string>} [opts.productNames]
 * @param {object[]} [opts.ingredientiGlobali] — catalogo completo ingredienti tenant (getIngredients),
 *   fallback per nome quando un "extra" aggiunto a una riga non fa parte della ricetta base di
 *   nessun prodotto già caricato (altrimenti perde categoria/colore e resta grigio "comune").
 * @returns {Record<string, Array<{ pickKey: string, label: string, count: number, categoria?: string, colore?: string, ordineIds: Set<string> }>>}
 *   `ordineIds` = id ordini che hanno contribuito a quella chip (evidenziazione al click in Bancone.jsx).
 */
export function aggregateBanconeIngredientsBySlot(
  ordini,
  righePerOrdine,
  ingredientsByProduct,
  slotMinutes,
  opts = {},
) {
  const productPrepCucinaById = opts.productPrepCucinaById || {}
  const productPrepMetaById = opts.productPrepMetaById || {}
  const productNames = opts.productNames || {}
  const ingredientiGlobali = opts.ingredientiGlobali || []
  /** @type {Record<string, Map<string, { pickKey: string, label: string, count: number, categoria?: string, colore?: string }>>} */
  const bySlot = {}

  const byNome = new Map()
  for (const list of Object.values(ingredientsByProduct || {})) {
    for (const ing of list || []) {
      const k = String(ing?.nome || "")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, " ")
      if (k && !byNome.has(k)) byNome.set(k, ing)
    }
  }
  for (const ing of ingredientiGlobali) {
    const k = String(ing?.nome || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ")
    if (k && !byNome.has(k)) byNome.set(k, ing)
  }

  for (const ord of ordini || []) {
    const orario = ord.orario_ritiro ?? ord.orarioRitiro
    const slot = orarioToSlotLabel(orario, slotMinutes) ?? "Senza orario"

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
      const seen = new Set()

      const addIng = (ing) => {
        if (!ing) return
        const id = ing.id
        if (!id || seen.has(String(id))) return
        seen.add(String(id))
        if (!bySlot[slot]) bySlot[slot] = new Map()
        const pickKey = `ing:${slot}:${id}`
        const prev = bySlot[slot].get(pickKey)
        const label = ing.nome || "—"
        const isFuoriCottura = ing.vaInCottura === false || ing.va_in_cottura === false
        const doneForThisRiga = rigaId
          ? Array.isArray(doneByRiga[String(rigaId)]) &&
            doneByRiga[String(rigaId)].map(String).includes(String(id))
          : false
        if (prev) {
          prev.count += q
          prev.ordineIds.add(ord.id)
        } else
          bySlot[slot].set(pickKey, {
            pickKey,
            label,
            count: q,
            doneCount: 0,
            categoria: ing.categoria,
            colore: ing.colore,
            vaInCottura: ing.vaInCottura === true,
            nonCottura: isFuoriCottura,
            ordineIds: new Set([ord.id]),
          })
        if (doneForThisRiga) {
          const curr = bySlot[slot].get(pickKey)
          curr.doneCount = (curr?.doneCount || 0) + q
        }
      }

      if (Array.isArray(list) && list.length > 0) {
        for (const ing of list) {
          if (!ingredientNeedsPrepMonitor(ing)) continue
          addIng(ing)
        }
      }

      const summary = r.ingredientiCotturaSummary ?? r.ingredienti_cottura_summary ?? ""
      const signals = extractPrepSignalNamesFromSummary(summary)
      // Aggiunta: solo se l'ingrediente ha davvero bisogno di attenzione (prep_cucina o
      // categoria) — un'aggiunta comune "in linea" (es. capperi/olive/salamino senza
      // categoria) il pizzaiolo la gestisce da sé in cottura, non è un task da preparare.
      for (const nome of signals.aggiunte) {
        const key = String(nome || "")
          .trim()
          .toLowerCase()
          .replace(/\s+/g, " ")
        const hit = byNome.get(key)
        // Non trovato nel catalogo (nome non riconosciuto): fallback prudente, segnala comunque
        // — meglio un falso positivo che perdere un ingrediente da preparare per un nome ignoto.
        const ing =
          hit ||
          { id: `signal:${key}`, nome: String(nome).trim(), categoria: "", colore: "", prepCucina: true, vaInCottura: true }
        if (!ingredientNeedsPrepMonitor(ing)) continue
        addIng(ing)
      }
      for (const nome of signals.fineCottura) {
        const key = String(nome || "")
          .trim()
          .toLowerCase()
          .replace(/\s+/g, " ")
        const hit = byNome.get(key)
        addIng(
          hit
            ? { ...hit, vaInCottura: false }
            : {
                id: `signal:${key}`,
                nome: String(nome).trim(),
                categoria: "",
                colore: "",
                vaInCottura: false,
              },
        )
      }

      if (pid && productPrepCucinaById[pid] === true) {
        const prepKey = `prodotto_prep:${pid}`
        const meta = productPrepMetaById[pid] || {}
        addIng({
          id: prepKey,
          nome: productNames[pid] || "Prodotto",
          categoria: meta.categoria || "",
          colore: meta.colore || "",
          vaInCottura: true,
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

    const righe = righePerOrdine[ord.id] || []
    for (const r of righe) {
      const pid = r.prodottoId ?? r.prodotto_id
      if (!pid || !set.has(pid)) continue
      if (!bySlot[slot]) bySlot[slot] = new Map()
      const q = Number(r.quantita) || 1
      const pickKey = `bib:${slot}:${pid}`
      const nome = productNames[pid] || "—"
      const prev = bySlot[slot].get(pickKey)
      if (prev) {
        prev.count += q
        prev.ordineIds.add(ord.id)
      } else bySlot[slot].set(pickKey, { pickKey, label: nome, count: q, ordineIds: new Set([ord.id]) })
    }
  }

  const out = {}
  for (const slot of Object.keys(bySlot)) {
    out[slot] = [...bySlot[slot].values()].sort((a, b) => a.label.localeCompare(b.label, "it"))
  }
  return out
}

/** Slot da mostrare in colonna prep: solo fasce con ingredienti, fritti o bibite da preparare. */
export function banconeSlotsWithPrepItems(ingredientsBySlot, bibiteBySlot) {
  const map = {}
  for (const slot of Object.keys(ingredientsBySlot || {})) {
    if ((ingredientsBySlot[slot] || []).length > 0) map[slot] = 1
  }
  for (const slot of Object.keys(bibiteBySlot || {})) {
    if ((bibiteBySlot[slot] || []).length > 0) map[slot] = 1
  }
  return sortedSlotLabels(map)
}

/** Colore chip bibita (sempre uguale quando "preso"). */
export const BANCONE_BIBITE_PICKED_BG = "#b3e5fc"
