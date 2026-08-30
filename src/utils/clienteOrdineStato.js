/** Etichette stato ordine per area cliente (allineate ad AdminOrdiniPage). */
export const CLIENTE_STATI_ORDINE = [
  { value: "IN_ATTESA", label: "In attesa" },
  { value: "IN_PREPARAZIONE", label: "In preparazione" },
  { value: "IN_COTTURA", label: "In cottura" },
  { value: "PRONTO", label: "Pronto" },
  { value: "CONSEGNATO", label: "Consegnato" },
  { value: "ANNULLATO", label: "Annullato" },
]

export function clienteStatoOrdineLabel(stato) {
  const key = String(stato ?? "").trim().toUpperCase()
  return CLIENTE_STATI_ORDINE.find((s) => s.value === key)?.label ?? (key || "—")
}

/**
 * Etichetta stato per il cliente considerando anche lo stato consegna: quando il rider prende in
 * carico (stato_consegna = IN_VIAGGIO) il cliente deve vedere "In consegna", anche se lo stato
 * ordine top-level resta PRONTO fino alla consegna effettiva.
 */
export function clienteStatoOrdineLabelFull(order) {
  const stato = String(order?.stato ?? "").trim().toUpperCase()
  if (stato === "CONSEGNATO" || stato === "ANNULLATO") return clienteStatoOrdineLabel(stato)
  const consegna = String(order?.stato_consegna ?? order?.statoConsegna ?? "").trim().toUpperCase()
  if (consegna === "IN_VIAGGIO") return "In consegna"
  if (consegna === "PRESSO_CLIENTE") return "In consegna"
  return clienteStatoOrdineLabel(stato)
}

export function clienteTipoOrdineLabel(tipo) {
  const t = String(tipo ?? "").trim().toLowerCase()
  if (t === "delivery") return "Consegna a domicilio"
  if (t === "negozio") return "Ritiro in negozio"
  return t || "—"
}

export function clientePagamentoLabel(tipo, onlinePayment) {
  const op = onlinePayment && typeof onlinePayment === "object" ? onlinePayment : null
  if (op?.provider === "stripe" || op?.payment_intent_id) return "Carta online (Stripe)"
  const t = String(tipo ?? "").trim().toLowerCase()
  if (t === "contanti") return "Contanti"
  if (t === "carta") return "Carta"
  if (t === "online") return "Online"
  return t || "—"
}
