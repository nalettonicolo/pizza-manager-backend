/**
 * Etichetta del tasto Bancone: il banconista chiude il ritiro in negozio
 * ("Consegnato") e manda fuori il domicilio ("In consegna").
 */

function ordineTipo(o) {
  return String(o?.tipo_ordine ?? o?.tipoOrdine ?? "").trim().toLowerCase()
}

export function isBanconeDeliveryOrder(o) {
  const t = ordineTipo(o)
  if (t === "delivery" || t === "consegna") return true
  if (t === "negozio" || t === "ritiro" || t === "tavolo") return false
  return Boolean(String(o?.indirizzo_consegna ?? o?.indirizzoConsegna ?? "").trim())
}

export function banconeHandoffLabel(ordine, ritardoMinuti = 0) {
  if (Number(ritardoMinuti) > 0) return `${Number(ritardoMinuti)} min in attesa`
  return isBanconeDeliveryOrder(ordine) ? "In consegna" : "Consegnato"
}

export function banconeHandoffTitle(ordine, ritardoMinuti = 0) {
  if (Number(ritardoMinuti) > 0) return `${Number(ritardoMinuti)} min in attesa`
  return isBanconeDeliveryOrder(ordine)
    ? "Segna come in consegna"
    : "Segna come consegnato"
}
