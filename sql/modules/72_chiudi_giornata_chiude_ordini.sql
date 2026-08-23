-- =============================================================================
-- Modulo 72 — Chiusura giornata chiude gli ordini + fix Consegnato fattorino
-- =============================================================================
-- Flusso normale: il fattorino (o Bancone per ritiro) porta l'ordine a CONSEGNATO.
-- A fine giornata (manuale o automatica in cassa): gli ordini ancora aperti di
-- quella data (e residui di giorni precedenti) passano a CONSEGNATO.
-- Eccezione: ANNULLATO resta invariato.
--
-- Bug correlato: delivery_mark_consegnato aggiornava solo stato_consegna/stato_delivery
-- e non core.ordini.stato → l'area cliente restava su «In preparazione».

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
    stato = 'CONSEGNATO'::core.stato_ordine,
    stato_consegna = 'CONSEGNATO',
    stato_delivery = CASE
      WHEN to_regtype('core.stato_delivery') IS NOT NULL
        THEN 'CONSEGNATO'::core.stato_delivery
      ELSE o.stato_delivery
    END,
    updated_at = now()
  WHERE o.id = p_ordine_id AND o.tenant_id = v_tenant_id;

  IF to_regclass('core.ordine_consegna_evento') IS NOT NULL THEN
    INSERT INTO core.ordine_consegna_evento (tenant_id, ordine_id, tipo, payload, created_by)
    VALUES (v_tenant_id, p_ordine_id, 'delivery_mark_consegnato', '{}'::jsonb, auth.uid());
  END IF;
END;
$function$;

COMMENT ON FUNCTION public.delivery_mark_consegnato(UUID) IS
  'Fattorino/Bancone: marca ordine CONSEGNATO (stato + stato_consegna + stato_delivery).';

-- Chiude ordini aperti fino a p_data (Europe/Rome). Usata da chiudi_giornata e catch-up cassa.
CREATE OR REPLACE FUNCTION public.chiudi_ordini_aperti_fino_a(
  p_tenant_id UUID,
  p_data DATE DEFAULT ((now() AT TIME ZONE 'Europe/Rome')::date - 1)
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, core
AS $fn$
DECLARE
  v_n INTEGER := 0;
BEGIN
  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'tenant_obbligatorio';
  END IF;
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'non_autenticato';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.utenti_ruoli ur
    WHERE ur.user_id = auth.uid()
      AND ur.tenant_id = p_tenant_id
      AND COALESCE(ur.attivo, true) = true
  ) AND NOT EXISTS (
    SELECT 1 FROM public.utenti_ruoli ur_sa
    WHERE ur_sa.user_id = auth.uid()
      AND COALESCE(ur_sa.attivo, true) = true
      AND lower(trim(COALESCE(ur_sa.ruolo, ''))) IN ('superadmin', 'super_admin')
  ) THEN
    RAISE EXCEPTION 'Non autorizzato per questo tenant.';
  END IF;

  UPDATE core.ordini o
  SET
    stato = 'CONSEGNATO'::core.stato_ordine,
    stato_consegna = CASE
      WHEN lower(trim(COALESCE(o.tipo_ordine, ''))) = 'delivery' THEN 'CONSEGNATO'
      ELSE o.stato_consegna
    END,
    stato_delivery = CASE
      WHEN lower(trim(COALESCE(o.tipo_ordine, ''))) = 'delivery'
           AND to_regtype('core.stato_delivery') IS NOT NULL
        THEN 'CONSEGNATO'::core.stato_delivery
      ELSE o.stato_delivery
    END,
    updated_at = now()
  WHERE o.tenant_id = p_tenant_id
    AND o.deleted_at IS NULL
    AND (o.created_at AT TIME ZONE 'Europe/Rome')::date <= p_data
    AND o.stato::text NOT IN ('CONSEGNATO', 'ANNULLATO');

  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END;
$fn$;

REVOKE ALL ON FUNCTION public.chiudi_ordini_aperti_fino_a(UUID, DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.chiudi_ordini_aperti_fino_a(UUID, DATE) TO authenticated;

COMMENT ON FUNCTION public.chiudi_ordini_aperti_fino_a(UUID, DATE) IS
  'Chiude (CONSEGNATO) ordini ancora aperti con data locale Europe/Rome <= p_data. Non tocca ANNULLATO.';

CREATE OR REPLACE FUNCTION public.chiudi_giornata(
  p_tenant_id UUID,
  p_data DATE DEFAULT CURRENT_DATE,
  p_payload JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, core
AS $$
DECLARE
  v_id UUID;
  v_data DATE;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.utenti_ruoli
    WHERE user_id = auth.uid() AND tenant_id = p_tenant_id
      AND COALESCE(attivo, true) = true
  ) AND NOT EXISTS (
    SELECT 1 FROM public.utenti_ruoli ur_sa
    WHERE ur_sa.user_id = auth.uid()
      AND COALESCE(ur_sa.attivo, true) = true
      AND lower(trim(COALESCE(ur_sa.ruolo, ''))) IN ('superadmin', 'super_admin')
  ) THEN
    RAISE EXCEPTION 'Non autorizzato per questo tenant.';
  END IF;

  v_data := COALESCE(p_data, (now() AT TIME ZONE 'Europe/Rome')::date);

  -- Contabilità giornata (come prima)
  INSERT INTO public.chiusure_giornata (tenant_id, data, payload)
  VALUES (p_tenant_id, v_data, p_payload)
  ON CONFLICT (tenant_id, data) DO UPDATE
    SET payload = COALESCE(EXCLUDED.payload, chiusure_giornata.payload),
        created_at = now()
  RETURNING id INTO v_id;

  -- Ordini del giorno + eventuali residui di giorni precedenti ancora aperti
  PERFORM public.chiudi_ordini_aperti_fino_a(p_tenant_id, v_data);

  RETURN v_id;
END;
$$;

COMMENT ON FUNCTION public.chiudi_giornata(UUID, DATE, JSONB) IS
  'Salva snapshot contabilità e chiude gli ordini aperti fino a p_data (CONSEGNATO).';

-- Catch-up immediato: residui di giorni precedenti su tutti i tenant (non tocca la giornata odierna).
UPDATE core.ordini o
SET
  stato = 'CONSEGNATO'::core.stato_ordine,
  stato_consegna = CASE
    WHEN lower(trim(COALESCE(o.tipo_ordine, ''))) = 'delivery' THEN 'CONSEGNATO'
    ELSE o.stato_consegna
  END,
  updated_at = now()
WHERE o.deleted_at IS NULL
  AND o.stato::text NOT IN ('CONSEGNATO', 'ANNULLATO')
  AND (o.created_at AT TIME ZONE 'Europe/Rome')::date
      < (now() AT TIME ZONE 'Europe/Rome')::date;
