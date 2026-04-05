/**
 * Testo riepilogo ingredienti per carrello / comanda / DB (ingredienti_cottura_summary).
 * Include sempre gli ingredienti di base della ricetta (anche in variante "normale"), non solo modifiche.
 * Formato compatto: raggruppa per fase di cottura invece di ripetere "in cottura" su ogni voce.
 */

/**
 * @param {Array<{ id: string, nome?: string }>} productIngredienti — dalla pizza (prodotto)
 * @param {Record<string, { variante?: string, cottura?: string }>} modifiche — stato modale / default cassa
 * @param {Array<{ id?: string, nome?: string, variante?: string, cottura?: string }>} extraIngredienti
 * @returns {string}
 */
export function buildComandaIngredientiSummary(productIngredienti, modifiche, extraIngredienti) {
  const inCotturaNomi = [];
  const fineCotturaNomi = [];
  const varianti = [];
  const senzaNomi = [];

  for (const ing of productIngredienti || []) {
    const m = modifiche?.[ing.id];
    if (!m) continue;
    const nome = (ing.nome ?? "").trim();
    if (!nome) continue;
    if (m.variante === "senza") {
      senzaNomi.push(nome);
      continue;
    }
    const fine = m.cottura === "fine_cottura";
    if (m.variante === "normale" || !m.variante) {
      if (fine) fineCotturaNomi.push(nome);
      else inCotturaNomi.push(nome);
    } else {
      varianti.push(`${m.variante}: ${nome}${fine ? " (fine cottura)" : ""}`);
    }
  }

  const extraIn = [];
  const extraFine = [];
  const extraVar = [];
  const extraSenza = [];

  for (const e of extraIngredienti || []) {
    const nome = (e.nome ?? "").trim();
    if (!nome) continue;
    if (e.variante === "senza") {
      extraSenza.push(nome);
      continue;
    }
    const fine = e.cottura === "fine_cottura";
    if (e.variante && e.variante !== "normale") {
      extraVar.push(`${nome} (${e.variante})${fine ? " · fine cottura" : ""}`);
    } else if (fine) {
      extraFine.push(nome);
    } else {
      extraIn.push(nome);
    }
  }

  const chunks = [];
  if (inCotturaNomi.length) chunks.push(`In cottura: ${inCotturaNomi.join(", ")}`);
  if (fineCotturaNomi.length) chunks.push(`A fine cottura: ${fineCotturaNomi.join(", ")}`);
  if (varianti.length) chunks.push(varianti.join(" · "));
  if (senzaNomi.length) chunks.push(`Senza: ${senzaNomi.join(", ")}`);

  const addParts = [];
  if (extraIn.length) addParts.push(`+ in cottura: ${extraIn.join(", ")}`);
  if (extraFine.length) addParts.push(`+ a fine cottura: ${extraFine.join(", ")}`);
  if (extraVar.length) addParts.push(`+ ${extraVar.join(" · ")}`);
  if (extraSenza.length) addParts.push(`Senza extra: ${extraSenza.join(", ")}`);
  if (addParts.length) chunks.push(addParts.join(" · "));

  return chunks.filter(Boolean).join(" · ");
}
