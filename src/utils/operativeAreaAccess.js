/**
 * Permessi aree operative: di default è visibile solo l’area del ruolo;
 * le altre compaiono nel menù solo se accesso_* = true in utenti_ruoli.
 *
 * Ruoli di reparto (cassa, cucina, …): una sola area operativa, indipendentemente dai DEFAULT true
 * su `accesso_*` in DB (altrimenti con un solo flag false restano tutte le altre aree attive).
 * Per più aree usare il ruolo operatore e le spunte in Admin → Dipendenti (scheda / Ruolo operativo).
 */

const RUOLO_OPERATIVO_ALIASES = {
  pizzaioli: "pizzaiolo",
};

/** Ruoli con un’unica area operativa (non si combinano con le colonne accesso_*). */
export const DEDICATED_REPARTO_ROLES = new Set(["cassa", "bancone", "cucina", "pizzaiolo", "delivery", "pony"]);

const ACCESSO_KEYS = [
  "accesso_riepilogo",
  "accesso_cassa",
  "accesso_cucina",
  "accesso_bancone",
  "accesso_pizzaiolo",
  "accesso_delivery",
  "accesso_pony",
]

/**
 * @param {string | null | undefined} ruolo
 * @param {string} areaKey — riepilogo | cassa | cucina | bancone | pizzaiolo | delivery | pony
 */
/** Normalizza il testo ruolo da DB (alias, case). */
export function normalizeRuoloOperativo(ruolo) {
  if (ruolo == null || String(ruolo).trim() === "") return null
  const t = String(ruolo).toLowerCase().trim()
  return RUOLO_OPERATIVO_ALIASES[t] ?? t
}

export function isDedicatedRepartoRole(ruolo) {
  const r = normalizeRuoloOperativo(ruolo)
  return r ? DEDICATED_REPARTO_ROLES.has(r) : false
}

export function isDefaultAreaForRole(ruolo, areaKey) {
  if (!ruolo || !areaKey) return false
  const r = normalizeRuoloOperativo(ruolo) ?? String(ruolo).toLowerCase().trim()
  const k = areaKey
  if (k === "delivery") return r === "delivery" || r === "pony"
  if (k === "pony") return r === "pony"
  const map = {
    operatore: "riepilogo",
    cassa: "cassa",
    bancone: "bancone",
    cucina: "cucina",
    pizzaiolo: "pizzaiolo",
    delivery: "delivery",
    pony: "pony",
  }
  return map[r] === k
}

/**
 * Righe create prima della logica “solo ruolo”: tutte le colonne a true → trattate come NULL.
 * @param {Record<string, unknown>} staffData
 */
export function normalizeLegacyAllAccessTrue(staffData) {
  if (!staffData || typeof staffData !== "object") return staffData
  const allTrue = ACCESSO_KEYS.every((k) => staffData[k] === true)
  if (!allTrue) return staffData
  const o = { ...staffData }
  for (const k of ACCESSO_KEYS) {
    o[k] = null
  }
  return o
}

/**
 * @param {Record<string, unknown>} staffData — riga utenti_ruoli
 * @param {string | null | undefined} ruolo
 * @returns {{ riepilogo: boolean, cassa: boolean, cucina: boolean, bancone: boolean, pizzaiolo: boolean, delivery: boolean, pony: boolean }}
 */
export function computePermessiAree(staffData, ruolo) {
  const keys = ["riepilogo", "cassa", "cucina", "bancone", "pizzaiolo", "delivery", "pony"]
  const r = normalizeRuoloOperativo(ruolo)

  if (r && DEDICATED_REPARTO_ROLES.has(r)) {
    const out = {}
    for (const key of keys) {
      out[key] = isDefaultAreaForRole(r, key)
    }
    return out
  }

  const out = {}
  for (const key of keys) {
    const col = key === "riepilogo" ? "accesso_riepilogo" : `accesso_${key}`
    const v = staffData[col]
    if (isDefaultAreaForRole(r ?? ruolo, key)) {
      out[key] = true
      continue
    }
    out[key] = v === true
  }
  return out
}
