/**
 * Normalizzazione campi ordine (vista PostgREST snake_case / camelCase).
 * Usato da Cassa e da moduli estratti (es. modifica ordine).
 */

export function ordineTipoOrdine(o) {
  return String(o?.tipo_ordine ?? o?.tipoOrdine ?? "").trim().toLowerCase()
}

export function ordineIsDelivery(o) {
  return ordineTipoOrdine(o) === "delivery"
}

export function ordineNomeCliente(o) {
  return String(o?.nome_cliente ?? o?.nomeCliente ?? o?.nome ?? "").trim()
}

export function ordineTelefonoRitiro(o) {
  return String(o?.telefono_ritiro ?? o?.telefonoRitiro ?? "").trim()
}

export function ordineIndirizzoConsegna(o) {
  return String(o?.indirizzo_consegna ?? o?.indirizzoConsegna ?? o?.indirizzo ?? "").trim()
}

export function ordineOrarioRitiro(o) {
  return String(o?.orario_ritiro ?? o?.orarioRitiro ?? "").trim()
}
