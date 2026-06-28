/**
 * Importa righe da localStorage nel DB solo se il DB è vuoto (migrazione one-shot per tenant).
 * Non cancella dati DB esistenti.
 *
 * @template T
 * @param {{
 *   localItems: T[] | undefined | null,
 *   dbItems: unknown[] | undefined | null,
 *   importItem: (item: T) => Promise<void>,
 *   onClearedLocal?: () => void,
 * }} opts
 * @returns {Promise<{ imported: number }>}
 */
export async function importLocalIfDbEmpty({ localItems, dbItems, importItem, onClearedLocal }) {
  const local = Array.isArray(localItems) ? localItems : [];
  const db = Array.isArray(dbItems) ? dbItems : [];
  if (local.length === 0 || db.length > 0) {
    return { imported: 0 };
  }
  for (const item of local) {
    await importItem(item);
  }
  onClearedLocal?.();
  return { imported: local.length };
}
