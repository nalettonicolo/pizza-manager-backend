/**
 * Titolo scheda browser dinamico per nome tenant — prima index.html aveva un <title> statico
 * ("Pizzeria Manager") mai aggiornato da nessun layout: ogni pagina di ogni tenant mostrava lo
 * stesso nome, impossibile distinguere le schede con più pizzerie aperte in tab diverse.
 *
 * @param {string | null | undefined} tenantNome
 * @param {string} [suffisso] - es. "Admin", "Operativo" — area della piattaforma
 */
export function applyTenantDocumentTitle(tenantNome, suffisso) {
  const nome = (tenantNome || "").trim()
  if (!nome) {
    document.title = suffisso ? `PizzaManager · ${suffisso}` : "PizzaManager"
    return
  }
  document.title = suffisso ? `${nome} · ${suffisso}` : nome
}
