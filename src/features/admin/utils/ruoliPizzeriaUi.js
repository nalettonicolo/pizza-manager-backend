import { labelFromEmailPrefix } from "@/utils/emailDisplayLabel"

export const AREE_NAV = [
  { key: "accesso_riepilogo", label: "Aree di lavoro" },
  { key: "accesso_cassa", label: "Cassa" },
  { key: "accesso_cucina", label: "Cucina" },
  { key: "accesso_bancone", label: "Bancone" },
  { key: "accesso_pizzaiolo", label: "Pizzaioli" },
  { key: "accesso_delivery", label: "Delivery" },
  { key: "accesso_pony", label: "Pony (stesso reparto Delivery)" },
]

export const ACCESS_TO_AREA_KEY = {
  accesso_riepilogo: "riepilogo",
  accesso_cassa: "cassa",
  accesso_cucina: "cucina",
  accesso_bancone: "bancone",
  accesso_pizzaiolo: "pizzaiolo",
  accesso_delivery: "delivery",
  accesso_pony: "pony",
}

export const RUOLO_BASE_OPTIONS = [
  { value: "admin", label: "Amministratore" },
  { value: "operatore", label: "Operatore (multi-reparto)" },
  { value: "cassa", label: "Cassa" },
  { value: "bancone", label: "Bancone" },
  { value: "cucina", label: "Cucina" },
  { value: "pizzaiolo", label: "Pizzaiolo" },
  { value: "delivery", label: "Delivery" },
  { value: "pony", label: "Pony" },
]

export const RUOLO_BASE_VALUES = new Set(RUOLO_BASE_OPTIONS.map((o) => o.value))

export function nomeInSedeOEmail(r) {
  const nv =
    r.nome_visualizzato != null && String(r.nome_visualizzato).trim() !== ""
      ? String(r.nome_visualizzato).trim()
      : ""
  if (nv) return nv
  return labelFromEmailPrefix(r.email) || r.email || "—"
}

export function getCosaPuoFare(ruolo, puoModificareParametri) {
  const list = []
  switch (ruolo) {
    case "admin":
      list.push("Accesso completo ad Admin (Impostazioni, Menù, Ordini)")
      list.push("Gestione ruoli e permessi della pizzeria")
      list.push("Configurazione parametri, orari, layout")
      break
    case "cassa":
      list.push("Area Cassa: creare ordini, clienti, gestire carrello")
      list.push("Riepilogo ordine e conferma")
      list.push("Solo area Cassa nel menu operativo; per più reparti usa il ruolo operatore.")
      if (puoModificareParametri) {
        list.push("Pagina Impostazioni cassa (parametri operativi)")
      } else {
        list.push("Non può modificare i parametri cassa (solo se abilitato sotto)")
      }
      break
    case "operatore":
      list.push("Di default solo «Aree di lavoro»; le altre aree si abilitano sotto «Aree consentite».")
      break
    case "bancone":
      list.push("Area Bancone")
      list.push("Solo area Bancone; per più reparti usa il ruolo operatore.")
      break
    case "cucina":
      list.push("Area Cucina")
      list.push("Solo area Cucina; per più reparti usa il ruolo operatore.")
      break
    case "pizzaiolo":
      list.push("Area Pizzaiolo (schermata dedicata)")
      list.push("Solo area Pizzaioli; per più reparti usa il ruolo operatore.")
      break
    case "delivery":
      list.push("Area Delivery")
      list.push("Solo area Delivery; per più reparti usa il ruolo operatore.")
      break
    case "pony":
      list.push("Area Pony (stesso flusso Delivery)")
      list.push("Solo area Delivery; per più reparti usa il ruolo operatore.")
      break
    default:
      list.push("Ruolo: " + (ruolo || "—"))
  }
  return list
}
