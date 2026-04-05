/** @typedef {{ id: string, nome: string, indirizzo_ip: string, porta: number }} ComandaRepartoStampante */

const DEFAULT_PORT = 9100

export function isValidIPv4(s) {
  if (s == null || String(s).trim() === "") return false
  return /^(25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)){3}$/.test(String(s).trim())
}

/**
 * Normalizza elenco da `parametri_operativi.comanda_reparti_stampanti`.
 * @param {unknown} raw
 * @returns {ComandaRepartoStampante[]}
 */
export function normalizeComandaRepartiStampanti(raw) {
  if (!Array.isArray(raw)) return []
  const out = []
  raw.forEach((row, i) => {
    if (!row || typeof row !== "object") return
    const nome = String(row.nome ?? "").trim()
    const ip = String(row.indirizzo_ip ?? row.ip ?? "").trim()
    const portaRaw = Number(row.porta)
    const porta = Number.isFinite(portaRaw) && portaRaw > 0 ? Math.min(65535, Math.floor(portaRaw)) : DEFAULT_PORT
    let id = String(row.id ?? "").trim()
    if (!id) id = `rep-${i}-${Math.random().toString(36).slice(2, 9)}`
    if (!nome && !ip) return
    out.push({
      id,
      nome: nome || `Reparto ${out.length + 1}`,
      indirizzo_ip: ip,
      porta,
    })
  })
  return out
}

/**
 * Testo per riga «Dest. stampa» su comanda (tutti i reparti).
 * @param {Record<string, unknown>} parametri
 */
export function stampantiLabelDaReparti(parametri) {
  const reparti = normalizeComandaRepartiStampanti(parametri?.comanda_reparti_stampanti)
  if (!reparti.length) return null
  return reparti
    .map((r) => {
      if (r.indirizzo_ip) return `${r.nome} (${r.indirizzo_ip}:${r.porta})`
      return r.nome
    })
    .join(", ")
}

/**
 * Validazione prima del salvataggio: righe con IP compilato devono essere IPv4.
 * @param {ComandaRepartoStampante[]} reparti
 * @returns {{ ok: true } | { ok: false, message: string }}
 */
export function validateRepartiStampantiForSave(reparti) {
  for (const r of reparti) {
    if (r.indirizzo_ip && !isValidIPv4(r.indirizzo_ip)) {
      return {
        ok: false,
        message: `Indirizzo IP non valido per il reparto «${r.nome}»: ${r.indirizzo_ip}`,
      }
    }
  }
  return { ok: true }
}
