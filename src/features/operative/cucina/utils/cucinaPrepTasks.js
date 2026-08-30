/**
 * Attività preparazione cucina: ingredienti con flag prep_cucina / categoria / fine cottura,
 * più aggiunte da riepilogo riga; stato completamento per riga ordine.
 */

import { orarioToSlotLabel, orarioToMinutes } from "@/features/operative/pizzaiolo/utils/pizzaioloUtils"
import { PLANNING_GRID_SLOT_MINUTES } from "@/features/operative/cassa/utils/planningUtils"
import { normalizeIngredienteCategoria } from "@/constants/ingredienteCategoria"

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

function normNome(s) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
}

/**
 * True se l’ingrediente deve comparire sui monitor Cucina/Bancone.
 * Flag Prep. cucina, oppure categoria (affettato/fritto/…), oppure a fine cottura.
 */
/** Categorie che non vanno in forno: restano a Cucina/Bancone, non al pizzaiolo. */
const PIZZAIOLO_NASCONDI_CATEGORIA = new Set(["bibita", "fritto", "dolce"])

/**
 * Sul monitor pizzaiolo: solo extra/ingredienti da mettere in cottura.
 * Esclude prodotti interi (bibite, fritti, dolci) e le stesse categorie.
 */
export function isPizzaioloCotturaPrepTask(task) {
  if (!task) return false
  if (task.kind === "prodotto") return false
  const cat = normalizeIngredienteCategoria(task.ingredienteCategoria || task.categoria)
  if (PIZZAIOLO_NASCONDI_CATEGORIA.has(cat)) return false
  return true
}

/** Filtra i task prep per fascia: solo ciò che serve in cottura al pizzaiolo. */
export function filterTasksBySlotForPizzaiolo(tasksBySlot) {
  const out = {}
  for (const [slot, tasks] of Object.entries(tasksBySlot || {})) {
    const kept = (tasks || []).filter(isPizzaioloCotturaPrepTask)
    if (kept.length) out[slot] = kept
  }
  return out
}

export function ingredientNeedsPrepMonitor(ing) {
  if (!ing) return false
  if (ing.prepCucina === true || ing.prep_cucina === true) return true
  const cat = normalizeIngredienteCategoria(ing.categoria)
  if (cat) return true
  if (ing.vaInCottura === false || ing.va_in_cottura === false) return true
  return false
}

/**
 * Estrae nomi da preparare dal riepilogo riga (aggiunte e fine cottura).
 * @param {string} summary
 * @returns {{ aggiunte: string[], fineCottura: string[] }}
 */
export function extractPrepSignalNamesFromSummary(summary) {
  const full = String(summary || "").trim()
  const aggiunte = []
  const fineCottura = []
  if (!full) return { aggiunte, fineCottura }

  const pushNames = (chunk, into) => {
    const raw = String(chunk || "")
      .replace(/^\+\s*/i, "")
      .replace(/\(.*?\)/g, "")
      .trim()
    if (!raw) return
    for (const part of raw.split(/,|·/)) {
      const n = part.replace(/^(in cottura|a fine cottura)\s*:?\s*/i, "").trim()
      if (n) into.push(n)
    }
  }

  for (const piece of full.split(" · ").map((p) => p.trim()).filter(Boolean)) {
    if (/^Senza:/i.test(piece)) continue
    if (/^Aggiunta:/i.test(piece)) {
      pushNames(piece.replace(/^Aggiunta:\s*/i, ""), aggiunte)
      continue
    }
    if (/^\+\s*a fine cottura:/i.test(piece)) {
      pushNames(piece.replace(/^\+\s*a fine cottura:\s*/i, ""), aggiunte)
      continue
    }
    if (/^\+\s*in cottura:/i.test(piece)) {
      pushNames(piece.replace(/^\+\s*in cottura:\s*/i, ""), aggiunte)
      continue
    }
    if (/^\+/i.test(piece)) {
      pushNames(piece, aggiunte)
      continue
    }
    if (/^A fine cottura:/i.test(piece)) {
      pushNames(piece.replace(/^A fine cottura:\s*/i, ""), fineCottura)
      continue
    }
  }
  return { aggiunte, fineCottura }
}

/**
 * @param {Record<string, object[]>} ingredientsByProduct
 * @param {object[]} [ingredientiGlobali] — catalogo completo ingredienti tenant (da getIngredients),
 *   usato solo come fallback per nome: un ingrediente "extra" (aggiunta non presente nella ricetta
 *   base di nessun prodotto già caricato) altrimenti perde categoria/colore e cade sul grigio
 *   "comune" anche se in anagrafica ha una categoria impostata.
 */
function indexIngredientsByNome(ingredientsByProduct, ingredientiGlobali) {
  /** @type {Map<string, { id?: string, nome?: string, categoria?: string, colore?: string, prepCucina?: boolean, vaInCottura?: boolean }>} */
  const map = new Map()
  for (const list of Object.values(ingredientsByProduct || {})) {
    for (const ing of list || []) {
      const k = normNome(ing?.nome)
      if (k && !map.has(k)) map.set(k, ing)
    }
  }
  for (const ing of ingredientiGlobali || []) {
    const k = normNome(ing?.nome)
    if (k && !map.has(k)) map.set(k, ing)
  }
  return map
}

function resolveOrSyntheticIng(byNome, nomeRaw) {
  const nome = String(nomeRaw || "").trim()
  if (!nome) return null
  const hit = byNome.get(normNome(nome))
  if (hit) return hit
  return {
    id: `signal:${normNome(nome)}`,
    nome,
    categoria: "",
    colore: "",
    prepCucina: true,
    vaInCottura: true,
  }
}

/**
 * @param {object[]} orders — ordini IN_PREPARAZIONE (con cucina_prep_stato)
 * @param {object[]} righeList — righe da getRigheByOrdineIds
 * @param {Record<string,string>} productNames
 * @param {Record<string, Array<{ id?: string, nome: string, prepCucina?: boolean }>>} ingredientsByProduct
 * @param {number} slotMinutes
 * @param {Record<string, boolean>} productPrepCucinaById — da Prodotto.prep_cucina (fritti, bibite, dolci, …)
 * @param {Record<string, { categoria?: string, colore?: string }>} [productPrepMetaById] — da
 *   Prodotto.prep_categoria/prep_colore, per colorare i task "prodotto intero" come gli ingredienti
 *   (stesso schema congelato/affettato/dolce/fritto/bibita/comune).
 * @param {object[]} [ingredientiGlobali] — catalogo completo ingredienti tenant (getIngredients),
 *   fallback per risolvere categoria/colore degli "extra" aggiunti a una riga che non fanno parte
 *   della ricetta base di nessun prodotto già caricato in ingredientsByProduct.
 */
export function buildCucinaPrepTasks(
  orders,
  righeList,
  productNames,
  ingredientsByProduct,
  slotMinutes = PLANNING_GRID_SLOT_MINUTES,
  productPrepCucinaById = {},
  productPrepMetaById = {},
  ingredientiGlobali = [],
) {
  const righeByOrd = {}
  for (const r of righeList || []) {
    const oid = r.ordineId ?? r.ordine_id
    if (!oid) continue
    if (!righeByOrd[oid]) righeByOrd[oid] = []
    righeByOrd[oid].push(r)
  }

  const byNome = indexIngredientsByNome(ingredientsByProduct, ingredientiGlobali)
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
      const qty = Math.max(1, Number(riga.quantita) || 1)
      const prodottoNome = productNames[pid] || "Prodotto"
      const formato = riga.formatoNome ?? riga.formato_nome
      const seenIds = new Set()

      const pushTask = (ing, kind = "ingrediente") => {
        const ingId = ing?.id
        if (!ingId || seenIds.has(String(ingId))) return
        seenIds.add(String(ingId))
        const done = (stato.doneByRiga[String(rigaId)] || []).includes(String(ingId))
        tasksBySlot[slot].push({
          kind,
          ordineId: ord.id,
          ordineNumero: ord.numero,
          rigaId: String(rigaId),
          ingredienteId: String(ingId),
          ingredienteNome: ing.nome || "—",
          ingredienteCategoria: ing.categoria || "",
          ingredienteColore: ing.colore || "",
          prodottoNome,
          formatoNome: formato,
          qty,
          done,
          nomeCliente: ord.nome_cliente ?? ord.nomeCliente ?? "",
        })
      }

      for (const ing of ingList) {
        if (!ingredientNeedsPrepMonitor(ing)) continue
        pushTask(ing, "ingrediente")
      }

      const summary = riga.ingredientiCotturaSummary ?? riga.ingredienti_cottura_summary ?? ""
      const signals = extractPrepSignalNamesFromSummary(summary)
      // Aggiunta (extra rispetto alla ricetta base): segnala solo se l'ingrediente ha davvero
      // bisogno di attenzione (prep_cucina o categoria impostati) — un'aggiunta comune "in linea"
      // (es. capperi/olive/salamino senza categoria) il pizzaiolo la gestisce da sé in cottura,
      // non deve comparire come task da preparare.
      for (const nome of signals.aggiunte) {
        const ing = resolveOrSyntheticIng(byNome, nome)
        if (!ing || !ingredientNeedsPrepMonitor(ing)) continue
        pushTask(ing, "extra")
      }
      // Fine cottura: per definizione va aggiunto dopo la cottura, quindi segnalato sempre
      // anche senza flag/categoria specifici (non può stare "in linea" col resto).
      for (const nome of signals.fineCottura) {
        const ing = resolveOrSyntheticIng(byNome, nome)
        if (!ing) continue
        pushTask(ing, "ingrediente")
      }

      const prepProdotto = productPrepCucinaById[pid] === true
      if (prepProdotto) {
        const prepKey = `prodotto_prep:${pid}`
        if (!seenIds.has(prepKey)) {
          seenIds.add(prepKey)
          const done = (stato.doneByRiga[String(rigaId)] || []).includes(prepKey)
          const meta = productPrepMetaById[pid] || {}
          tasksBySlot[slot].push({
            kind: "prodotto",
            ordineId: ord.id,
            ordineNumero: ord.numero,
            rigaId: String(rigaId),
            ingredienteId: prepKey,
            ingredienteNome: prodottoNome,
            ingredienteCategoria: meta.categoria || "",
            ingredienteColore: meta.colore || "",
            prodottoNome,
            formatoNome: formato,
            qty,
            done,
            nomeCliente: ord.nome_cliente ?? ord.nomeCliente ?? "",
          })
        }
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

/**
 * Aggrega i task prep per fascia + ingrediente (conteggio, senza associazione pizza).
 * @returns {Record<string, Array<{
 *   pickKey: string,
 *   ingredienteId: string,
 *   label: string,
 *   count: number,
 *   doneCount: number,
 *   pendingTasks: object[],
 *   categoria?: string,
 *   colore?: string,
 *   kind?: string,
 * }>>}
 */
export function aggregatePrepTasksBySlot(tasksBySlot) {
  /** @type {Record<string, Array<any>>} */
  const out = {}
  for (const [slot, tasks] of Object.entries(tasksBySlot || {})) {
    /** @type {Map<string, any>} */
    const map = new Map()
    for (const t of tasks || []) {
      const id = String(t.ingredienteId || "")
      if (!id) continue
      const pickKey = `prep:${slot}:${id}`
      const q = Math.max(1, Number(t.qty) || 1)
      const label =
        t.kind === "extra" ? `+ ${t.ingredienteNome || "—"}` : String(t.ingredienteNome || "—")
      const prev = map.get(pickKey)
      if (!prev) {
        map.set(pickKey, {
          pickKey,
          ingredienteId: id,
          label,
          count: q,
          doneCount: t.done ? q : 0,
          pendingTasks: t.done ? [] : [t],
          categoria: t.ingredienteCategoria || "",
          colore: t.ingredienteColore || "",
          kind: t.kind || "ingrediente",
        })
      } else {
        prev.count += q
        if (t.done) prev.doneCount += q
        else prev.pendingTasks.push(t)
      }
    }
    out[slot] = [...map.values()].sort((a, b) => a.label.localeCompare(b.label, "it"))
  }
  return out
}

/**
 * Marca come fatti tutti i pending di un aggregato (più ordini/righe).
 * @returns {{ nextByOrdineId: Record<string, object> }}
 */
export function markAggregatedPrepDone(orders, pendingTasks) {
  /** @type {Record<string, object>} */
  const nextByOrdineId = {}
  const byOrd = {}
  for (const t of pendingTasks || []) {
    if (!t?.ordineId || !t?.rigaId || !t?.ingredienteId) continue
    if (!byOrd[t.ordineId]) byOrd[t.ordineId] = []
    byOrd[t.ordineId].push(t)
  }
  for (const [oid, list] of Object.entries(byOrd)) {
    const ord = (orders || []).find((o) => o.id === oid)
    let stato = ord?.cucina_prep_stato ?? ord?.cucinaPrepStato
    for (const t of list) {
      stato = markIngredientPrepDone(stato, t.rigaId, t.ingredienteId)
    }
    nextByOrdineId[oid] = stato
  }
  return { nextByOrdineId }
}
