import { ordineIndirizzoConsegna, ordineNomeCliente, ordineOrarioRitiro } from "@/features/operative/cassa/utils/ordineFieldHelpers"
import { formatIndirizzoDisplayItaliano } from "@/utils/formatIndirizzoItaliano"
import { splitNomeDaIndirizzoConsegna } from "@/features/operative/cassa/utils/cassaDeliveryNomeIndirizzo"

function ordineCreatedAt(o) {
  return o?.createdAt ?? o?.created_at ?? null
}

/** Se manca orario_ritiro in DB si usa HH:mm da createdAt. */
export function formatOrarioFallbackDaCreazione(o) {
  const raw = ordineCreatedAt(o)
  if (!raw) return ""
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return ""
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
}

export function orarioVisualizzatoLista(o) {
  const t = ordineOrarioRitiro(o)
  if (t) return t
  return formatOrarioFallbackDaCreazione(o)
}

/** Seconda riga sotto il titolo: solo tratto indirizzo (senza ripetere il nome se era nel campo unico). */
export function deliveryIndirizzoRiga(o) {
  const ind = ordineIndirizzoConsegna(o)
  if (!ind) return ""
  const sp = splitNomeDaIndirizzoConsegna(ind)
  const line = sp.addrPart || sp.full || ind
  return formatIndirizzoDisplayItaliano(line) || line
}

/** Confronto anagrafica ↔ ordine: stesso testo o stessa normalizzazione linea italiana. */
export function indirizzoConsegnaMatchAnagrafica(clienteInd, ordineInd) {
  const a = String(clienteInd || "").trim()
  const b = String(ordineInd || "").trim()
  if (!a || !b) return a === b
  if (a.toLowerCase() === b.toLowerCase()) return true
  const af = formatIndirizzoDisplayItaliano(a).trim().toLowerCase()
  const bf = formatIndirizzoDisplayItaliano(b).trim().toLowerCase()
  return Boolean(af && bf && af === bf)
}

/**
 * Dati titolo card lista ordini (puro, testabile).
 * @returns {{ nome: string, orario: string, titoloPrincipale: string, showOrarioADestra: boolean }}
 */
export function buildOrdineCardTitleModel(o, isDelivery) {
  const nomeDb = ordineNomeCliente(o)
  const indRaw = ordineIndirizzoConsegna(o)
  const split = isDelivery ? splitNomeDaIndirizzoConsegna(indRaw) : { nomePart: "" }
  const nome = isDelivery ? nomeDb || split.nomePart : nomeDb
  const orario = orarioVisualizzatoLista(o)
  if (isDelivery) {
    const titoloPrincipale = nome || orario || "—"
    return {
      nome: nome || "",
      orario,
      titoloPrincipale,
      showOrarioADestra: Boolean(orario && nome),
    }
  }
  return {
    nome: nome || "",
    orario,
    titoloPrincipale: nome || "—",
    showOrarioADestra: Boolean(orario),
  }
}
