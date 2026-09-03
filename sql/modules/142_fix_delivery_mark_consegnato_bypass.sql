-- Modulo 142 — Rimosso lo stesso bypass hardcoded (email pizzaioli@pizzamanager.it) anche da
-- delivery_mark_consegnato (mancava nel modulo 139, che aveva sistemato solo
-- delivery_update_stato_consegna).

CREATE OR REPLACE FUNCTION public.delivery_mark_consegnato(p_ordine_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'core'
AS $function$
DECLARE
  v_tenant_id UUID;
  v_allowed BOOLEAN;
  v_rider_id UUID;
BEGIN
  IF p_ordine_id IS NULL THEN
    RAISE EXCEPTION 'ordine_id_obbligatorio';
  END IF;

  SELECT o.tenant_id INTO v_tenant_id FROM core.ordini o WHERE o.id = p_ordine_id;
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'ordine_non_trovato';
  END IF;

  SELECT COALESCE(
    (
      SELECT EXISTS (
        SELECT 1 FROM public.utenti_ruoli ur
        WHERE ur.user_id = auth.uid()
          AND ur.tenant_id = v_tenant_id
          AND COALESCE(ur.attivo, true) = true
          AND (
            lower(trim(COALESCE(ur.ruolo, ''))) IN (
              'delivery', 'pony', 'cassa', 'admin', 'amministratore', 'gestore',
              'superadmin', 'super_admin', 'owner'
            )
            OR COALESCE(ur.accesso_delivery, false) = true
            OR COALESCE(ur.accesso_pony, false) = true
            OR COALESCE(ur.accesso_cassa, false) = true
          )
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

  v_rider_id := public.rider_ensure_me(v_tenant_id, NULL);

  UPDATE core.ordini o
  SET
    stato = 'CONSEGNATO'::core.stato_ordine,
    stato_consegna = 'CONSEGNATO',
    stato_delivery = CASE
      WHEN to_regtype('core.stato_delivery') IS NOT NULL
        THEN 'CONSEGNATO'::core.stato_delivery
      ELSE o.stato_delivery
    END,
    rider_id = COALESCE(o.rider_id, v_rider_id),
    assegnato_rider_at = CASE
      WHEN o.assegnato_rider_at IS NULL AND COALESCE(o.rider_id, v_rider_id) IS NOT NULL
      THEN now()
      ELSE o.assegnato_rider_at
    END,
    updated_at = now()
  WHERE o.id = p_ordine_id AND o.tenant_id = v_tenant_id;

  IF to_regclass('core.ordine_consegna_evento') IS NOT NULL THEN
    INSERT INTO core.ordine_consegna_evento (tenant_id, ordine_id, tipo, payload, created_by)
    VALUES (v_tenant_id, p_ordine_id, 'delivery_mark_consegnato', '{}'::jsonb, auth.uid());
  END IF;
END;
$function$;
