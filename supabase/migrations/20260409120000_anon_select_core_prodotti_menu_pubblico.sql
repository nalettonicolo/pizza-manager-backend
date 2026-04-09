-- Menu pubblico: la vista public.prodotti_menu_pubblico legge core.prodotti.
-- Con RLS solo "isolate_by_tenant", il ruolo anon non passa → 403 su REST.
-- Policy di sola lettura sui soli prodotti pubblicabili (allineata al WHERE della vista).

DROP POLICY IF EXISTS anon_select_prodotti_menu_pubblico ON core.prodotti;

CREATE POLICY anon_select_prodotti_menu_pubblico
  ON core.prodotti
  FOR SELECT
  TO anon
  USING (
    deleted_at IS NULL
    AND (attivo = true OR attivo IS NULL)
    AND (visibile_online = true OR visibile_online IS NULL)
  );
