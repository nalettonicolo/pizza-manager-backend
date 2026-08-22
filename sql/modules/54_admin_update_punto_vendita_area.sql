-- =============================================================================
-- Modulo 54 — RPC scrittura area di consegna / posizione sede (punti_vendita)
-- Applicato su Supabase (project flfhrwzlrftuhkrfwzse) il 2026-08-22 come
-- "admin_update_punto_vendita_area" via MCP apply_migration.
-- =============================================================================
--
-- Bug trovato in backtest live: Admin → Impostazioni → Area di consegna →
-- "Salva area e posizione sede" falliva con "permission denied for view
-- punti_vendita" (Postgres 42501). Causa: public.punti_vendita è una VIEW
-- di sola lettura (grant SELECT per authenticated/anon, nessun UPDATE) — il
-- frontend (AreaConsegnaSection.jsx) provava un update diretto via PostgREST
-- (`supabase.from("punti_vendita").update(...)`), mai supportato dalla view.
--
-- Fix: RPC SECURITY DEFINER che scrive su core.punti_vendita (verifica
-- interna auth.uid() + ruolo admin del tenant o superadmin, stesso pattern
-- di save_tenant_payment_provider_secret/tavolo_apri_conto), non un GRANT
-- UPDATE diretto sulla view — evita che un utente qualunque del tenant
-- (non solo l'admin) possa scrivere area di consegna/coordinate sede.

CREATE OR REPLACE FUNCTION public.admin_update_punto_vendita_area(
  p_pv_id uuid,
  p_tenant_id uuid,
  p_lat double precision DEFAULT NULL,
  p_lng double precision DEFAULT NULL,
  p_consegna_area_poligono jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, core, pg_temp
AS $$
DECLARE
  v_is_superadmin BOOLEAN;
  v_is_tenant_admin BOOLEAN;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'non_autenticato';
  END IF;

  SELECT public.pm_auth_is_superadmin() INTO v_is_superadmin;

  SELECT EXISTS (
    SELECT 1 FROM public.utenti_ruoli ur
    WHERE ur.user_id = auth.uid()
      AND ur.tenant_id = p_tenant_id
      AND COALESCE(ur.attivo, true) = true
      AND lower(trim(COALESCE(ur.ruolo, ''))) = 'admin'
  ) INTO v_is_tenant_admin;

  IF NOT v_is_superadmin AND NOT v_is_tenant_admin THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM core.punti_vendita pv WHERE pv.id = p_pv_id AND pv.tenant_id = p_tenant_id
  ) THEN
    RAISE EXCEPTION 'punto vendita non valido per questo tenant';
  END IF;

  UPDATE core.punti_vendita
  SET lat = p_lat,
      lng = p_lng,
      consegna_area_poligono = p_consegna_area_poligono
  WHERE id = p_pv_id AND tenant_id = p_tenant_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_update_punto_vendita_area(uuid, uuid, double precision, double precision, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_update_punto_vendita_area(uuid, uuid, double precision, double precision, jsonb) TO authenticated;
