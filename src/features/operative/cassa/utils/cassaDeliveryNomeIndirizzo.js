/**
 * Split legacy "Nome – Via …" salvato in un unico campo indirizzo consegna.
 * Usato in Cassa per visualizzazione e modifica ordini delivery pre-fix nome_cliente.
 */
export function splitNomeDaIndirizzoConsegna(raw) {
  const t = String(raw || "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim()
  if (!t) return { nomePart: "", addrPart: "", full: "" }
  const m = t.match(/^(.+?)\s*[\u2013\u2014\u2212-]\s*(.+)$/)
  if (!m) return { nomePart: "", addrPart: "", full: t }
  const left = m[1].trim()
  const right = m[2].trim()
  if (!right) return { nomePart: "", addrPart: "", full: t }
  if (/^(Via|Viale|Piazza|Corso|Largo|Contr\.|Contrada)\b/i.test(left)) {
    return { nomePart: "", addrPart: "", full: t }
  }
  if (left.length > 52) return { nomePart: "", addrPart: "", full: t }
  return { nomePart: left, addrPart: right, full: t }
}
