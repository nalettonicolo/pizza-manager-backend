/**
 * Titolo scheda browser: sempre e solo "PizzaManager", per ogni pagina e ogni tenant, senza
 * eccezioni — richiesta esplicita dell'utente. Una versione precedente mostrava il nome del
 * tenant (per distinguere più pizzerie aperte in tab diverse), ma un tenant tecnico/residuo
 * chiamato letteralmente "PizzaManager.it" finiva in scheda al posto del brand, creando
 * confusione ("ancora il nome scheda deve essere pizzamanager"): tornati al titolo fisso.
 *
 * @param {string | null | undefined} [_tenantNome] - ignorato, mantenuto per compatibilità delle chiamate esistenti
 * @param {string} [_suffisso] - ignorato, mantenuto per compatibilità delle chiamate esistenti
 */
export function applyTenantDocumentTitle(_tenantNome, _suffisso) {
  document.title = "PizzaManager"
}
