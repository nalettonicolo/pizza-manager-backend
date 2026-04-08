-- Vista public.prodotti_menu_pubblico legge core.prodotti con ruolo anon.
-- Con solo policy isolate_by_tenant (app.current_tenant_id), anon non passa RLS → 403 su REST.
-- Policy dedicata: righe esposte in menu pubblico (stessi filtri della vista).

DROP POLICY IF EXISTS prodotti_public_menu_anon_select ON core.prodotti;

CREATE POLICY prodotti_public_menu_anon_select
  ON core.prodotti
  FOR SELECT
  TO anon
  USING (
    deleted_at IS NULL
    AND (attivo IS NULL OR attivo = true)
    AND (visibile_online IS NULL OR visibile_online = true)
  );

COMMENT ON POLICY prodotti_public_menu_anon_select ON core.prodotti IS
  'Lettura anon per vista prodotti_menu_pubblico (menu online); il client filtra per tenant_id.';
