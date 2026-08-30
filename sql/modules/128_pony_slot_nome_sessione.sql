-- Modulo 128 — Un rider per slot pony (1/2), nome di sessione che non si sovrascrive.
-- Pony 1 e Pony 2 sullo stesso account devono restare due persone distinte.

ALTER TABLE core.rider ADD COLUMN IF NOT EXISTS pony_slot smallint;

COMMENT ON COLUMN core.rider.pony_slot IS
  'Slot turno PWA: 1 o 2. Due pony sullo stesso login hanno due record.';

DROP INDEX IF EXISTS core.uq_rider_auth_tenant;

CREATE UNIQUE INDEX IF NOT EXISTS uq_rider_auth_tenant_slot
  ON core.rider (tenant_id, auth_user_id, (COALESCE(pony_slot, 0)))
  WHERE auth_user_id IS NOT NULL AND deleted_at IS NULL;

DROP FUNCTION IF EXISTS public.rider_ensure_me(uuid, text);
DROP FUNCTION IF EXISTS public.rider_ensure_me(uuid, text, integer);

CREATE FUNCTION public.rider_ensure_me(
  p_tenant_id uuid,
  p_nome text DEFAULT NULL,
  p_pony_slot integer DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'core'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_id uuid;
  v_nome text := NULLIF(btrim(COALESCE(p_nome, '')), '');
  v_slot smallint := CASE WHEN p_pony_slot IN (1, 2) THEN p_pony_slot::smallint ELSE NULL END;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'non_autenticato';
  END IF;
  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'tenant_obbligatorio';
  END IF;
  IF v_nome IS NOT NULL AND length(v_nome) > 60 THEN
    v_nome := left(v_nome, 60);
  END IF;

  SELECT r.id INTO v_id
  FROM core.rider r
  WHERE r.auth_user_id = v_uid
    AND r.tenant_id = p_tenant_id
    AND r.deleted_at IS NULL
    AND r.pony_slot IS NOT DISTINCT FROM v_slot
  LIMIT 1;

  -- Record precedente (senza slot): lo prende il primo pony che apre il turno.
  IF v_id IS NULL AND v_slot IS NOT NULL THEN
    UPDATE core.rider r
    SET
      pony_slot = v_slot,
      nome_display = COALESCE(v_nome, r.nome_display),
      updated_at = now()
    WHERE r.id = (
      SELECT x.id
      FROM core.rider x
      WHERE x.auth_user_id = v_uid
        AND x.tenant_id = p_tenant_id
        AND x.deleted_at IS NULL
        AND x.pony_slot IS NULL
      LIMIT 1
    )
    RETURNING r.id INTO v_id;
  END IF;

  IF v_id IS NULL THEN
    IF v_nome IS NULL THEN
      RETURN NULL;
    END IF;
    BEGIN
      INSERT INTO core.rider (tenant_id, nome_display, auth_user_id, attivo, pony_slot)
      VALUES (p_tenant_id, v_nome, v_uid, true, v_slot)
      RETURNING id INTO v_id;
    EXCEPTION WHEN unique_violation THEN
      SELECT r.id INTO v_id
      FROM core.rider r
      WHERE r.auth_user_id = v_uid
        AND r.tenant_id = p_tenant_id
        AND r.deleted_at IS NULL
        AND r.pony_slot IS NOT DISTINCT FROM v_slot
      LIMIT 1;
      IF v_id IS NOT NULL AND v_nome IS NOT NULL THEN
        UPDATE core.rider
        SET nome_display = v_nome, updated_at = now()
        WHERE id = v_id;
      END IF;
    END;
  ELSIF v_nome IS NOT NULL AND v_slot IS NOT NULL THEN
    UPDATE core.rider
    SET nome_display = v_nome, updated_at = now()
    WHERE id = v_id;
  END IF;

  RETURN v_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.rider_ensure_me(uuid, text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rider_ensure_me(uuid, text, integer) TO authenticated;

COMMENT ON FUNCTION public.rider_ensure_me(uuid, text, integer) IS
  'Rider del chiamante sul tenant e sullo slot pony. Il nome di un slot non sovrascrive l''altro.';

DROP FUNCTION IF EXISTS public.rider_set_nome_display(text);
DROP FUNCTION IF EXISTS public.rider_set_nome_display(text, integer);

CREATE FUNCTION public.rider_set_nome_display(p_nome text, p_pony_slot integer DEFAULT NULL)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'core'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_nome text := btrim(COALESCE(p_nome, ''));
  v_slot smallint := CASE WHEN p_pony_slot IN (1, 2) THEN p_pony_slot::smallint ELSE NULL END;
  v_out text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'non_autenticato';
  END IF;
  IF length(v_nome) < 1 THEN
    RAISE EXCEPTION 'nome_obbligatorio';
  END IF;
  IF length(v_nome) > 60 THEN
    v_nome := left(v_nome, 60);
  END IF;

  UPDATE core.rider
  SET nome_display = v_nome, updated_at = now()
  WHERE auth_user_id = v_uid
    AND deleted_at IS NULL
    AND pony_slot IS NOT DISTINCT FROM v_slot
  RETURNING nome_display INTO v_out;

  RETURN v_out;
END;
$function$;

REVOKE ALL ON FUNCTION public.rider_set_nome_display(text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rider_set_nome_display(text, integer) TO authenticated;

DROP FUNCTION IF EXISTS public.delivery_update_stato_consegna(uuid, text);
DROP FUNCTION IF EXISTS public.delivery_update_stato_consegna(uuid, text, integer, text);

CREATE FUNCTION public.delivery_update_stato_consegna(
  p_ordine_id uuid,
  p_stato text,
  p_pony_slot integer DEFAULT NULL,
  p_nome text DEFAULT NULL
)
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
  v_curr_rider UUID;
  v_curr_stato TEXT;
  v_curr_slot smallint;
  v_slot smallint := CASE WHEN p_pony_slot IN (1, 2) THEN p_pony_slot::smallint ELSE NULL END;
  v_nome text := NULLIF(btrim(COALESCE(p_nome, '')), '');
  v_nome_rider text;
BEGIN
  IF p_ordine_id IS NULL THEN
    RAISE EXCEPTION 'ordine_id_obbligatorio';
  END IF;
  IF v_stato NOT IN ('ASSEGNATO', 'IN_VIAGGIO', 'RICHIESTA', 'PROBLEMA') THEN
    RAISE EXCEPTION 'stato_non_valido';
  END IF;
  IF v_nome IS NOT NULL AND length(v_nome) > 60 THEN
    v_nome := left(v_nome, 60);
  END IF;

  SELECT o.tenant_id, o.rider_id, upper(trim(COALESCE(o.stato_consegna, ''))), o.presa_da_pony_slot
  INTO v_tenant_id, v_curr_rider, v_curr_stato, v_curr_slot
  FROM core.ordini o WHERE o.id = p_ordine_id;
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
    v_rider_id := public.rider_ensure_me(v_tenant_id, v_nome, v_slot);
    IF v_rider_id IS NOT NULL THEN
      SELECT NULLIF(btrim(COALESCE(r.nome_display, '')), '')
      INTO v_nome_rider
      FROM core.rider r
      WHERE r.id = v_rider_id;
    END IF;
  END IF;

  IF v_stato = 'IN_VIAGGIO' AND v_curr_stato = 'IN_VIAGGIO' THEN
    IF v_curr_rider IS NOT NULL AND v_rider_id IS NOT NULL AND v_curr_rider IS DISTINCT FROM v_rider_id THEN
      RAISE EXCEPTION 'ordine_gia_preso';
    END IF;
    IF v_curr_slot IS NOT NULL AND v_slot IS NOT NULL AND v_curr_slot IS DISTINCT FROM v_slot THEN
      RAISE EXCEPTION 'ordine_gia_preso';
    END IF;
  END IF;

  UPDATE core.ordini o
  SET
    stato_consegna = v_stato,
    stato_delivery = v_delivery,
    rider_id = CASE
      WHEN v_stato = 'IN_VIAGGIO' THEN COALESCE(v_rider_id, o.rider_id)
      ELSE o.rider_id
    END,
    presa_da_pony_slot = CASE
      WHEN v_stato = 'IN_VIAGGIO' THEN COALESCE(v_slot, o.presa_da_pony_slot)
      ELSE o.presa_da_pony_slot
    END,
    nome_pony = CASE
      WHEN v_stato = 'IN_VIAGGIO' THEN COALESCE(v_nome, o.nome_pony, v_nome_rider)
      ELSE o.nome_pony
    END,
    assegnato_rider_at = CASE
      WHEN v_stato = 'IN_VIAGGIO'
        AND o.assegnato_rider_at IS NULL
        AND COALESCE(v_rider_id, o.rider_id) IS NOT NULL
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
      jsonb_build_object('stato', v_stato, 'pony_slot', v_slot, 'nome_pony', v_nome),
      auth.uid()
    );
  END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public.delivery_update_stato_consegna(uuid, text, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delivery_update_stato_consegna(uuid, text, integer, text) TO authenticated;

CREATE FUNCTION public.delivery_update_stato_consegna(p_ordine_id uuid, p_stato text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'core'
AS $function$
BEGIN
  PERFORM public.delivery_update_stato_consegna(p_ordine_id, p_stato, NULL, NULL);
END;
$function$;

REVOKE ALL ON FUNCTION public.delivery_update_stato_consegna(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delivery_update_stato_consegna(uuid, text) TO authenticated;

DROP FUNCTION IF EXISTS public.cassa_elenca_pony(uuid);

CREATE FUNCTION public.cassa_elenca_pony(p_tenant_id uuid)
RETURNS TABLE (rider_id uuid, nome_display text, pony_slot smallint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'core'
AS $function$
DECLARE
  v_allowed boolean;
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
  SELECT r.id, NULLIF(btrim(COALESCE(r.nome_display, '')), ''), r.pony_slot
  FROM core.rider r
  WHERE r.tenant_id = p_tenant_id
    AND r.deleted_at IS NULL
    AND COALESCE(r.attivo, true) = true
    AND NULLIF(btrim(COALESCE(r.nome_display, '')), '') IS NOT NULL
  ORDER BY r.pony_slot NULLS LAST, r.nome_display;
END;
$function$;

REVOKE ALL ON FUNCTION public.cassa_elenca_pony(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cassa_elenca_pony(uuid) TO authenticated;

DROP FUNCTION IF EXISTS public.cassa_consegne_odierne(uuid);

CREATE FUNCTION public.cassa_consegne_odierne(p_tenant_id uuid)
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
  consegna_at timestamptz,
  stato_consegna text,
  nome_pony text
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
    COALESCE(
      NULLIF(btrim(COALESCE(o.nome_pony, '')), ''),
      NULLIF(btrim(COALESCE(r.nome_display, '')), '')
    ),
    COALESCE(o.consegna_effettiva_at, o.assegnato_rider_at, o.updated_at),
    upper(trim(COALESCE(o.stato_consegna, o.stato::text, ''))),
    NULLIF(btrim(COALESCE(o.nome_pony, '')), '')
  FROM core.ordini o
  LEFT JOIN core.rider r ON r.id = o.rider_id AND r.deleted_at IS NULL
  WHERE o.tenant_id = p_tenant_id
    AND o.deleted_at IS NULL
    AND lower(trim(COALESCE(o.tipo_ordine, ''))) IN ('delivery', 'consegna')
    AND (
      o.stato = 'CONSEGNATO'
      OR upper(trim(COALESCE(o.stato_consegna, ''))) IN ('CONSEGNATO', 'IN_VIAGGIO', 'ASSEGNATO')
    )
    AND o.created_at >= v_start
    AND o.created_at < v_end
  ORDER BY o.rider_id NULLS LAST, o.numero;
END;
$function$;

REVOKE ALL ON FUNCTION public.cassa_consegne_odierne(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cassa_consegne_odierne(uuid) TO authenticated;
