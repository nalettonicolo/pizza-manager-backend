/** @typedef {'ip' | 'usb'} ComandaStampanteConnessione */

/**
 * @typedef {object} ComandaRepartoStampante
 * @property {string} id
 * @property {string} nome
 * @property {ComandaStampanteConnessione} tipo_connessione
 * @property {string} indirizzo_ip
 * @property {number} porta
 * @property {string} nome_dispositivo Nome stampante Windows/macOS (USB o già installata), es. POS-58
 */

const DEFAULT_PORT = 9100

export function isValidIPv4(s) {
  if (s == null || String(s).trim() === "") return false
  return /^(25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)){3}$/.test(
    String(s).trim(),
  )
}

/**
 * @param {unknown} raw
 * @returns {ComandaStampanteConnessione}
 */
export function normalizeTipoConnessione(raw, hasIpHint = false) {
  const t = String(raw ?? "")
    .trim()
    .toLowerCase()
  if (t === "usb" || t === "locale" || t === "local") return "usb"
  if (t === "ip" || t === "rete" || t === "network" || t === "lan") return "ip"
  // Legacy: se c’era solo IP, resta rete
  return hasIpHint ? "ip" : "ip"
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
    const nomeDispositivo = String(
      row.nome_dispositivo ?? row.device_name ?? row.stampante_locale ?? "",
    ).trim()
    const portaRaw = Number(row.porta)
    const porta =
      Number.isFinite(portaRaw) && portaRaw > 0 ? Math.min(65535, Math.floor(portaRaw)) : DEFAULT_PORT
    let id = String(row.id ?? "").trim()
    if (!id) id = `rep-${i}-${Math.random().toString(36).slice(2, 9)}`
    const tipo = normalizeTipoConnessione(row.tipo_connessione ?? row.connessione, Boolean(ip))
    if (!nome && !ip && !nomeDispositivo) return
    out.push({
      id,
      nome: nome || `Reparto ${out.length + 1}`,
      tipo_connessione: tipo,
      indirizzo_ip: tipo === "ip" ? ip : "",
      porta: tipo === "ip" ? porta : DEFAULT_PORT,
      nome_dispositivo: tipo === "usb" ? nomeDispositivo : "",
    })
  })
  return out
}

/**
 * Etichetta destinazione per comanda / dialogo stampa.
 * @param {ComandaRepartoStampante} r
 */
export function formatRepartoStampanteDest(r) {
  if (!r) return ""
  if (r.tipo_connessione === "usb") {
    const dev = String(r.nome_dispositivo || "").trim()
    return dev
      ? `Reparto: ${r.nome} — USB / stampante «${dev}»`
      : `Reparto: ${r.nome} — USB (scegli la stampante nel dialogo)`
  }
  const ip = String(r.indirizzo_ip || "").trim()
  return ip
    ? `Reparto: ${r.nome} — rete ${ip}:${r.porta || DEFAULT_PORT}`
    : `Reparto: ${r.nome} — rete`
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
      if (r.tipo_connessione === "usb") {
        return r.nome_dispositivo ? `${r.nome} (USB: ${r.nome_dispositivo})` : `${r.nome} (USB)`
      }
      if (r.indirizzo_ip) return `${r.nome} (${r.indirizzo_ip}:${r.porta})`
      return r.nome
    })
    .join(", ")
}

/**
 * Validazione prima del salvataggio.
 * @param {ComandaRepartoStampante[]} reparti
 * @returns {{ ok: true } | { ok: false, message: string }}
 */
export function validateRepartiStampantiForSave(reparti) {
  for (const r of reparti) {
    if (!String(r.nome || "").trim()) {
      return { ok: false, message: "Ogni riga deve avere un nome reparto." }
    }
    if (r.tipo_connessione === "usb") {
      if (!String(r.nome_dispositivo || "").trim()) {
        return {
          ok: false,
          message: `Per il reparto «${r.nome}» (USB) indica il nome della stampante di sistema (es. POS-58), come appare in Windows → Stampanti.`,
        }
      }
      continue
    }
    // IP / rete
    if (!r.indirizzo_ip) {
      return {
        ok: false,
        message: `Per il reparto «${r.nome}» (rete IP) indica un indirizzo IPv4 statico.`,
      }
    }
    if (!isValidIPv4(r.indirizzo_ip)) {
      return {
        ok: false,
        message: `Indirizzo IP non valido per il reparto «${r.nome}»: ${r.indirizzo_ip}`,
      }
    }
  }
  return { ok: true }
}
