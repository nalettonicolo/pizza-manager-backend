-- Modulo 137 — Rimuove il meccanismo "pony a slot" (moduli 126-128)
--
-- I moduli 126-128 avevano introdotto core.rider.pony_slot per permettere a due persone di
-- condividere lo stesso login come due rider distinti (slot 1/2, distinti via URL
-- /operative/pony/1 e /operative/pony/2). Nella pizzeria reale ogni pony ha il proprio login
-- individuale: quel caso d'uso non esiste, quindi si torna al modello originale
-- "un login = un rider", più semplice e coerente.
--
-- Resta invariato tutto il resto introdotto dagli stessi moduli: il rider imposta il proprio
-- nome visualizzato, core.ordini.nome_pony (snapshot del nome al momento della presa in carico),
-- la vista cassa delle consegne odierne e l'assegnazione manuale da cassa.

-- 1) Rider: un solo record per tenant+utente autenticato (come prima del modulo 128).
DROP INDEX IF EXISTS core.uq_rider_auth_tenant_slot;

CREATE UNIQUE INDEX IF NOT EXISTS uq_rider_auth_tenant
  ON core.rider (tenant_id, auth_user_id)
  WHERE auth_user_id IS NOT NULL AND deleted_at IS NULL;

ALTER TABLE core.rider DROP COLUMN IF EXISTS pony_slot;

-- 2) Ordini: la colonna slot non serve più (nome_pony resta).
ALTER TABLE core.ordini DROP COLUMN IF EXISTS presa_da_pony_slot;

-- 3) rider_ensure_me: torna a 2 argomenti (tenant, nome).
DROP FUNCTION IF EXISTS public.rider_ensure_me(uuid, text, integer);

CREATE FUNCTION public.rider_ensure_me(
  p_tenant_id uuid,
  p_nome text DEFAULT NULL
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
        UPDATE core.rider SET nome_display = v_nome, updated_at = now() WHERE id = v_id;
      END IF;
    END;
  ELSIF v_nome IS NOT NULL THEN
    UPDATE core.rider SET nome_display = v_nome, updated_at = now() WHERE id = v_id;
  END IF;

  RETURN v_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.rider_ensure_me(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rider_ensure_me(uuid, text) TO authenticated;

COMMENT ON FUNCTION public.rider_ensure_me(uuid, text) IS
  'Rider del chiamante sul tenant (un solo record per utente autenticato).';

-- 4) rider_set_nome_display: torna a 1 argomento (nome).
DROP FUNCTION IF EXISTS public.rider_set_nome_display(text, integer);

CREATE FUNCTION public.rider_set_nome_display(p_nome text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'core'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_nome text := btrim(COALESCE(p_nome, ''));
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
  RETURNING nome_display INTO v_out;

  RETURN v_out;
END;
$function$;

REVOKE ALL ON FUNCTION public.rider_set_nome_display(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rider_set_nome_display(text) TO authenticated;

-- 5) delivery_update_stato_consegna: torna senza slot (resta il nome opzionale).
DROP FUNCTION IF EXISTS public.delivery_update_stato_consegna(uuid, text, integer, text);
DROP FUNCTION IF EXISTS public.delivery_update_stato_consegna(uuid, text);

CREATE FUNCTION public.delivery_update_stato_consegna(
  p_ordine_id uuid,
  p_stato text,
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

  SELECT o.tenant_id, o.rider_id, upper(trim(COALESCE(o.stato_consegna, '')))
  INTO v_tenant_id, v_curr_rider, v_curr_stato
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
    v_rider_id := public.rider_ensure_me(v_tenant_id, v_nome);
    IF v_rider_id IS NOT NULL THEN
      SELECT NULLIF(btrim(COALESCE(r.nome_display, '')), '')
      INTO v_nome_rider
      FROM core.rider r
      WHERE r.id = v_rider_id;
    END IF;
  END IF;

  IF v_stato = 'IN_VIAGGIO' AND v_curr_stato = 'IN_VIAGGIO'
     AND v_curr_rider IS NOT NULL AND v_rider_id IS NOT NULL AND v_curr_rider IS DISTINCT FROM v_rider_id THEN
    RAISE EXCEPTION 'ordine_gia_preso';
  END IF;

  UPDATE core.ordini o
  SET
    stato_consegna = v_stato,
    stato_delivery = v_delivery,
    rider_id = CASE
      WHEN v_stato = 'IN_VIAGGIO' THEN COALESCE(v_rider_id, o.rider_id)
      ELSE o.rider_id
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
      jsonb_build_object('stato', v_stato, 'nome_pony', v_nome),
      auth.uid()
    );
  END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public.delivery_update_stato_consegna(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delivery_update_stato_consegna(uuid, text, text) TO authenticated;

CREATE FUNCTION public.delivery_update_stato_consegna(p_ordine_id uuid, p_stato text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'core'
AS $function$
BEGIN
  PERFORM public.delivery_update_stato_consegna(p_ordine_id, p_stato, NULL);
END;
$function$;

REVOKE ALL ON FUNCTION public.delivery_update_stato_consegna(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delivery_update_stato_consegna(uuid, text) TO authenticated;

-- 6) cassa_elenca_pony: rimuove la colonna pony_slot dall'output.
DROP FUNCTION IF EXISTS public.cassa_elenca_pony(uuid);

CREATE FUNCTION public.cassa_elenca_pony(p_tenant_id uuid)
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
