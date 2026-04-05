/**
 * Pannello test reparti (iframe multipli): abilita superadmin sulle route operative
 * e tutte le aree in OperativeLayout. Attivo in sviluppo o se VITE_ENABLE_TEST_REPARTI=true.
 */
export const ENABLE_TEST_REPARTI =
  import.meta.env.DEV === true || import.meta.env.VITE_ENABLE_TEST_REPARTI === "true";

export const PERMESSI_TUTTE_AREE = {
  riepilogo: true,
  cassa: true,
  cucina: true,
  bancone: true,
  pizzaiolo: true,
  delivery: true,
  pony: true,
};
