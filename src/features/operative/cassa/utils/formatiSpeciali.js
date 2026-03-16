/**
 * Formati speciali: Pizza Famiglia, Mezzo metro, Metro.
 * Ordinabili solo in negozio. Parametri da admin/menu/formati (parametri_operativi).
 */

/**
 * Legge parametri formati speciali da parametri_operativi.
 * @param {object} parametri - tenantData.parametri_operativi
 * @returns {{ famigliaAttivo: boolean, mezzoMetroGustiMax: number, metroGustiMax: number, mezzoMetroPrezzo: number, metroPrezzo: number, famiglia: object }}
 */
export function getFormatiSpecialiParametri(parametri) {
  const p = parametri && typeof parametri === "object" ? parametri : {}
  return {
    famigliaAttivo: !!p.famiglia_attivo,
    mezzoMetroGustiMax: Math.max(0, parseInt(p.mezzo_metro_gusti_max, 10) || 0),
    metroGustiMax: Math.max(0, parseInt(p.metro_gusti_max, 10) || 0),
    mezzoMetroPrezzo: Math.max(0, Number(p.mezzo_metro_prezzo) || 0),
    metroPrezzo: Math.max(0, Number(p.metro_prezzo) || 0),
    famiglia: {
      tipo1Gusto: p.famiglia_1_gusto_tipo === "doppio" ? "doppio" : "fisso",
      importo1Gusto: Number(p.famiglia_1_gusto_importo) || 0,
      aggiunta2Gusti: Number(p.famiglia_2_gusti_aggiunta) || 0,
      aggiunta3Gusti: Number(p.famiglia_3_gusti_aggiunta) || 0,
      aggiunta4Gusti: Number(p.famiglia_4_gusti_aggiunta) || 0,
    },
  }
}

/**
 * Calcola il prezzo per Pizza Famiglia.
 * @param {object} famigliaParams - getFormatiSpecialiParametri(parametri).famiglia
 * @param {number} numGusti - 1, 2, 3 o 4
 * @param {number} prezzoBasePizza - per 1 gusto: prezzo della pizza; per 2+ gusti non usato per il primo termine (passare somma)
 * @param {number} [sommaPrezziPizze] - per 2 gusti: prezzo pizza 1 + prezzo pizza 2; per 3/4: somma dei prezzi delle pizze selezionate
 * @returns {number} prezzo totale
 */
export function calcPrezzoFamiglia(famigliaParams, numGusti, prezzoBasePizza, sommaPrezziPizze = 0) {
  if (!famigliaParams || numGusti < 1 || numGusti > 4) return 0
  const n = Math.max(1, Math.min(4, Math.floor(numGusti)))
  if (n === 1) {
    return famigliaParams.tipo1Gusto === "doppio"
      ? (Number(prezzoBasePizza) || 0) * 2
      : famigliaParams.importo1Gusto
  }
  if (n === 2) return (Number(sommaPrezziPizze) || 0) + (famigliaParams.aggiunta2Gusti || 0)
  if (n === 3) return (Number(sommaPrezziPizze) || 0) + (famigliaParams.aggiunta3Gusti || 0)
  if (n === 4) return (Number(sommaPrezziPizze) || 0) + (famigliaParams.aggiunta4Gusti || 0)
  return 0
}

/** Id virtuali per formati speciali (non presenti in DB). */
export const FORMATO_SPECIALE_ID = {
  FAMIGLIA: "__famiglia__",
  MEZZO_METRO: "__mezzo_metro__",
  METRO: "__metro__",
}

/**
 * Restituisce i formati speciali da mostrare in cassa (solo in negozio).
 * @param {object} parametri - parametri_operativi
 * @param {string} tipoOrdine - 'negozio' | 'delivery'
 * @returns {Array<{ id: string, nome: string, prezzo: number, _special: string }>}
 */
export function getFormatiSpecialiList(parametri, tipoOrdine) {
  if (tipoOrdine !== "negozio") return []
  const { famigliaAttivo, mezzoMetroGustiMax, metroGustiMax, mezzoMetroPrezzo, metroPrezzo } = getFormatiSpecialiParametri(parametri)
  const list = []
  if (famigliaAttivo) {
    list.push({
      id: FORMATO_SPECIALE_ID.FAMIGLIA,
      nome: "Famiglia",
      prezzo: 0,
      _special: "famiglia",
    })
  }
  if (mezzoMetroGustiMax > 0) {
    list.push({
      id: FORMATO_SPECIALE_ID.MEZZO_METRO,
      nome: "Mezzo metro",
      prezzo: mezzoMetroPrezzo,
      _special: "mezzo_metro",
      gustiMax: mezzoMetroGustiMax,
    })
  }
  if (metroGustiMax > 0) {
    list.push({
      id: FORMATO_SPECIALE_ID.METRO,
      nome: "Metro",
      prezzo: metroPrezzo,
      _special: "metro",
      gustiMax: metroGustiMax,
    })
  }
  return list
}
