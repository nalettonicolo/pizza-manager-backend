-- Modulo 73 — RPC di lettura per la mappa live dei pony.
-- core.rider_posizione veniva già scritta da rider_upsert_posizione (moduli 41/42), ma nessuna RPC
-- pubblica la leggeva: la mappa comando (DeliveryCommandMapPage.jsx) mostrava solo le destinazioni
-- degli ordini, mai la posizione GPS reale dei pony. Aggiunta rider_posizioni_live(p_tenant_id) che
-- restituisce le posizioni aggiornate negli ultimi 20 minuti (rider più vecchi = probabilmente
-- offline, non li mostriamo per non lasciare puntini fantasma fermi da ore).
--
-- Applicato in produzione via apply_migration il 2026-08-23.

CREATE OR REPLACE FUNCTION public.rider_posizioni_live(p_tenant_id uuid)
RETURNS TABLE (
  rider_id uuid,
  nome_display text,
  veicolo_tipo text,
  lat double precision,
  lng double precision,
  aggiornato_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'core'
AS $function$
DECLARE
  v_allowed BOOLEAN;
BEGIN
  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'tenant_obbligatorio';
  END IF;

  SELECT COALESCE(
    (
      SELECT EXISTS (
        SELECT 1 FROM public.utenti_ruoli ur
        WHERE ur.user_id = auth.uid()
          AND ur.tenant_id = p_tenant_id
          AND COALESCE(ur.attivo, true) = true
      )
    ),
    false
  )
  OR EXISTS (
    SELECT 1 FROM public.utenti_ruoli ur_sa
    WHERE ur_sa.user_id = auth.uid()
      AND COALESCE(ur_sa.attivo, true) = true
      AND lower(trim(COALESCE(ur_sa.ruolo, ''))) IN ('superadmin', 'super_admin')
  )
  INTO v_allowed;

  IF NOT COALESCE(v_allowed, false) THEN
    RAISE EXCEPTION 'non_autorizzato';
  END IF;

  RETURN QUERY
  SELECT r.id, r.nome_display, r.veicolo_tipo, rp.lat, rp.lng, rp.aggiornato_at
  FROM core.rider_posizione rp
  INNER JOIN core.rider r ON r.id = rp.rider_id
  WHERE r.tenant_id = p_tenant_id
    AND r.deleted_at IS NULL
    AND COALESCE(r.attivo, true) = true
    AND rp.aggiornato_at > now() - interval '20 minutes';
END;
$function$;

REVOKE ALL ON FUNCTION public.rider_posizioni_live(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rider_posizioni_live(uuid) TO authenticated;

COMMENT ON FUNCTION public.rider_posizioni_live(uuid) IS
  'Posizioni GPS correnti (ultimi 20 minuti) dei rider attivi del tenant, per la mappa live.';
