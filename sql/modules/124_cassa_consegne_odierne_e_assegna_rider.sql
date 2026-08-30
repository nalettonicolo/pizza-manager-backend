-- Modulo 124 — Assegna il rider all'ordine quando parte In viaggio + report consegne odierne in cassa.
-- Idempotente: CREATE OR REPLACE.

CREATE OR REPLACE FUNCTION public.delivery_update_stato_consegna(p_ordine_id uuid, p_stato text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'core'
AS $function$
DECLARE
  v_tenant_id UUID;
  v_allowed BOOLEAN;
  v_stato TEXT := upper(trim(COALESCE(p_stato, '')));
  v_delivery core.stato_delivery;
  v_rider_id UUID;
BEGIN
  IF p_ordine_id IS NULL THEN
    RAISE EXCEPTION 'ordine_id_obbligatorio';
  END IF;
  IF v_stato NOT IN ('ASSEGNATO', 'IN_VIAGGIO', 'RICHIESTA', 'PROBLEMA') THEN
    RAISE EXCEPTION 'stato_non_valido';
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
  OR EXISTS (
    SELECT 1 FROM auth.users u
    INNER JOIN public.utenti_ruoli ur ON ur.user_id = u.id AND ur.tenant_id = v_tenant_id
      AND COALESCE(ur.attivo, true) = true
    WHERE u.id = auth.uid()
      AND lower(trim(COALESCE(u.email, ''))) = 'pizzaioli@pizzamanager.it'
  )
  INTO v_allowed;

  IF NOT COALESCE(v_allowed, false) THEN
    RAISE EXCEPTION 'non_autorizzato';
  END IF;

  v_delivery := CASE v_stato
    WHEN 'ASSEGNATO' THEN 'ASSEGNATO'::core.stato_delivery
    WHEN 'IN_VIAGGIO' THEN 'IN_VIAGGIO'::core.stato_delivery
    WHEN 'RICHIESTA' THEN 'DA_ASSEGNARE'::core.stato_delivery
    WHEN 'PROBLEMA' THEN 'ANOMALIA'::core.stato_delivery
    ELSE 'DA_ASSEGNARE'::core.stato_delivery
  END;

  IF v_stato = 'IN_VIAGGIO' THEN
    SELECT r.id INTO v_rider_id
    FROM core.rider r
    WHERE r.auth_user_id = auth.uid()
      AND r.tenant_id = v_tenant_id
      AND r.deleted_at IS NULL
      AND COALESCE(r.attivo, true) = true
    LIMIT 1;
  END IF;

  UPDATE core.ordini o
  SET
    stato_consegna = v_stato,
    stato_delivery = v_delivery,
    rider_id = CASE
      WHEN v_stato = 'IN_VIAGGIO' THEN COALESCE(o.rider_id, v_rider_id)
      ELSE o.rider_id
    END,
    assegnato_rider_at = CASE
      WHEN v_stato = 'IN_VIAGGIO'
        AND o.assegnato_rider_at IS NULL
        AND COALESCE(o.rider_id, v_rider_id) IS NOT NULL
      THEN now()
      ELSE o.assegnato_rider_at
    END,
    updated_at = now()
  WHERE o.id = p_ordine_id AND o.tenant_id = v_tenant_id;

  IF to_regclass('core.ordine_consegna_evento') IS NOT NULL THEN
    INSERT INTO core.ordine_consegna_evento (tenant_id, ordine_id, tipo, payload, created_by)
    VALUES (
      v_tenant_id,
      p_ordine_id,
      'delivery_update_stato',
      jsonb_build_object('stato', v_stato),
      auth.uid()
    );
  END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public.delivery_update_stato_consegna(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delivery_update_stato_consegna(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.cassa_consegne_odierne(p_tenant_id uuid)
RETURNS TABLE (
  ordine_id uuid,
  numero integer,
  totale numeric,
  tipo_pagamento text,
  nome_cliente text,
  indirizzo_consegna text,
  orario_ritiro text,
  rider_id uuid,
  rider_nome text,
  consegna_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'core'
AS $function$
DECLARE
  v_allowed boolean;
  v_start timestamptz;
  v_end timestamptz;
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

  v_start := ((now() AT TIME ZONE 'Europe/Rome')::date)::timestamp AT TIME ZONE 'Europe/Rome';
  v_end := v_start + interval '1 day';

  RETURN QUERY
  SELECT
    o.id,
    o.numero,
    o.totale,
    o.tipo_pagamento,
    o.nome_cliente,
    o.indirizzo_consegna,
    o.orario_ritiro,
    o.rider_id,
    NULLIF(btrim(COALESCE(r.nome_display, '')), ''),
    COALESCE(o.consegna_effettiva_at, o.updated_at)
  FROM core.ordini o
  LEFT JOIN core.rider r ON r.id = o.rider_id AND r.deleted_at IS NULL
  WHERE o.tenant_id = p_tenant_id
    AND o.deleted_at IS NULL
    AND lower(trim(COALESCE(o.tipo_ordine, ''))) IN ('delivery', 'consegna')
    AND (
      o.stato = 'CONSEGNATO'
      OR upper(trim(COALESCE(o.stato_consegna, ''))) = 'CONSEGNATO'
    )
    AND o.created_at >= v_start
    AND o.created_at < v_end
  ORDER BY o.rider_id NULLS LAST, o.numero;
END;
$function$;

REVOKE ALL ON FUNCTION public.cassa_consegne_odierne(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cassa_consegne_odierne(uuid) TO authenticated;

COMMENT ON FUNCTION public.cassa_consegne_odierne(uuid) IS
  'Consegne a domicilio chiuse oggi (Europe/Rome) del tenant, con rider e pagamento, per i conteggi cassa.';
