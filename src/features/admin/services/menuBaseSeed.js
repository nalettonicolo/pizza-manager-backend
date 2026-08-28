// Kit di partenza per un tenant nuovo: un piccolo menu "napoletana style" già funzionante
// (categorie, formati, cottura, impasto, allergeni, ingredienti, 4 pizze classiche con i loro
// ingredienti collegati) invece di far partire il locale da un menu completamente vuoto.
// Riusa le stesse funzioni di scrittura di adminService.js — nessuna tabella toccata direttamente,
// nessuna assunzione di schema che il resto dell'app non faccia già.
//
// Pensato per essere richiamato: (a) subito dopo la creazione di un tenant da Super Admin →
// Tenants, e (b) a mano da un pulsante in Admin → Menu → Categorie per un tenant già esistente
// ma ancora senza menu (es. i tenant creati prima di questa funzione).
import {
  getCategories,
  createCategory,
  createFormato,
  createCottura,
  createImpasto,
  createAllergene,
  createIngredient,
  setIngredienteAllergeni,
  createProduct,
  setProdottoIngredienti,
} from "@/features/admin/services/adminService"
import { ALLERGENI_STANDARD, suggerisciAllergeniDaNome } from "@/constants/allergeneSuggeritoDaNome"

const CATEGORIE = [
  { nome: "Pizze", slug: "pizze", ordine: 1 },
  { nome: "Bibite", slug: "bibite", ordine: 2 },
  { nome: "Dolci", slug: "dolci", ordine: 3 },
]

const FORMATI = [
  { nome: "Piccola", prezzo: 2.5, ordine: 1 },
  { nome: "Grande", prezzo: 3.5, ordine: 2 },
]

const COTTURE = [{ nome: "Forno a legna", ordine: 1 }]

const IMPASTI = [{ nome: "Classico", costo_base: 0.5, ordine: 1 }]

/** Icona per allergene standard (colonna NOT NULL) — stessi nomi di ALLERGENI_STANDARD. */
const ALLERGENE_ICONA = {
  Glutine: "🌾",
  Crostacei: "🦐",
  Uova: "🥚",
  Pesce: "🐟",
  Soia: "🌱",
  Latte: "🥛",
  "Frutta a guscio": "🌰",
  Sedano: "🥬",
  Senape: "🫙",
  Sesamo: "⚪",
  Solfiti: "🍷",
  Lupini: "🫘",
  Molluschi: "🦪",
}
const ALLERGENI = ALLERGENI_STANDARD.map((nome, i) => ({ nome, icona: ALLERGENE_ICONA[nome], ordine: i + 1 }))

/** key interna → { nome, costo }. Allergeni assegnati in automatico dal nome, vedi seedMenuBase. */
const INGREDIENTI = [
  { key: "pomodoro", nome: "Pomodoro", costo: 0.4 },
  { key: "mozzarella", nome: "Mozzarella", costo: 1.2 },
  { key: "basilico", nome: "Basilico", costo: 0.1 },
  { key: "olio_evo", nome: "Olio EVO", costo: 0.1 },
  { key: "origano", nome: "Origano", costo: 0.05 },
  { key: "aglio", nome: "Aglio", costo: 0.05 },
  { key: "prosciutto_cotto", nome: "Prosciutto cotto", costo: 1.5 },
  { key: "funghi", nome: "Funghi champignon", costo: 1.0 },
  { key: "salame_piccante", nome: "Salame piccante", costo: 1.3 },
]

/** key interna → { nome, prezzo, descrizione, ingredienti: [key ingrediente] } */
const PIZZE = [
  {
    nome: "Margherita",
    prezzo: 5.5,
    descrizione: "Pomodoro, mozzarella, basilico",
    ingredienti: ["pomodoro", "mozzarella", "basilico"],
  },
  {
    nome: "Marinara",
    prezzo: 5.0,
    descrizione: "Pomodoro, aglio, origano, olio EVO",
    ingredienti: ["pomodoro", "aglio", "origano", "olio_evo"],
  },
  {
    nome: "Diavola",
    prezzo: 7.0,
    descrizione: "Pomodoro, mozzarella, salame piccante",
    ingredienti: ["pomodoro", "mozzarella", "salame_piccante"],
  },
  {
    nome: "Prosciutto e funghi",
    prezzo: 7.5,
    descrizione: "Pomodoro, mozzarella, prosciutto cotto, funghi champignon",
    ingredienti: ["pomodoro", "mozzarella", "prosciutto_cotto", "funghi"],
  },
]

/** True se il tenant ha già almeno una categoria — segnale che il menu non è vuoto. */
export async function tenantHaGiaMenu(tenantId) {
  if (!tenantId) return false
  try {
    const categorie = await getCategories(tenantId)
    return Array.isArray(categorie) && categorie.length > 0
  } catch {
    // In dubbio meglio non bloccare il seed che non farlo per un errore di lettura transitorio.
    return false
  }
}

/**
 * Crea il kit di partenza per il tenant. Non è idempotente da sola (non controlla duplicati): il
 * chiamante decide se invocarla, tipicamente dopo aver verificato `tenantHaGiaMenu`.
 * @param {string} tenantId
 * @returns {Promise<{ categorie: number, formati: number, cotture: number, impasti: number, allergeni: number, ingredienti: number, pizze: number, errori: string[] }>}
 */
export async function seedMenuBase(tenantId) {
  if (!tenantId) throw new Error("tenantId mancante")
  const esito = { categorie: 0, formati: 0, cotture: 0, impasti: 0, allergeni: 0, ingredienti: 0, pizze: 0, errori: [] }

  const categoriaIdByNome = {}
  for (const c of CATEGORIE) {
    try {
      const row = await createCategory({ tenant_id: tenantId, nome: c.nome, slug: c.slug, ordine: c.ordine, attivo: true })
      categoriaIdByNome[c.nome] = row.id
      esito.categorie += 1
    } catch (e) {
      esito.errori.push(`Categoria "${c.nome}": ${e?.message || e}`)
    }
  }

  for (const f of FORMATI) {
    try {
      await createFormato({ tenant_id: tenantId, nome: f.nome, prezzo: f.prezzo, ordine: f.ordine, attivo: true })
      esito.formati += 1
    } catch (e) {
      esito.errori.push(`Formato "${f.nome}": ${e?.message || e}`)
    }
  }

  for (const c of COTTURE) {
    try {
      await createCottura({ tenant_id: tenantId, nome: c.nome, ordine: c.ordine, attivo: true })
      esito.cotture += 1
    } catch (e) {
      esito.errori.push(`Cottura "${c.nome}": ${e?.message || e}`)
    }
  }

  for (const i of IMPASTI) {
    try {
      await createImpasto({ tenant_id: tenantId, nome: i.nome, costo_base: i.costo_base, ordine: i.ordine, attivo: true })
      esito.impasti += 1
    } catch (e) {
      esito.errori.push(`Impasto "${i.nome}": ${e?.message || e}`)
    }
  }

  const allergeneIdByNome = {}
  for (const a of ALLERGENI) {
    try {
      const row = await createAllergene({ tenant_id: tenantId, nome: a.nome, icona: a.icona, ordine: a.ordine, attivo: true })
      allergeneIdByNome[a.nome] = row.id
      esito.allergeni += 1
    } catch (e) {
      esito.errori.push(`Allergene "${a.nome}": ${e?.message || e}`)
    }
  }

  const ingredienteIdByKey = {}
  for (const ing of INGREDIENTI) {
    try {
      const row = await createIngredient({ tenantId, nome: ing.nome, costoUnitario: ing.costo, attivo: true })
      ingredienteIdByKey[ing.key] = row.id
      esito.ingredienti += 1
      const allergeniSuggeriti = suggerisciAllergeniDaNome(ing.nome)
      if (allergeniSuggeriti.length) {
        const allergeneIds = allergeniSuggeriti.map((n) => allergeneIdByNome[n]).filter(Boolean)
        if (allergeneIds.length) {
          try {
            await setIngredienteAllergeni(tenantId, row.id, allergeneIds)
          } catch {
            /* collegamento allergene non riuscito: l'ingrediente resta comunque creato */
          }
        }
      }
    } catch (e) {
      esito.errori.push(`Ingrediente "${ing.nome}": ${e?.message || e}`)
    }
  }

  const categoriaPizzeId = categoriaIdByNome["Pizze"]
  for (const p of PIZZE) {
    try {
      const prodotto = await createProduct({
        tenant_id: tenantId,
        categoria_id: categoriaPizzeId,
        nome: p.nome,
        descrizione: p.descrizione,
        prezzo: p.prezzo,
        attivo: true,
        visibile_online: true,
      })
      const ingredienteIds = p.ingredienti.map((k) => ingredienteIdByKey[k]).filter(Boolean)
      if (ingredienteIds.length) {
        await setProdottoIngredienti(
          tenantId,
          prodotto.id,
          ingredienteIds.map((ingrediente_id, idx) => ({ ingrediente_id, ordine: idx })),
        )
      }
      esito.pizze += 1
    } catch (e) {
      esito.errori.push(`Pizza "${p.nome}": ${e?.message || e}`)
    }
  }

  return esito
}
