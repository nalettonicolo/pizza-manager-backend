-- Modulo 127 — Nome pony di sessione (non l'account), assegnazione persistente,
-- e assegnazione manuale dalle consegne «Non assegnato» in cassa.
--
-- Bug 126: Bancone ASSEGNATO e il mount della PWA chiamavano rider_ensure_me(NULL),
-- che creava un rider col prefisso email (es. «admin»). IN_VIAGGIO faceva
-- COALESCE(o.rider_id, v_rider_id) e non sovrascriveva quel rider.

ALTER TABLE core.ordini ADD COLUMN IF NOT EXISTS nome_pony text;

COMMENT ON COLUMN core.ordini.nome_pony IS
  'Nome del pony inserito a inizio turno, copiato sull''ordine alla presa/assegnazione.';

CREATE OR REPLACE FUNCTION public.rider_ensure_me(p_tenant_id uuid, p_nome text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'core'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_id uuid;
  v_nome text := NULLIF(btrim(COALESCE(p_nome, '')), '');
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
  LIMIT 1;

  IF v_id IS NULL THEN
    -- Senza nome di sessione non inventiamo il prefisso email (es. «admin»).
    IF v_nome IS NULL THEN
      RETURN NULL;
    END IF;
    BEGIN
      INSERT INTO core.rider (tenant_id, nome_display, auth_user_id, attivo)
      VALUES (p_tenant_id, v_nome, v_uid, true)
      RETURNING id INTO v_id;
    EXCEPTION WHEN unique_violation THEN
      SELECT r.id INTO v_id
      FROM core.rider r
      WHERE r.auth_user_id = v_uid
        AND r.tenant_id = p_tenant_id
        AND r.deleted_at IS NULL
      LIMIT 1;
      IF v_id IS NOT NULL THEN
        UPDATE core.rider
        SET nome_display = v_nome, updated_at = now()
        WHERE id = v_id;
      END IF;
    END;
  ELSIF v_nome IS NOT NULL THEN
    UPDATE core.rider
    SET nome_display = v_nome, updated_at = now()
    WHERE id = v_id;
  END IF;

  RETURN v_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.rider_ensure_me(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rider_ensure_me(uuid, text) TO authenticated;

COMMENT ON FUNCTION public.rider_ensure_me(uuid, text) IS
  'Trova o crea il rider del chiamante. Crea/aggiorna solo con il nome di sessione: mai dal prefisso email.';

DROP FUNCTION IF EXISTS public.delivery_update_stato_consegna(uuid, text);
DROP FUNCTION IF EXISTS public.delivery_update_stato_consegna(uuid, text, integer);

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

  -- Solo il pony che parte (IN_VIAGGIO) prende l'ordine. Bancone ASSEGNATO
  -- lascia rider_id vuoto: è «pronta per il pony», non assegnata a un account.
  IF v_stato = 'IN_VIAGGIO' THEN
    v_rider_id := public.rider_ensure_me(v_tenant_id, v_nome);
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
  v_nome text;
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

  -- Non creare un rider dall'account. Se l'ordine ha già un pony, lo teniamo.
  SELECT r.id, NULLIF(btrim(COALESCE(r.nome_display, '')), '')
  INTO v_rider_id, v_nome
  FROM core.rider r
  WHERE r.auth_user_id = auth.uid()
    AND r.tenant_id = v_tenant_id
    AND r.deleted_at IS NULL
  LIMIT 1;

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
    nome_pony = COALESCE(o.nome_pony, CASE WHEN o.rider_id IS NULL THEN v_nome ELSE NULL END),
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
  consegna_at timestamptz,
  stato_consegna text
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
    upper(trim(COALESCE(o.stato_consegna, o.stato::text, '')))
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

CREATE OR REPLACE FUNCTION public.cassa_elenca_pony(p_tenant_id uuid)
RETURNS TABLE (rider_id uuid, nome_display text)
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
  SELECT r.id, NULLIF(btrim(COALESCE(r.nome_display, '')), '')
  FROM core.rider r
  WHERE r.tenant_id = p_tenant_id
    AND r.deleted_at IS NULL
    AND COALESCE(r.attivo, true) = true
    AND NULLIF(btrim(COALESCE(r.nome_display, '')), '') IS NOT NULL
  ORDER BY r.nome_display;
END;
$function$;

REVOKE ALL ON FUNCTION public.cassa_elenca_pony(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cassa_elenca_pony(uuid) TO authenticated;

COMMENT ON FUNCTION public.cassa_elenca_pony(uuid) IS
  'Pony attivi del locale, per assegnare le consegne ancora libere dal conteggio cassa.';

CREATE OR REPLACE FUNCTION public.cassa_assegna_consegna_pony(p_ordine_id uuid, p_rider_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'core'
AS $function$
DECLARE
  v_tenant_id uuid;
  v_curr_rider uuid;
  v_allowed boolean;
  v_nome text;
  v_rider_tenant uuid;
BEGIN
  IF p_ordine_id IS NULL OR p_rider_id IS NULL THEN
    RAISE EXCEPTION 'parametri_obbligatori';
  END IF;

  SELECT o.tenant_id, o.rider_id
  INTO v_tenant_id, v_curr_rider
  FROM core.ordini o
  WHERE o.id = p_ordine_id AND o.deleted_at IS NULL;
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'ordine_non_trovato';
  END IF;
  IF v_curr_rider IS NOT NULL THEN
    RAISE EXCEPTION 'consegna_gia_assegnata';
  END IF;

  SELECT r.tenant_id, NULLIF(btrim(COALESCE(r.nome_display, '')), '')
  INTO v_rider_tenant, v_nome
  FROM core.rider r
  WHERE r.id = p_rider_id AND r.deleted_at IS NULL;
  IF v_rider_tenant IS NULL OR v_rider_tenant IS DISTINCT FROM v_tenant_id THEN
    RAISE EXCEPTION 'pony_non_valido';
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
              'cassa', 'admin', 'amministratore', 'gestore',
              'superadmin', 'super_admin', 'owner'
            )
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

  UPDATE core.ordini o
  SET
    rider_id = p_rider_id,
    nome_pony = COALESCE(v_nome, o.nome_pony),
    assegnato_rider_at = COALESCE(o.assegnato_rider_at, now()),
    updated_at = now()
  WHERE o.id = p_ordine_id AND o.tenant_id = v_tenant_id AND o.rider_id IS NULL;
END;
$function$;

REVOKE ALL ON FUNCTION public.cassa_assegna_consegna_pony(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cassa_assegna_consegna_pony(uuid, uuid) TO authenticated;

COMMENT ON FUNCTION public.cassa_assegna_consegna_pony(uuid, uuid) IS
  'Cassa: assegna una consegna ancora libera a un pony del locale.';
