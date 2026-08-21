/**
 * Testo riepilogo ingredienti per carrello / comanda / DB (ingredienti_cottura_summary).
 * Include ricetta base + modifiche. Le aggiunte/rimozioni vanno in testa (visibili su ricevuta).
 */

function labelVariante(variante) {
  const v = String(variante || "").trim().toLowerCase()
  if (v === "senza") return "Senza"
  if (v === "poco") return "Poco"
  if (v === "abbondante") return "Abbondante"
  return v ? v.charAt(0).toUpperCase() + v.slice(1) : ""
}

/**
 * Solo aggiunte / rimozioni / varianti (per carrello e ricevuta cliente).
 * @param {Array<{ id: string, nome?: string }>} productIngredienti
 * @param {Record<string, { variante?: string, cottura?: string }>} modifiche
 * @param {Array<{ id?: string, nome?: string, variante?: string, cottura?: string }>} extraIngredienti
 * @returns {string}
 */
export function buildModificheClienteSummary(productIngredienti, modifiche, extraIngredienti) {
  const rimozioni = []
  const varianti = []
  const aggiunte = []

  for (const ing of productIngredienti || []) {
    const m = modifiche?.[ing.id]
    if (!m) continue
    const nome = (ing.nome ?? "").trim()
    if (!nome) continue
    const variante = String(m.variante || "normale").toLowerCase()
    if (variante === "senza") {
      rimozioni.push(nome)
      continue
    }
    if (variante && variante !== "normale") {
      const lab = labelVariante(variante)
      varianti.push(`${lab} ${nome}`)
    }
  }

  for (const e of extraIngredienti || []) {
    const nome = (e.nome ?? "").trim()
    if (!nome) continue
    const variante = String(e.variante || "normale").toLowerCase()
    if (variante === "senza") {
      rimozioni.push(nome)
      continue
    }
    if (variante && variante !== "normale") {
      aggiunte.push(`+ ${labelVariante(variante)} ${nome}`)
    } else {
      aggiunte.push(`+ ${nome}`)
    }
  }

  const parts = []
  if (rimozioni.length) parts.push(`Senza: ${rimozioni.join(", ")}`)
  if (varianti.length) parts.push(varianti.join(" · "))
  if (aggiunte.length) {
    parts.push(`Aggiunta: ${aggiunte.map((a) => a.replace(/^\+\s*/, "")).join(", ")}`)
  }

  return parts.filter(Boolean).join(" · ")
}

/**
 * Estrae dal riepilogo cucina solo le parti di modifica (Senza / Aggiunta / varianti).
 * Utile su stampati da DB dove non c’è il campo cliente dedicato.
 * @param {string} summary
 * @returns {string}
 */
export function extractModificheFromIngredientiSummary(summary) {
  const full = String(summary || "").trim()
  if (!full) return ""
  const parts = full.split(" · ").map((p) => p.trim()).filter(Boolean)
  const modParts = parts.filter((p) => {
    if (/^(Senza:|Aggiunta:)/i.test(p)) return true
    if (/^(Abbondante|Poco)\s+/i.test(p)) return true
    // legacy comanda: "abbondante: Nome" / "poco: Nome"
    if (/^(abbondante|poco|senza)\s*:/i.test(p)) return true
    // legacy: "+ in cottura: …" / "+ a fine cottura: …" / "+ …"
    if (/^\+\s*/.test(p)) return true
    return false
  })
  return modParts.join(" · ")
}

/**
 * @param {Array<{ id: string, nome?: string }>} productIngredienti — dalla pizza (prodotto)
 * @param {Record<string, { variante?: string, cottura?: string }>} modifiche — stato modale / default cassa
 * @param {Array<{ id?: string, nome?: string, variante?: string, cottura?: string }>} extraIngredienti
 * @returns {string}
 */
export function buildComandaIngredientiSummary(productIngredienti, modifiche, extraIngredienti) {
  const inCotturaNomi = []
  const fineCotturaNomi = []
  const varianti = []
  const senzaNomi = []

  for (const ing of productIngredienti || []) {
    const m = modifiche?.[ing.id]
    if (!m) continue
    const nome = (ing.nome ?? "").trim()
    if (!nome) continue
    if (m.variante === "senza") {
      senzaNomi.push(nome)
      continue
    }
    const fine = m.cottura === "fine_cottura"
    if (m.variante === "normale" || !m.variante) {
      if (fine) fineCotturaNomi.push(nome)
      else inCotturaNomi.push(nome)
    } else {
      const lab = labelVariante(m.variante)
      varianti.push(`${lab} ${nome}${fine ? " (fine cottura)" : ""}`)
    }
  }

  const extraIn = []
  const extraFine = []
  const extraVar = []
  const extraSenza = []

  for (const e of extraIngredienti || []) {
    const nome = (e.nome ?? "").trim()
    if (!nome) continue
    if (e.variante === "senza") {
      extraSenza.push(nome)
      continue
    }
    const fine = e.cottura === "fine_cottura"
    if (e.variante && e.variante !== "normale") {
      extraVar.push(`${labelVariante(e.variante)} ${nome}${fine ? " · fine cottura" : ""}`)
    } else if (fine) {
      extraFine.push(nome)
    } else {
      extraIn.push(nome)
    }
  }

  // Modifiche in testa: ricevuta e carrello le vedono subito.
  const modChunks = []
  if (senzaNomi.length) modChunks.push(`Senza: ${senzaNomi.join(", ")}`)
  if (varianti.length) modChunks.push(varianti.join(" · "))
  if (extraSenza.length) modChunks.push(`Senza: ${extraSenza.join(", ")}`)
  const addParts = []
  if (extraIn.length) addParts.push(extraIn.join(", "))
  if (extraFine.length) addParts.push(`${extraFine.join(", ")} (fine cottura)`)
  if (extraVar.length) addParts.push(extraVar.join(" · "))
  if (addParts.length) modChunks.push(`Aggiunta: ${addParts.join(" · ")}`)

  const baseChunks = []
  if (inCotturaNomi.length) baseChunks.push(`In cottura: ${inCotturaNomi.join(", ")}`)
  if (fineCotturaNomi.length) baseChunks.push(`A fine cottura: ${fineCotturaNomi.join(", ")}`)

  return [...modChunks, ...baseChunks].filter(Boolean).join(" · ")
}
