-- Modulo 71 — Fix bug critico produzione: delivery_update_stato_consegna e
-- delivery_mark_consegnato referenziavano una tabella public.profiles MAI esistita
-- in questo schema (probabilmente boilerplate copiato da una vecchia versione, prima
-- della migrazione a public.utenti_ruoli). Postgres fallisce a livello di parse/plan
-- su una tabella inesistente: l'intero controllo permessi (con tutto l'OR) falliva
-- SEMPRE, per QUALSIASI utente — Assegna, In viaggio e Consegnato (con firma/foto) in
-- Delivery erano completamente non funzionanti in produzione, indipendentemente dal
-- ruolo di chi cliccava.
--
-- Segnalato dal vivo su https://pizzamanager.it tramite console:
--   [DeliveryDashboard] setAssegnato: relation "public.profiles" does not exist · 42P01
--   [DeliveryDashboard] setInViaggio: relation "public.profiles" does not exist · 42P01
--   [DeliveryDashboard] markConsegnatoWithProof: relation "public.profiles" does not exist · 42P01
--
-- Fix: rimossa la sola clausola morta (OR EXISTS su public.profiles) da entrambe le
-- funzioni. Gli altri controlli (ruolo/permesso via utenti_ruoli, superadmin via
-- utenti_ruoli, account di test pizzaioli@pizzamanager.it) restano identici e coprono
-- già tutti i casi legittimi — nessuna perdita di accesso, nessun cambio di comportamento
-- per chi aveva già i permessi giusti (semplicemente prima non funzionava per nessuno).
--
-- Applicato in produzione via apply_migration il 2026-08-23.

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

  UPDATE core.ordini o
  SET
    stato_consegna = v_stato,
    stato_delivery = v_delivery,
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

CREATE OR REPLACE FUNCTION public.delivery_mark_consegnato(p_ordine_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'core'
AS $function$
DECLARE
  v_tenant_id UUID;
  v_allowed BOOLEAN;
BEGIN
  IF p_ordine_id IS NULL THEN
    RAISE EXCEPTION 'ordine_id_obbligatorio';
  END IF;

  SELECT o.tenant_id
  INTO v_tenant_id
  FROM core.ordini o
  WHERE o.id = p_ordine_id;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'ordine_non_trovato';
  END IF;

  SELECT COALESCE(
    (
      SELECT EXISTS (
        SELECT 1
        FROM public.utenti_ruoli ur
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

  UPDATE core.ordini o
  SET
    stato_consegna = 'CONSEGNATO',
    stato_delivery = 'CONSEGNATO'::core.stato_delivery,
    updated_at = now()
  WHERE o.id = p_ordine_id AND o.tenant_id = v_tenant_id;

  IF to_regclass('core.ordine_consegna_evento') IS NOT NULL THEN
    INSERT INTO core.ordine_consegna_evento (tenant_id, ordine_id, tipo, payload, created_by)
    VALUES (v_tenant_id, p_ordine_id, 'delivery_mark_consegnato', '{}'::jsonb, auth.uid());
  END IF;
END;
$function$;
