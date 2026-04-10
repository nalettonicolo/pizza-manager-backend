import { resolveServiziIdsForTenant } from "@/app/hooks/useTenantServizi"

/**
 * Ordini dalla vetrina: `parametri_operativi.ordini_online_attivi`.
 * Default true; solo `false` esplicito disattiva.
 * @param {unknown} po
 */
export function readOrdiniOnlineAttivi(po) {
  if (!po || typeof po !== "object") return true
  const v = po.ordini_online_attivi
  if (v === false || v === "false" || v === 0) return false
  return true
}

/**
 * Servizio `ordini_online` incluso nel bundle effettivo del tenant (piano + servizi abilitati in Super Admin).
 * @param {unknown} tenantData — riga `tenants` o oggetto con `piano` e `parametri_operativi`
 */
export function tenantHasOrdiniOnlineServizioLicenza(tenantData) {
  if (!tenantData || typeof tenantData !== "object") return false
  return resolveServiziIdsForTenant(tenantData).has("ordini_online")
}

/**
 * Vetrina web: ordine cliente consentito solo se licenza include ordini online **e** il locale non li ha disattivati nei parametri.
 * @param {unknown} parametriOperativi
 * @param {unknown} tenantData
 */
export function readOrdiniOnlineVetrinaAllowed(parametriOperativi, tenantData) {
  if (!tenantHasOrdiniOnlineServizioLicenza(tenantData)) return false
  // Senza parametri esposti (es. RLS anon) non assumere ordini attivi: niente CTA hero / carrello vetrina.
  if (!parametriOperativi || typeof parametriOperativi !== "object") return false
  return readOrdiniOnlineAttivi(parametriOperativi)
}

/**
 * Archivio listini multipli (snapshot JSON + PDF): attivabile dal tenant in Parametri.
 * Un solo listino operativo (prodotti DB); gli archivi sono copie di sicurezza.
 * @param {unknown} po
 */
export function readGestioneListiniMultipli(po) {
  if (!po || typeof po !== "object") return false
  return po.abilita_gestione_listini_multipli === true
}

/** @deprecated Usa readGestioneListiniMultipli */
export function readListiniMultipli(po) {
  return readGestioneListiniMultipli(po)
}
